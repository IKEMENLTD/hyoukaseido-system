// =============================================================================
// 評価制度システム - OKR関連型定義
// ARCHITECTURE.txt セクション4-2 データベース設計に準拠
// =============================================================================

// -----------------------------------------------------------------------------
// 列挙型 (Union Types)
// -----------------------------------------------------------------------------

/** OKR期間ステータス */
export type OkrPeriodStatus = 'planning' | 'active' | 'reviewing' | 'closed';

/** OKRレベル: 全社 / 事業部 / 個人 */
export type OkrLevel = 'company' | 'division' | 'individual';

// -----------------------------------------------------------------------------
// インターフェース
// -----------------------------------------------------------------------------

/** OKR期間 (okr_periods) - 四半期サイクル */
export interface OkrPeriod {
  id: string;
  org_id: string;
  name: string;
  quarter: 1 | 2 | 3 | 4;
  fiscal_year: number;
  start_date: string;
  end_date: string;
  status: OkrPeriodStatus;
}

/** OKR目標 (okr_objectives) */
export interface OkrObjective {
  id: string;
  okr_period_id: string;
  member_id: string;
  division_id: string;
  level: OkrLevel | null;
  title: string;
  status: string;
  created_at: string;
}

/** OKRキーリザルト (okr_key_results) */
export interface OkrKeyResult {
  id: string;
  objective_id: string;
  title: string;
  target_value: number | null;
  current_value: number;
  unit: string | null;
  /** 自信度 0-100% */
  confidence: number;
  /** 期末スコア 0.0-1.0 */
  final_score: number | null;
  sort_order: number;
}

/** OKRチェックイン (okr_checkins) - 週次進捗更新 */
export interface OkrCheckin {
  id: string;
  key_result_id: string;
  member_id: string;
  checkin_date: string;
  value: number | null;
  confidence: number | null;
  note: string | null;
  blockers: string | null;
  created_at: string;
}

/** 評価期間-OKR期間中間テーブル (eval_period_okr_periods) */
export interface EvalPeriodOkrPeriod {
  eval_period_id: string;
  okr_period_id: string;
}
