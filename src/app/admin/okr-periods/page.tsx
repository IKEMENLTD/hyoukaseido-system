// =============================================================================
// OKR期間管理ページ (管理者) - Server Component
// 初期データをSupabaseから取得し、クライアントコンポーネントに渡す
// =============================================================================

import type { OkrPeriodStatus } from '@/types/okr';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMember } from '@/lib/auth/get-member';
import OkrPeriodManager from './OkrPeriodManager';

// ---------------------------------------------------------------------------
// Supabase返却型 (any禁止)
// ---------------------------------------------------------------------------

interface OkrPeriodRow {
  id: string;
  org_id: string;
  name: string;
  quarter: 1 | 2 | 3 | 4;
  fiscal_year: number;
  start_date: string;
  end_date: string;
  status: OkrPeriodStatus;
}

// ---------------------------------------------------------------------------
// ページコンポーネント (Server Component)
// ---------------------------------------------------------------------------

export default async function AdminOkrPeriodsPage() {
  const member = await getCurrentMember();
  if (!member || !['G4', 'G5'].includes(member.grade)) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 sm:p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">アクセス権限がありません</h2>
          <p className="text-sm text-[#737373]">
            管理機能はG4以上の等級のメンバーのみ利用できます。
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  // OKR期間一覧取得
  const { data: periods, error: periodsError } = await supabase
    .from('okr_periods')
    .select('*')
    .order('fiscal_year', { ascending: false });

  // org_id取得 (最初の組織)
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id')
    .limit(1)
    .single();

  const periodList: OkrPeriodRow[] = (periods as OkrPeriodRow[] | null) ?? [];
  const orgId: string = orgs?.id ?? '';

  // データ取得エラー時のフォールバック
  if (periodsError) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider mb-4">
            OKR期間管理
          </h1>
          <div className="border border-red-900 bg-red-950/30 px-4 py-3 text-xs text-red-400">
            データの取得に失敗しました: {periodsError.message}
          </div>
        </div>
      </div>
    );
  }

  return (
    <OkrPeriodManager
      initialPeriods={periodList}
      orgId={orgId}
    />
  );
}
