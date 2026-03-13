// =============================================================================
// 評価スコア更新ヘルパー (クライアントサイド)
// 個別スコア保存後に evaluations テーブルの集計スコアを再計算・永続化する
// =============================================================================

import { createClient } from '@/lib/supabase/client';
import {
  calculateKPIScore,
  determineKPIRank,
  calculateTotalScore,
  determineRank,
  recommendSalaryChange,
} from '@/lib/evaluation/calculator';
import type { KPIThresholds, Phase, Rank } from '@/types/evaluation';

// -----------------------------------------------------------------------------
// 定量スコア (KPI) 更新
// -----------------------------------------------------------------------------

/**
 * KPIスコアを再集計し evaluations.quantitative_score を更新する。
 * 2ステップで取得: eval_kpi_scores → kpi_items (閾値・ウェイト)
 */
export async function updateQuantitativeScore(
  evaluationId: string
): Promise<void> {
  const supabase = createClient();

  // Step 1: 実績入力済みの KPI スコア行を取得
  const { data: scores, error: scoresErr } = await supabase
    .from('eval_kpi_scores')
    .select('id, kpi_item_id, target_value, actual_value')
    .eq('evaluation_id', evaluationId)
    .not('actual_value', 'is', null);

  if (scoresErr) {
    console.error('eval_kpi_scores 取得エラー:', scoresErr.message);
    return;
  }
  if (!scores || scores.length === 0) return;

  const kpiScores = scores as Array<{
    id: string;
    kpi_item_id: string;
    target_value: number | null;
    actual_value: number | null;
  }>;

  // Step 2: 対応する kpi_items を取得
  const kpiItemIds = kpiScores.map((s) => s.kpi_item_id);
  const { data: items, error: itemsErr } = await supabase
    .from('kpi_items')
    .select('id, weight, threshold_s, threshold_a, threshold_b, threshold_c')
    .in('id', kpiItemIds);

  if (itemsErr) {
    console.error('kpi_items 取得エラー:', itemsErr.message);
    return;
  }
  if (!items) return;

  const kpiItems = items as Array<{
    id: string;
    weight: number;
    threshold_s: number | null;
    threshold_a: number | null;
    threshold_b: number | null;
    threshold_c: number | null;
  }>;

  const itemMap = new Map(kpiItems.map((i) => [i.id, i]));

  // Step 3: 各項目の達成率・ランクを算出し、calculator に渡す入力を組み立てる
  const kpiInputs: Array<{
    scoreId: string;
    achievementRate: number;
    weight: number;
    thresholds: KPIThresholds;
    rank: Rank;
  }> = [];

  for (const score of kpiScores) {
    const item = itemMap.get(score.kpi_item_id);
    if (!item) continue;
    if (score.target_value == null || score.target_value === 0) continue;
    if (score.actual_value == null) continue;

    const achievementRate = (score.actual_value / score.target_value) * 100;
    const thresholds: KPIThresholds = {
      s: item.threshold_s ?? 120,
      a: item.threshold_a ?? 100,
      b: item.threshold_b ?? 80,
      c: item.threshold_c ?? 60,
    };
    const rank = determineKPIRank(achievementRate, thresholds);

    kpiInputs.push({
      scoreId: score.id,
      achievementRate,
      weight: item.weight,
      thresholds,
      rank,
    });
  }

  if (kpiInputs.length === 0) return;

  // Step 4: 各 eval_kpi_scores に rank を書き戻す
  for (const input of kpiInputs) {
    const { error: updateErr } = await supabase
      .from('eval_kpi_scores')
      .update({ rank: input.rank })
      .eq('id', input.scoreId);

    if (updateErr) {
      console.error('eval_kpi_scores 更新エラー:', updateErr.message);
    }
  }

  // Step 5: 加重平均スコアを算出
  const quantitativeScore = calculateKPIScore(
    kpiInputs.map((i) => ({
      weight: i.weight,
      achievementRate: i.achievementRate,
      thresholds: i.thresholds,
    }))
  );

  // Step 6: evaluations テーブルに書き込む
  const { error: evalErr } = await supabase
    .from('evaluations')
    .update({ quantitative_score: quantitativeScore })
    .eq('id', evaluationId);

  if (evalErr) {
    console.error('evaluations.quantitative_score 更新エラー:', evalErr.message);
  }
}

// -----------------------------------------------------------------------------
// 定性スコア (行動評価) 更新 - 本人評価
// -----------------------------------------------------------------------------

