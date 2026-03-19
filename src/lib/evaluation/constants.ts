// =============================================================================
// 評価期間ステータス定数・ユーティリティ
// Server Actionsファイルから分離 (非async関数はuse serverに置けないため)
// =============================================================================

export const EVAL_PERIOD_STATUS_ORDER = [
  'planning',
  'target_setting',
  'self_eval',
  'manager_eval',
  'calibration',
  'feedback',
  'closed',
] as const;

export const EVAL_PERIOD_STATUS_LABELS: Record<
  (typeof EVAL_PERIOD_STATUS_ORDER)[number],
  string
> = {
  planning: '準備中',
  target_setting: '目標設定',
  self_eval: '自己評価',
  manager_eval: '上長評価',
  calibration: 'キャリブレーション',
  feedback: 'フィードバック',
  closed: 'クローズ',
};

/** 指定ステータスの1つ前のステータスラベルを返す。戻せない場合はnull */
export function getPreviousStatusLabel(
  status: (typeof EVAL_PERIOD_STATUS_ORDER)[number]
): string | null {
  const idx = EVAL_PERIOD_STATUS_ORDER.indexOf(status);
  if (idx <= 0) return null;
  if (status === 'closed') return null;
  return EVAL_PERIOD_STATUS_LABELS[EVAL_PERIOD_STATUS_ORDER[idx - 1]];
}
