'use server';

// =============================================================================
// 事業部別財務データ Server Actions
// 月次の売上・原価・販管費を管理し、ROI算出・フェーズ判定に活用する
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import { getCurrentMember } from '@/lib/auth/get-member';

interface ActionResult {
  success: boolean;
  error?: string;
}

// -----------------------------------------------------------------------------
// 月次財務データ保存 (upsert)
// -----------------------------------------------------------------------------

interface FinancialInput {
  division_id: string;
  fiscal_year: number;
  month: number;
  revenue: number;
  cost: number;
  operating_cost: number;
  note?: string | null;
}

export async function saveDivisionFinancials(
  inputs: FinancialInput[]
): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return { success: false, error: '認証が必要です' };
  if (!['G4', 'G5'].includes(member.grade)) {
    return { success: false, error: '財務データの入力はG4以上のみ実行可能です' };
  }

  // バリデーション
  for (const input of inputs) {
    if (input.fiscal_year < 2000 || input.fiscal_year > 2100) {
      return { success: false, error: '年度が不正です' };
    }
    if (input.month < 1 || input.month > 12) {
      return { success: false, error: '月が不正です' };
    }
    if (input.revenue < 0 || input.cost < 0 || input.operating_cost < 0) {
      return { success: false, error: '金額に負の値は入力できません' };
    }
    // 100億円上限 (入力ミス防止)
    const MAX = 10_000_000_000;
    if (input.revenue > MAX || input.cost > MAX || input.operating_cost > MAX) {
      return { success: false, error: '金額が上限を超えています' };
    }
  }

  const supabase = await createClient();

  const upsertData = inputs.map((i) => ({
    division_id: i.division_id,
    fiscal_year: i.fiscal_year,
    month: i.month,
    revenue: i.revenue,
    cost: i.cost,
    operating_cost: i.operating_cost,
    note: i.note || null,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('division_financials')
    .upsert(upsertData, { onConflict: 'division_id,fiscal_year,month' });

  if (error) {
    console.error('division_financials upsert error:', error.message);
    return { success: false, error: '保存に失敗しました' };
  }

  return { success: true };
}

// -----------------------------------------------------------------------------
// 事業部の実績フェーズ判定
// 直近四半期の net_profit 合計が正なら profitable、負なら investing
// -----------------------------------------------------------------------------

export interface DivisionPhaseResult {
  divisionId: string;
  suggestedPhase: 'profitable' | 'investing';
  quarterlyNetProfit: number;
  hasData: boolean;
}

export async function getDivisionPhases(
  fiscalYear: number,
  quarter: number
): Promise<DivisionPhaseResult[]> {
  const member = await getCurrentMember();
  if (!member) return [];

  // 四半期の月範囲を計算 (4月始まり想定: Q1=4-6, Q2=7-9, Q3=10-12, Q4=1-3)
  const monthRanges: Record<number, number[]> = {
    1: [4, 5, 6],
    2: [7, 8, 9],
    3: [10, 11, 12],
    4: [1, 2, 3],
  };
  const months = monthRanges[quarter];
  if (!months) return [];

  // Q4の場合、fiscal_yearの翌年の1-3月
  const calendarYear = quarter === 4 ? fiscalYear + 1 : fiscalYear;

  const supabase = await createClient();
  const { data: financials } = await supabase
    .from('division_financials')
    .select('division_id, revenue, cost, operating_cost')
    .eq('fiscal_year', calendarYear)
    .in('month', months);

  if (!financials || financials.length === 0) {
    // データなし → 全事業部にデフォルト返却
    const { data: divisions } = await supabase.from('divisions').select('id, phase');
    return ((divisions ?? []) as Array<{ id: string; phase: string }>).map((d) => ({
      divisionId: d.id,
      suggestedPhase: d.phase as 'profitable' | 'investing',
      quarterlyNetProfit: 0,
      hasData: false,
    }));
  }

  // 事業部ごとに集計
  const rows = financials as Array<{
    division_id: string;
    revenue: number;
    cost: number;
    operating_cost: number;
  }>;

  const aggregated = new Map<string, number>();
  for (const row of rows) {
    const netProfit = row.revenue - row.cost - row.operating_cost;
    aggregated.set(row.division_id, (aggregated.get(row.division_id) ?? 0) + netProfit);
  }

  // 全事業部を取得し、データがある事業部は実績ベース、ない事業部は手動設定のまま
  const { data: allDivisions } = await supabase.from('divisions').select('id, phase');
  return ((allDivisions ?? []) as Array<{ id: string; phase: string }>).map((d) => {
    const netProfit = aggregated.get(d.id);
    if (netProfit !== undefined) {
      return {
        divisionId: d.id,
        suggestedPhase: netProfit >= 0 ? 'profitable' as const : 'investing' as const,
        quarterlyNetProfit: netProfit,
        hasData: true,
      };
    }
    return {
      divisionId: d.id,
      suggestedPhase: d.phase as 'profitable' | 'investing',
      quarterlyNetProfit: 0,
      hasData: false,
    };
  });
}