/**
 * 行動評価の本人スコア平均から qualitative_score を更新する。
 * スコアは 1-4 スケール → 0-100 に変換: (平均 / 4) * 100
 */
export async function updateQualitativeScore(
  evaluationId: string
): Promise<void> {
  const supabase = createClient();

  const { data: scores, error } = await supabase
    .from('eval_behavior_scores')
    .select('self_score')
    .eq('evaluation_id', evaluationId)
    .not('self_score', 'is', null);

  if (error) {
    console.error('eval_behavior_scores 取得エラー:', error.message);
    return;
  }
  if (!scores || scores.length === 0) return;

  const behaviorScores = scores as Array<{ self_score: number }>;
  const sum = behaviorScores.reduce((acc, s) => acc + s.self_score, 0);
  const average = sum / behaviorScores.length;
  const qualitativeScore = Math.round((average / 4) * 100 * 100) / 100;

  const { error: updateErr } = await supabase
    .from('evaluations')
    .update({ qualitative_score: qualitativeScore })
    .eq('id', evaluationId);

  if (updateErr) {
    console.error('evaluations.qualitative_score 更新エラー:', updateErr.message);
  }
}

// -----------------------------------------------------------------------------
// 定性スコア (行動評価) 更新 - 上司評価
// -----------------------------------------------------------------------------

/**
 * 行動評価の上司スコア平均から qualitative_score を更新する。
 */
export async function updateQualitativeScoreManager(
  evaluationId: string
): Promise<void> {
  const supabase = createClient();

  const { data: scores, error } = await supabase
    .from('eval_behavior_scores')
    .select('manager_score')
    .eq('evaluation_id', evaluationId)
    .not('manager_score', 'is', null);

  if (error) {
    console.error('eval_behavior_scores 取得エラー:', error.message);
    return;
  }
  if (!scores || scores.length === 0) return;

  const behaviorScores = scores as Array<{ manager_score: number }>;
  const sum = behaviorScores.reduce((acc, s) => acc + s.manager_score, 0);
  const average = sum / behaviorScores.length;
  const qualitativeScore = Math.round((average / 4) * 100 * 100) / 100;

  const { error: updateErr } = await supabase
    .from('evaluations')
    .update({ qualitative_score: qualitativeScore })
    .eq('id', evaluationId);

  if (updateErr) {
    console.error('evaluations.qualitative_score (上司) 更新エラー:', updateErr.message);
  }
}

// -----------------------------------------------------------------------------
// バリュースコア更新 - 本人評価
// -----------------------------------------------------------------------------

/**
 * バリュー評価の本人スコアを集計し value_score を更新する。
 * 計算: (self_score の合計 / max_score の合計) * 100
 */
export async function updateValueScore(
  evaluationId: string,
  valueItems: ReadonlyArray<{ id: string; max_score: number }>
): Promise<void> {
  const supabase = createClient();

  const { data: scores, error } = await supabase
    .from('eval_value_scores')
    .select('value_item_id, self_score')
    .eq('evaluation_id', evaluationId)
    .not('self_score', 'is', null);

  if (error) {
    console.error('eval_value_scores 取得エラー:', error.message);
    return;
  }
  if (!scores || scores.length === 0) return;

  const valueScores = scores as Array<{ value_item_id: string; self_score: number }>;
  const maxScoreMap = new Map(valueItems.map((v) => [v.id, v.max_score]));

  let sumScore = 0;
  let sumMaxScore = 0;

  for (const s of valueScores) {
    const maxScore = maxScoreMap.get(s.value_item_id);
    if (maxScore == null || maxScore === 0) continue;
    sumScore += s.self_score;
    sumMaxScore += maxScore;
  }

  if (sumMaxScore === 0) return;

  const valueScore = Math.round((sumScore / sumMaxScore) * 100 * 100) / 100;

  const { error: updateErr } = await supabase
    .from('evaluations')
    .update({ value_score: valueScore })
    .eq('id', evaluationId);

  if (updateErr) {
    console.error('evaluations.value_score 更新エラー:', updateErr.message);
  }
}

// -----------------------------------------------------------------------------
// バリュースコア更新 - 上司評価
// -----------------------------------------------------------------------------

/**
 * バリュー評価の上司スコアを集計し value_score を更新する。
 */
