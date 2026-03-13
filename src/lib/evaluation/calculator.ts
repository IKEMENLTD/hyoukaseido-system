// =============================================================================
// 評価エンジン - スコア計算・ランク判定
// ARCHITECTURE.md セクション5-2 に準拠
// =============================================================================

import type {
  EvalWeights,
  KPIThresholds,
  Rank,
  Phase,
  PromotionEligibility,
} from '@/types/evaluation';
import { PHASE_WEIGHTS, RANK_THRESHOLDS, SALARY_CHANGE } from '@/types/evaluation';

// -----------------------------------------------------------------------------
// KPI評価用の入力型
// -----------------------------------------------------------------------------

/** 個別KPI項目の評価入力 */
interface KPIItemInput {
  /** 項目のウェイト (%) */
  weight: number;
  /** 達成率 (%) */
  achievementRate: number;
  /** 閾値設定 */
  thresholds: KPIThresholds;
}

/** 過去の評価結果 */
interface PastEvaluation {
  rank: Rank;
  /** 評価期間の fiscal_year */
  fiscalYear: number;
  /** 評価期間の half */
  half: string;
}

// -----------------------------------------------------------------------------
// フェーズ別ウェイト取得
// -----------------------------------------------------------------------------

/**
 * 事業部フェーズに応じた評価ウェイトを返す
 * 黒字フェーズ: 定量50 / 定性30 / バリュー20
 * 赤字フェーズ: 定量30 / 定性45 / バリュー25
 */
export function getWeights(phase: Phase): EvalWeights {
  return PHASE_WEIGHTS[phase];
}

// -----------------------------------------------------------------------------
// 総合スコア計算
// -----------------------------------------------------------------------------

/**
 * 定量・定性・バリューの各スコアとウェイトから総合スコアを算出
 * 計算式: Σ(スコア * ウェイト / 100)
 * @returns 0-100 の総合スコア (小数第2位で四捨五入)
 */
export function calculateTotalScore(
  quantitativeScore: number,
  qualitativeScore: number,
  valueScore: number,
  weights: EvalWeights
): number {
  const raw =
    (quantitativeScore * weights.quantitative +
      qualitativeScore * weights.qualitative +
      valueScore * weights.value) /
    100;
  const clamped = Math.min(Math.max(raw, 0), 100);
  return Math.round(clamped * 100) / 100;
}

// -----------------------------------------------------------------------------
// ランク判定
// -----------------------------------------------------------------------------

/**
 * 総合スコアからランクを判定
 * S: 90以上, A: 80以上, B: 60以上, C: 40以上, D: 40未満
 */
export function determineRank(totalScore: number): Rank {
  for (const threshold of RANK_THRESHOLDS) {
    if (totalScore >= threshold.min) {
      return threshold.rank;
    }
  }
  return 'D';
}

// -----------------------------------------------------------------------------
// KPIランク判定
// -----------------------------------------------------------------------------

/**
 * 個別KPI項目の達成率からランクを判定
 * 閾値はKPI項目ごとに異なる
 */
export function determineKPIRank(
  achievementRate: number,
  thresholds: KPIThresholds
): Rank {
  if (achievementRate >= thresholds.s) return 'S';
  if (achievementRate >= thresholds.a) return 'A';
  if (achievementRate >= thresholds.b) return 'B';
  if (achievementRate >= thresholds.c) return 'C';
  return 'D';
}

// -----------------------------------------------------------------------------
// ランク → スコア変換
// -----------------------------------------------------------------------------

/**
 * ランクを数値スコアに変換 (100点満点)
 * S=95, A=85, B=70, C=50, D=25
 */
export function rankToScore(rank: Rank): number {
  const scoreMap: Record<Rank, number> = {
    S: 95,
    A: 85,
    B: 70,
    C: 50,
    D: 25,
  };
  return scoreMap[rank];
}

// -----------------------------------------------------------------------------
// KPIスコア集計
// -----------------------------------------------------------------------------

/**
 * 複数KPI項目からウェイト加重平均スコアを算出
 * 各KPI項目のランクをスコアに変換し、ウェイトで加重平均する
 * @returns 0-100 の定量スコア
 */
export function calculateKPIScore(items: ReadonlyArray<KPIItemInput>): number {
  if (items.length === 0) return 0;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const item of items) {
    const rank = determineKPIRank(item.achievementRate, item.thresholds);
    const score = rankToScore(rank);
    weightedSum += score * item.weight;
    totalWeight += item.weight;
  }

  if (totalWeight === 0) return 0;

  return Math.round((weightedSum / totalWeight) * 100) / 100;
}

// -----------------------------------------------------------------------------
// 昇格適格性判定
// -----------------------------------------------------------------------------

/**
 * 昇格適格性を判定 (ARCHITECTURE.md セクション5-2 準拠)
 * - immediate: S評価は即昇格検討
 * - candidate: 2期連続A以上 (今期A + 前期がSまたはA)
 * - none: 上記以外
 */
export function checkPromotionEligibility(
  currentRank: Rank,
  pastEvaluations: ReadonlyArray<PastEvaluation>
): PromotionEligibility {
  // S評価は即昇格検討
  if (currentRank === 'S') return 'immediate';

  // 2期連続A以上: 今期がA かつ 前期(直近の過去評価)がSまたはA
  if (currentRank === 'A') {
    const sorted = [...pastEvaluations].sort((a, b) => {
      if (b.fiscalYear !== a.fiscalYear) return b.fiscalYear - a.fiscalYear;
      return b.half.localeCompare(a.half);
    });

    const previousRank = sorted.length > 0 ? sorted[0].rank : null;
    if (previousRank === 'S' || previousRank === 'A') return 'candidate';
  }

  return 'none';
}

// -----------------------------------------------------------------------------
// 昇給額推奨
// -----------------------------------------------------------------------------

/**
 * ランクに応じた推奨昇給額を返す
 * S: +50,000円, A: +30,000円, B: 0円, C: -20,000円, D: -50,000円
 */
export function recommendSalaryChange(rank: Rank): {
  amount: number;
  promotion: boolean;
  action: string;
} {
  return {
    amount: SALARY_CHANGE[rank],
    promotion: rank === 'S',
    action: rank === 'S' ? '昇格検討・特別賞与'
          : rank === 'A' ? '昇給・賞与増'
          : rank === 'B' ? '現状維持'
          : rank === 'C' ? '改善計画策定・月次面談'
          : '役割見直し・集中改善',
  };
}
