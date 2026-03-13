// =============================================================================
// フェーズ別評価ウェイトルール
// ARCHITECTURE.md セクション5-2 に準拠
// =============================================================================

import type { Phase, EvalWeights } from '@/types/evaluation';
import { PHASE_WEIGHTS } from '@/types/evaluation';

/**
 * フェーズに応じた評価ウェイトを取得
 * 黒字フェーズ: 定量50 / 定性30 / バリュー20
 * 赤字フェーズ: 定量30 / 定性45 / バリュー25
 */
export function getPhaseWeights(phase: Phase): EvalWeights {
  return PHASE_WEIGHTS[phase];
}

/**
 * フェーズの日本語ラベルを返す
 */
export function getPhaseLabel(phase: Phase): string {
  return phase === 'profitable' ? '黒字フェーズ' : '赤字（投資）フェーズ';
}

/**
 * フェーズのウェイト配分を文字列で説明する
 */
export function getWeightDescription(phase: Phase): string {
  const w = PHASE_WEIGHTS[phase];
  return `定量KPI ${w.quantitative}% / 定性行動 ${w.qualitative}% / バリュー ${w.value}%`;
}