export async function updateValueScoreManager(
  evaluationId: string,
  valueItems: ReadonlyArray<{ id: string; max_score: number }>
): Promise<void> {
  const supabase = createClient();

  const { data: scores, error } = await supabase
    .from('eval_value_scores')
    .select('value_item_id, manager_score')
    .eq('evaluation_id', evaluationId)
    .not('manager_score', 'is', null);

  if (error) {
    console.error('eval_value_scores 取得エラー:', error.message);
    return;
  }
  if (!scores || scores.length === 0) return;

  const valueScores = scores as Array<{ value_item_id: string; manager_score: number }>;
  const maxScoreMap = new Map(valueItems.map((v) => [v.id, v.max_score]));

  let sumScore = 0;
  let sumMaxScore = 0;

  for (const s of valueScores) {
    const maxScore = maxScoreMap.get(s.value_item_id);
    if (maxScore == null || maxScore === 0) continue;
    sumScore += s.manager_score;
    sumMaxScore += maxScore;
  }

  if (sumMaxScore === 0) return;

  const valueScore = Math.round((sumScore / sumMaxScore) * 100 * 100) / 100;

  const { error: updateErr } = await supabase
    .from('evaluations')
    .update({ value_score: valueScore })
    .eq('id', evaluationId);

  if (updateErr) {
    console.error('evaluations.value_score (上司) 更新エラー:', updateErr.message);
  }
}

// -----------------------------------------------------------------------------
// 総合スコア・ランク・推奨昇給額の更新
// -----------------------------------------------------------------------------

/**
 * 上位行動ボーナスによるランク段階アップを適用する。
 * D→C→B→A→S の順で bonus 段階分アップ (上限 S)
 */
function applyBonusToRank(rank: Rank, bonus: number): Rank {
  const ranks: Rank[] = ['D', 'C', 'B', 'A', 'S'];
  const currentIdx = ranks.indexOf(rank);
  const newIdx = Math.min(currentIdx + bonus, ranks.length - 1);
  return ranks[newIdx];
}

/**
 * 上位等級行動フラグの件数からボーナス段階を決定する。
 * 0件 = +0, 1-2件 = +1, 3件以上 = +2
 */
function determineUpperBehaviorBonus(flagCount: number): number {
  if (flagCount >= 3) return 2;
  if (flagCount >= 1) return 1;
  return 0;
}

/**
 * 定量・定性・バリューの3スコアから総合スコアを算出し、
 * 上位行動ボーナスを加味したランクと推奨昇給額とともに
 * evaluations テーブルに書き込む。
 */
export async function updateTotalScoreAndRank(
  evaluationId: string
): Promise<void> {
  const supabase = createClient();

  const { data: evaluation, error } = await supabase
    .from('evaluations')
    .select(
      'quantitative_score, qualitative_score, value_score, phase_at_eval, quantitative_weight, qualitative_weight, value_weight'
    )
    .eq('id', evaluationId)
    .single();

  if (error) {
    console.error('evaluations 取得エラー:', error.message);
    return;
  }
  if (!evaluation) return;

  const evalData = evaluation as {
    quantitative_score: number | null;
    qualitative_score: number | null;
    value_score: number | null;
    phase_at_eval: Phase;
    quantitative_weight: number;
    qualitative_weight: number;
    value_weight: number;
  };

  const quantitative = evalData.quantitative_score ?? 0;
  const qualitative = evalData.qualitative_score ?? 0;
  const value = evalData.value_score ?? 0;

  const weights = {
    quantitative: evalData.quantitative_weight,
    qualitative: evalData.qualitative_weight,
    value: evalData.value_weight,
  };

  const totalScore = calculateTotalScore(quantitative, qualitative, value, weights);
  const baseRank = determineRank(totalScore);

  // 上位行動ボーナス判定: is_upper_grade_behavior = true の件数を集計
  const { data: upperBehaviors, error: upperErr } = await supabase
    .from('eval_behavior_scores')
    .select('id')
    .eq('evaluation_id', evaluationId)
    .eq('is_upper_grade_behavior', true);

  if (upperErr) {
    console.error('上位行動ボーナス取得エラー:', upperErr.message);
  }

  const upperCount = upperBehaviors?.length ?? 0;
  const bonus = determineUpperBehaviorBonus(upperCount);
  const finalRank = applyBonusToRank(baseRank, bonus);
  const salary = recommendSalaryChange(finalRank);

  const { error: updateErr } = await supabase
    .from('evaluations')
    .update({
      total_score: totalScore,
      rank: finalRank,
      upper_behavior_bonus: bonus,
      salary_change_recommended: salary.amount,
    })
    .eq('id', evaluationId);

  if (updateErr) {
    console.error('evaluations 総合スコア更新エラー:', updateErr.message);
  }
}
