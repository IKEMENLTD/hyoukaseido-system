// =============================================================================
// 評価期間管理ページ (A-04) - Server Component
// 初期データをSupabaseから取得し、クライアントコンポーネントに渡す
// =============================================================================

import type { EvalPeriodStatus, Half } from '@/types/evaluation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMember } from '@/lib/auth/get-member';
import EvalPeriodManager from './EvalPeriodManager';

// ---------------------------------------------------------------------------
// Supabase返却型 (any禁止)
// ---------------------------------------------------------------------------

interface EvalPeriodRow {
  id: string;
  org_id: string;
  name: string;
  half: Half | null;
  fiscal_year: number | null;
  start_date: string;
  end_date: string;
  status: EvalPeriodStatus;
}

// ---------------------------------------------------------------------------
// ページコンポーネント (Server Component)
// ---------------------------------------------------------------------------

export default async function EvalPeriodsPage() {
  const member = await getCurrentMember();
  if (!member || !['G4', 'G5'].includes(member.grade)) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 sm:p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">アクセス権限がありません</h2>
          <p className="text-sm text-[#737373]">
            管理機能はG4以上の等級のメンバーのみ利用できます。
          </p>
          <a
            href="/dashboard"
            className="mt-4 inline-block px-4 py-2 border border-[#333333] text-xs text-[#a3a3a3] hover:border-[#e5e5e5] hover:text-[#e5e5e5]"
          >
            ダッシュボードへ戻る
          </a>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  // 並列データ取得
  const [periodsRes, orgsRes, okrPeriodsRes, linksRes] = await Promise.all([
    supabase.from('eval_periods').select('*').order('fiscal_year', { ascending: false }),
    supabase.from('organizations').select('id').limit(1).single(),
    supabase.from('okr_periods').select('id, name, quarter, fiscal_year, status').order('fiscal_year', { ascending: false }),
    supabase.from('eval_period_okr_periods').select('eval_period_id, okr_period_id'),
  ]);

  const { data: periods, error: periodsError } = periodsRes;

  const periodList: EvalPeriodRow[] = (periods as EvalPeriodRow[] | null) ?? [];
  const orgId: string = orgsRes.data?.id ?? '';
  const okrPeriods = ((okrPeriodsRes.data ?? []) as Array<{
    id: string; name: string; quarter: number; fiscal_year: number; status: string;
  }>).map((p) => ({ id: p.id, name: p.name, quarter: p.quarter, fiscalYear: p.fiscal_year, status: p.status }));
  const existingLinks = ((linksRes.data ?? []) as Array<{ eval_period_id: string; okr_period_id: string }>);

  // データ取得エラー時のフォールバック
  if (periodsError) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider mb-4">
            評価期間管理
          </h1>
          <div className="border border-red-900 bg-red-950/30 px-4 py-3 text-xs text-red-400">
            データの取得に失敗しました: {periodsError.message}
          </div>
        </div>
      </div>
    );
  }

  return (
    <EvalPeriodManager
      initialPeriods={periodList}
      orgId={orgId}
      okrPeriods={okrPeriods}
      existingLinks={existingLinks}
    />
  );
}
