// =============================================================================
// 四半期インセンティブページ (Q-01)
// 四半期ボーナスの一覧表示・承認管理
// Server Component: データ取得 + 権限チェック → BonusClientに委譲
// =============================================================================

import type { BonusType, BonusStatus } from '@/types/evaluation';
import { getCurrentMember } from '@/lib/auth/get-member';
import { createClient } from '@/lib/supabase/server';
import BonusClient from './BonusClient';
import type { DisplayBonus } from './BonusClient';

interface BonusRow {
  id: string;
  bonus_type: BonusType;
  amount: number;
  calculation_basis: string | null;
  status: BonusStatus;
  created_at: string;
  members: { name: string } | null;
  divisions: { name: string } | null;
  okr_periods: { name: string } | null;
  approver: { name: string } | null;
}

export default async function QuarterlyBonusPage() {
  const member = await getCurrentMember();
  if (!member) {
    return (
      <div className="min-h-screen bg-[#050505] p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">ログインが必要です</h2>
          <p className="text-sm text-[#737373]">この機能を利用するにはログインしてください。</p>
        </div>
      </div>
    );
  }

  const isAdmin = ['G4', 'G5'].includes(member.grade);
  const supabase = await createClient();

  const [bonusResult, membersResult, divisionsResult, periodsResult] = await Promise.all([
    supabase
      .from('quarterly_bonuses')
      .select(`
        id, bonus_type, amount, calculation_basis, status, created_at,
        members!quarterly_bonuses_member_id_fkey (name),
        divisions!quarterly_bonuses_division_id_fkey (name),
        okr_periods!quarterly_bonuses_okr_period_id_fkey (name),
        approver:members!quarterly_bonuses_approved_by_fkey (name)
      `)
      .order('created_at', { ascending: false }),
    supabase
      .from('members')
      .select('id, name')
      .eq('status', 'active')
      .order('name'),
    supabase
      .from('divisions')
      .select('id, name')
      .order('name'),
    supabase
      .from('okr_periods')
      .select('id, name')
      .order('start_date', { ascending: false })
      .limit(8),
  ]);

  const bonuses: DisplayBonus[] = ((bonusResult.data ?? []) as unknown as BonusRow[]).map(
    (row) => ({
      id: row.id,
      memberName: row.members?.name ?? '---',
      divisionName: row.divisions?.name ?? '---',
      okrPeriodName: row.okr_periods?.name ?? '---',
      bonusType: row.bonus_type,
      amount: row.amount,
      calculationBasis: row.calculation_basis ?? '',
      approvedBy: row.approver?.name ?? null,
      status: row.status,
      createdAt: row.created_at.split('T')[0],
    }),
  );

  const membersList = (membersResult.data ?? []) as Array<{ id: string; name: string }>;
  const divisionsList = (divisionsResult.data ?? []) as Array<{ id: string; name: string }>;
  const periodsList = (periodsResult.data ?? []) as Array<{ id: string; name: string }>;

  const latestPeriodName = bonuses.length > 0 ? bonuses[0].okrPeriodName : '---';
  const totalAmount = bonuses.reduce((sum, b) => sum + b.amount, 0);
  const pendingCount = bonuses.filter((b) => b.status === 'pending').length;
  const paidAmount = bonuses
    .filter((b) => b.status === 'paid')
    .reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="min-h-screen bg-[#050505] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ページヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
              四半期インセンティブ
            </h1>
            <p className="text-sm text-[#737373] mt-1">
              四半期ボーナスの管理・承認
            </p>
          </div>
          <span className="px-3 py-1 border border-[#333333] text-xs text-[#a3a3a3]">
            {latestPeriodName}
          </span>
        </div>

        {/* サマリー */}
        <div className="grid grid-cols-3 gap-4">
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-1">総額</div>
            <div className="text-2xl font-bold text-[#e5e5e5]">{totalAmount.toLocaleString()}円</div>
          </div>
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-1">承認待ち</div>
            <div className="text-2xl font-bold text-[#f59e0b]">{pendingCount}件</div>
          </div>
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-1">支給済み</div>
            <div className="text-2xl font-bold text-[#22d3ee]">{paidAmount.toLocaleString()}円</div>
          </div>
        </div>

        {/* クライアントコンポーネントに委譲 */}
        <BonusClient
          bonuses={bonuses}
          isAdmin={isAdmin}
          currentMemberId={member.id}
          members={membersList}
          divisions={divisionsList}
          okrPeriods={periodsList}
        />
      </div>
    </div>
  );
}
