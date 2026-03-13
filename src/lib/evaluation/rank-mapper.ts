// =============================================================================
// スコア → ランク変換・ランク情報マッパー
// ARCHITECTURE.md セクション5-2 に準拠
// =============================================================================

import type { Rank } from '@/types/evaluation';
import { RANK_THRESHOLDS, SALARY_CHANGE } from '@/types/evaluation';

// -----------------------------------------------------------------------------
// ランクラベル定義
// -----------------------------------------------------------------------------

const RANK_LABELS: Readonly<Record<Rank, string>> = {
  S: 'S（卓越）',
  A: 'A（優秀）',
  B: 'B（標準）',
  C: 'C（要改善）',
  D: 'D（要指導）',
};

const RANK_COLORS: Readonly<Record<Rank, string>> = {
  S: '#8b5cf6', // purple
  A: '#3b82f6', // blue
  B: '#22c55e', // green
  C: '#f59e0b', // amber
  D: '#ef4444', // red
};

const RANK_RECOMMENDATIONS: Readonly<Record<Rank, string>> = {
  S: '次期リーダー候補として特別プロジェクトへのアサインを推奨',
  A: '現職務での更なる成長機会の提供と昇格検討を推奨',
  B: '現等級の期待水準を満たしており、引き続き成長支援を継続',
  C: '改善計画の策定と月次1on1による重点フォローを推奨',
  D: '改善計画の即時策定と週次レビューによる集中支援が必要',
};

// -----------------------------------------------------------------------------
// 関数
// -----------------------------------------------------------------------------

/**
 * 総合スコアからランクを判定
 * S: 90以上, A: 80以上, B: 60以上, C: 40以上, D: 40未満
 */
export function scoreToRank(score: number): Rank {
  for (const threshold of RANK_THRESHOLDS) {
    if (score >= threshold.min) {
      return threshold.rank;
    }
  }
  return 'D';
}

/**
 * ランクの日本語ラベルを返す
 */
export function rankToLabel(rank: Rank): string {
  return RANK_LABELS[rank];
}

/**
 * ランクに対応するCSSカラーコードを返す
 */
export function rankToColor(rank: Rank): string {
  return RANK_COLORS[rank];
}

/**
 * ランクに応じた推奨昇給額を返す (円)
 */
export function getSalaryChange(rank: Rank): number {
  return SALARY_CHANGE[rank];
}

/**
 * ランクに応じたアクション推奨文を返す
 */
export function getActionRecommendation(rank: Rank): string {
  return RANK_RECOMMENDATIONS[rank];
}
