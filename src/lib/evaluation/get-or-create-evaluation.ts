// =============================================================================
// 評価ヘルパー: 評価レコードの取得または新規作成
// メンバー + 評価期間の組み合わせで既存レコードを検索し、
// なければ draft ステータスで新規作成する
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import type { Phase, Grade, EvaluationStatus, Rank, PromotionEligibility } from '@/types/evaluation';

export interface EvaluationRecord {
  id: string;
  eval_period_id: string;
  member_id: string;
  evaluator_id: string | null;
  division_id: string;
  grade_at_eval: Grade;
  salary_at_eval: number;
  phase_at_eval: Phase;
  quantitative_weight: number;
  qualitative_weight: number;
  value_weight: number;
  status: EvaluationStatus;
  quantitative_score: number | null;
  qualitative_score: number | null;
  value_score: number | null;
  total_score: number | null;
  rank: Rank | null;
  upper_behavior_bonus: number;
  promotion_eligibility: PromotionEligibility;
  self_comment: string | null;
  evaluator_comment: string | null;
  next_actions: string | null;
  salary_change_recommended: number | null;
  promotion_recommended: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * 指定メンバー・評価期間の評価レコードを取得、または新規作成する。
 *
 * 1. evaluations テーブルに既存レコードがあればそれを返す
 * 2. なければ division_members から主所属事業部を取得し、
 *    フェーズに応じたウェイトで新規レコードを作成する
 */
export async function getOrCreateEvaluation(
  memberId: string,
  periodId: string
): Promise<EvaluationRecord | null> {
  const supabase = await createClient();

  // 既存レコードを検索
  const { data: existing, error: existingErr } = await supabase
    .from('evaluations')
    .select('*')
    .eq('member_id', memberId)
    .eq('eval_period_id', periodId)
    .limit(1)
    .single();
  if (existingErr && existingErr.code !== 'PGRST116') console.error('[DB] evaluations 取得エラー:', existingErr);

  if (existing) return existing as EvaluationRecord;

  // メンバーの主所属事業部を取得
  const { data: divMember, error: divMemberErr } = await supabase
    .from('division_members')
    .select('division_id, divisions(phase)')
    .eq('member_id', memberId)
    .eq('is_primary', true)
    .limit(1)
    .single();
  if (divMemberErr) console.error('[DB] division_members 取得エラー:', divMemberErr);

  if (!divMember) return null;

  const dm = divMember as unknown as { division_id: string; divisions: { phase: string } | null };

  // フェーズ判定: 財務データがあれば実績ベース、なければ手動設定値を使用
  let phase: Phase = (dm.divisions?.phase === 'profitable') ? 'profitable' : 'investing';

  // 直近四半期の営業利益で自動判定を試みる
  const now = new Date();
  const prevMonth = now.getMonth(); // 0-11 (前月)
  const lookbackMonths = prevMonth >= 3
    ? [prevMonth - 2, prevMonth - 1, prevMonth].map((m) => m + 1)
    : [prevMonth + 1]; // データが少ない場合は前月のみ
  const lookbackYear = now.getFullYear();

  const { data: financials, error: financialsErr } = await supabase
    .from('division_financials')
    .select('revenue, cost, operating_cost')
    .eq('division_id', dm.division_id)
    .eq('fiscal_year', lookbackYear)
    .in('month', lookbackMonths);
  if (financialsErr) console.error('[DB] division_financials 取得エラー:', financialsErr);

  if (financials && financials.length > 0) {
    const rows = financials as Array<{ revenue: number; cost: number; operating_cost: number }>;
    const totalNetProfit = rows.reduce((sum, r) => sum + (r.revenue - r.cost - r.operating_cost), 0);
    phase = totalNetProfit >= 0 ? 'profitable' : 'investing';
  }

  // メンバー情報のスナップショット取得
  const { data: member, error: memberErr } = await supabase
    .from('members')
    .select('grade, monthly_salary')
    .eq('id', memberId)
    .single();
  if (memberErr) console.error('[DB] members 取得エラー:', memberErr);

  if (!member) return null;

  const memberData = member as { grade: string; monthly_salary: number };

  // フェーズに応じたウェイト設定
  const weights = phase === 'profitable'
    ? { quantitative_weight: 50, qualitative_weight: 30, value_weight: 20 }
    : { quantitative_weight: 30, qualitative_weight: 45, value_weight: 25 };

  // 評価レコード新規作成
  const { data: newEval, error } = await supabase
    .from('evaluations')
    .insert({
      eval_period_id: periodId,
      member_id: memberId,
      division_id: dm.division_id,
      grade_at_eval: memberData.grade,
      salary_at_eval: memberData.monthly_salary,
      phase_at_eval: phase,
      ...weights,
      status: 'draft',
    })
    .select()
    .single();

  if (error) {
    console.error('評価レコード作成エラー:', error.message);
    return null;
  }

  return newEval as EvaluationRecord;
}
