// =============================================================================
// ボーナス結果一覧ページ
// 四半期ボーナスの結果と金額を表示
// =============================================================================

import type { BonusType, BonusStatus } from '@/types/evaluation';
import { getCurrentMember } from '@/lib/auth/get-member';
import { createClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// ローカル型定義
// ---------------------------------------------------------------------------

interface OkrPeriodRelation {
  name: string;
  quarter: 1 | 2 | 3 | 4;
  fiscal_year: number;
}

interface DivisionRelation {
  name: string;
}

interface QuarterlyBonusRow {
  id: string;
  bonus_type: BonusType;
  amount: number;
  calculation_basis: string | null;
  status: BonusStatus;
  created_at: string;
  okr_periods: OkrPeriodRelation | null;
  divisions: DivisionRelation | null;
}

interface DisplayBonus {
  id: string;
  periodName: string;
  quarter: 1 | 2 | 3 | 4 | undefined;
  fiscalYear: number | undefined;
  divisionName: string;
  bonusType: BonusType;
  amount: number;
  calculationBasis: string;
  status: BonusStatus;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

const BONUS_TYPE_LABELS: Record<BonusType, { label: string; color: string }> = {
  kpi_achievement: { label: 'KPI達成', color: 'text-[#3b82f6] border-[#3b82f6]' },
  okr_stretch: { label: 'OKRストレッチ', color: 'text-[#a855f7] border-[#a855f7]' },
  special: { label: '特別ボーナス', color: 'text-[#22d3ee] border-[#22d3ee]' },
};

const STATUS_LABELS: Record<BonusStatus, { label: string; color: string }> = {
  pending: { label: '申請中', color: 'text-[#f59e0b]' },
  approved: { label: '承認済', color: 'text-[#22d3ee]' },
  paid: { label: '支給済', color: 'text-[#a3a3a3]' },
};

// ---------------------------------------------------------------------------
// データ変換
// ---------------------------------------------------------------------------

function toDisplayBonus(row: QuarterlyBonusRow): DisplayBonus {
  return {
    id: row.id,
    periodName: row.okr_periods?.name ?? '---',
    quarter: row.okr_periods?.quarter,
    fiscalYear: row.okr_periods?.fiscal_year,
    divisionName: row.divisions?.name ?? '---',
    bonusType: row.bonus_type,
    amount: row.amount,
    calculationBasis: row.calculation_basis ?? '',
    status: row.status,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// ページコンポーネント
// ---------------------------------------------------------------------------

export default async function BonusPage() {
  const member = await getCurrentMember();
  if (!member) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 sm:p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">ログインが必要です</h2>
          <p className="text-sm text-[#737373] mb-4">この機能を利用するにはログインしてください。</p>
          <a
            href="/login"
            className="inline-block px-6 py-2 text-sm font-bold text-[#050505] bg-[#3b82f6] hover:bg-[#2563eb] transition-colors"
          >
            ログインページへ
          </a>
        </div>
      </div>
    );
  }

  // Supabaseからボーナスデータを取得
  const supabase = await createClient();
  const { data: rawBonuses, error: rawBonusesErr } = await supabase
    .from('quarterly_bonuses')
    .select(`
      id, bonus_type, amount, calculation_basis, status, created_at,
      okr_periods (name, quarter, fiscal_year),
      divisions (name)
    `)
    .eq('member_id', member.id)
    .order('created_at', { ascending: false });
  if (rawBonusesErr) console.error('[DB] quarterly_bonuses 取得エラー:', rawBonusesErr);

  const bonuses: DisplayBonus[] = (rawBonuses as QuarterlyBonusRow[] | null)?.map(toDisplayBonus) ?? [];

  // サマリー計算
  const totalPaid = bonuses
    .filter((b) => b.status === 'paid')
    .reduce((sum, b) => sum + b.amount, 0);
  const totalApproved = bonuses
    .filter((b) => b.status === 'approved')
    .reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* ページヘッダー */}
        <div>
          <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
            ボーナス結果
          </h1>
          <p className="text-sm text-[#737373] mt-1">
            四半期ボーナスの結果と支給額一覧
          </p>
        </div>

        {/* サマリーカード */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-1">支給済合計</div>
            <div className="text-2xl font-bold text-[#e5e5e5]">
              {totalPaid.toLocaleString()}円
            </div>
          </div>
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-1">承認済 (未支給)</div>
            <div className="text-2xl font-bold text-[#22d3ee]">
              {totalApproved.toLocaleString()}円
            </div>
          </div>
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-1">ボーナス回数</div>
            <div className="text-2xl font-bold text-[#3b82f6]">
              {bonuses.length}回
            </div>
          </div>
        </div>

        {/* ボーナス一覧 */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="border-b border-[#1a1a1a] px-4 py-3">
            <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
              ボーナス明細
            </h3>
          </div>
          {bonuses.length === 0 ? (
            <div className="px-4 py-6 sm:py-12 text-center">
              <p className="text-sm text-[#737373]">ボーナスデータがありません。</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1a1a1a] text-[#737373]">
                    <th className="px-4 py-2 text-left font-medium">期間</th>
                    <th className="px-4 py-2 text-left font-medium">種別</th>
                    <th className="px-4 py-2 text-right font-medium">金額</th>
                    <th className="px-4 py-2 text-left font-medium">算定根拠</th>
                    <th className="px-4 py-2 text-center font-medium">ステータス</th>
                  </tr>
                </thead>
                <tbody>
                  {bonuses.map((bonus) => {
                    const typeConfig = BONUS_TYPE_LABELS[bonus.bonusType];
                    const statusConfig = STATUS_LABELS[bonus.status];
                    return (
                      <tr
                        key={bonus.id}
                        className="border-b border-[#111111] hover:bg-[#111111] transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="text-[#e5e5e5]">{bonus.periodName}</div>
                          <div className="text-[10px] text-[#404040]">{bonus.divisionName}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 border text-xs font-bold ${typeConfig.color}`}>
                            {typeConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-[#e5e5e5] font-bold text-base">
                          {bonus.amount.toLocaleString()}円
                        </td>
                        <td className="px-4 py-3 text-[#737373] text-xs max-w-64">
                          {bonus.calculationBasis}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs font-bold ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
