// =============================================================================
// 評価制度システム - 評価関連型定義
// ARCHITECTURE.md セクション4-2 データベース設計に準拠
// =============================================================================

// -----------------------------------------------------------------------------
// 列挙型 (Union Types)
// -----------------------------------------------------------------------------

/** 事業部フェーズ: 黒字 or 赤字 */
export type Phase = 'profitable' | 'investing';

/** 評価ランク: S/A/B/C/D の5段階 */
export type Rank = 'S' | 'A' | 'B' | 'C' | 'D';

/** 等級: G1(メンバー) ~ G5(代表) */
export type Grade = 'G1' | 'G2' | 'G3' | 'G4' | 'G5';

/** 昇格適格性 */
export type PromotionEligibility = 'immediate' | 'candidate' | 'none';

/** 評価期間ステータス (planning -> ... -> closed) */
export type EvalPeriodStatus =
  | 'planning'
  | 'target_setting'
  | 'self_eval'
  | 'manager_eval'
  | 'calibration'
  | 'feedback'
  | 'closed';

/** 個別評価ステータス */
export type EvaluationStatus =
  | 'draft'
  | 'self_submitted'
  | 'manager_submitted'
  | 'calibrated'
  | 'feedback_done'
  | 'finalized';

/**
 * 行動評価スコア: 4段階
 * 1 = x (不十分), 2 = △ (やや不足), 3 = ○ (基準達成), 4 = ◎ (期待超え)
 */
export type BehaviorScore = 1 | 2 | 3 | 4;

/** メンバーステータス */
export type MemberStatus = 'active' | 'inactive';

/** 評価期間の半期 */
export type Half = 'H1' | 'H2';

/** KPIテンプレートの評価種別 */
export type EvalType = 'quantitative' | 'qualitative' | 'value';

/** 1on1ミーティングの種別 */
export type MeetingType =
  | 'weekly_checkin'
  | 'monthly_1on1'
  | 'quarterly_review'
  | 'semi_annual_feedback';

/** 改善計画のレビュー頻度 */
export type ReviewFrequency = 'weekly' | 'monthly';

/** 改善計画ステータス */
export type ImprovementPlanStatus = 'active' | 'completed' | 'cancelled';

/** 四半期ボーナスの種別 */
export type BonusType = 'kpi_achievement' | 'okr_stretch' | 'special';

/** 四半期ボーナスステータス */
export type BonusStatus = 'pending' | 'approved' | 'paid';

// -----------------------------------------------------------------------------
// フェーズ別評価ウェイト定数
// -----------------------------------------------------------------------------

/** フェーズ別の評価配分ウェイト */
export const PHASE_WEIGHTS: Record<Phase, EvalWeights> = {
  profitable: { quantitative: 50, qualitative: 30, value: 20 },
  investing: { quantitative: 30, qualitative: 45, value: 25 },
} as const;

// -----------------------------------------------------------------------------
// インターフェース: 組織・メンバー
// -----------------------------------------------------------------------------

/** 組織 (organizations) */
export interface Organization {
  id: string;
  name: string;
  fiscal_year_start: number;
  created_at: string;
}

/** 事業部 (divisions) */
export interface Division {
  id: string;
  org_id: string;
  name: string;
  phase: Phase;
  mission: string | null;
  created_at: string;
}

/** メンバー (members) */
export interface Member {
  id: string;
  org_id: string;
  auth_user_id: string | null;
  name: string;
  grade: Grade;
  monthly_salary: number;
  hire_date: string | null;
  status: MemberStatus;
  created_at: string;
}

/** 事業部メンバー中間テーブル (division_members) */
export interface DivisionMember {
  id: string;
  member_id: string;
  division_id: string;
  role: string;
  weight: number;
  is_primary: boolean;
  is_head: boolean;
}

// -----------------------------------------------------------------------------
// インターフェース: 等級・KPIテンプレート
// -----------------------------------------------------------------------------

/** 等級定義 (grade_definitions) */
export interface GradeDefinition {
  id: string;
  org_id: string;
  grade: Grade;
  name: string;
  salary_range_min: number | null;
  salary_range_max: number | null;
  description: string | null;
  expected_multiplier: number | null;
}

/** KPIテンプレート (kpi_templates) */
export interface KpiTemplate {
  id: string;
  division_id: string;
  role: string;
  eval_type: EvalType | null;
  version: number;
  is_active: boolean;
  created_at: string;
}

/** KPI項目 (kpi_items) */
export interface KpiItem {
  id: string;
  template_id: string;
  name: string;
  description: string | null;
  weight: number;
  measurement_unit: string | null;
  threshold_s: number | null;
  threshold_a: number | null;
  threshold_b: number | null;
  threshold_c: number | null;
  sort_order: number;
}

/** バリュー評価項目 (value_items) - 全社共通 */
export interface ValueItem {
  id: string;
  org_id: string;
  name: string;
  definition: string;
  axis: string | null;
  max_score: number;
  sort_order: number;
}

/** 行動評価項目 (behavior_items) - 事業部x職種別 */
export interface BehaviorItem {
  id: string;
  template_id: string;
  name: string;
  criteria: string;
  max_score: number;
  sort_order: number;
}

// -----------------------------------------------------------------------------
// インターフェース: 評価期間・評価
// -----------------------------------------------------------------------------

/** 評価期間 (eval_periods) */
export interface EvalPeriod {
  id: string;
  org_id: string;
  name: string;
  half: Half | null;
  fiscal_year: number | null;
  start_date: string;
  end_date: string;
  status: EvalPeriodStatus;
}

/** 評価レコード (evaluations) */
export interface Evaluation {
  id: string;
  eval_period_id: string;
  member_id: string;
  evaluator_id: string;
  division_id: string;
  grade_at_eval: Grade;
  salary_at_eval: number;
  phase_at_eval: Phase;
  quantitative_weight: number;
  qualitative_weight: number;
  value_weight: number;
  quantitative_score: number | null;
  qualitative_score: number | null;
  value_score: number | null;
  total_score: number | null;
  rank: Rank | null;
  upper_behavior_bonus: number;
  promotion_eligibility: PromotionEligibility;
  evaluator_comment: string | null;
  self_comment: string | null;
  next_actions: string | null;
  salary_change_recommended: number | null;
  promotion_recommended: boolean;
  status: EvaluationStatus;
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// インターフェース: 評価スコア詳細
// -----------------------------------------------------------------------------

/** 定量KPIスコア (eval_kpi_scores) */
export interface EvalKpiScore {
  id: string;
  evaluation_id: string;
  kpi_item_id: string;
  target_value: number | null;
  actual_value: number | null;
  /** DB側でGENERATED ALWAYS AS計算される達成率 (読み取り専用) */
  achievement_rate: number | null;
  rank: Rank | null;
  note: string | null;
}

/** 定性行動評価スコア (eval_behavior_scores) */
export interface EvalBehaviorScore {
  id: string;
  evaluation_id: string;
  behavior_item_id: string;
  self_score: BehaviorScore | null;
  manager_score: BehaviorScore | null;
  final_score: BehaviorScore | null;
  is_upper_grade_behavior: boolean;
  comment: string | null;
}

/** バリュー評価スコア (eval_value_scores) */
export interface EvalValueScore {
  id: string;
  evaluation_id: string;
  value_item_id: string;
  self_score: number | null;
  manager_score: number | null;
  final_score: number | null;
  evidence: string | null;
}

// -----------------------------------------------------------------------------
// インターフェース: 改善計画
// -----------------------------------------------------------------------------

/** 改善計画マイルストーン (JSONBカラムの型) */
export interface ImprovementMilestone {
  title: string;
  due_date: string;
  completed: boolean;
}

/** 改善計画 (improvement_plans) */
export interface ImprovementPlan {
  id: string;
  evaluation_id: string;
  member_id: string;
  manager_id: string;
  plan_description: string;
  milestones: ImprovementMilestone[] | null;
  review_frequency: ReviewFrequency;
  start_date: string;
  end_date: string | null;
  status: ImprovementPlanStatus;
  outcome: string | null;
  created_at: string;
}

// -----------------------------------------------------------------------------
// インターフェース: 四半期ボーナス
// -----------------------------------------------------------------------------

/** 四半期ボーナス (quarterly_bonuses) */
export interface QuarterlyBonus {
  id: string;
  okr_period_id: string;
  member_id: string;
  division_id: string;
  bonus_type: BonusType;
  amount: number;
  calculation_basis: string | null;
  approved_by: string | null;
  status: BonusStatus;
  created_at: string;
}

// -----------------------------------------------------------------------------
// インターフェース: 1on1・面談記録
// -----------------------------------------------------------------------------

/** 1on1面談記録 (one_on_ones) */
export interface OneOnOne {
  id: string;
  member_id: string;
  manager_id: string;
  meeting_date: string;
  meeting_type: MeetingType | null;
  okr_progress: string | null;
  blockers: string | null;
  action_items: string | null;
  notes: string | null;
  created_at: string;
}

// -----------------------------------------------------------------------------
// インターフェース: ウィンセッション
// -----------------------------------------------------------------------------

/** ウィンセッション (win_sessions) */
export interface WinSession {
  id: string;
  org_id: string;
  session_date: string;
  facilitator_id: string | null;
  created_at: string;
}

/** ウィンセッションエントリー (win_session_entries) */
export interface WinSessionEntry {
  id: string;
  session_id: string;
  member_id: string;
  division_id: string | null;
  win_description: string;
  category: string | null;
  created_at: string;
}

// -----------------------------------------------------------------------------
// インターフェース: 評価エンジン用
// -----------------------------------------------------------------------------

/** 評価ウェイト配分 */
export interface EvalWeights {
  quantitative: number;
  qualitative: number;
  value: number;
}

/** KPI基準値閾値 (達成率%) */
export interface KPIThresholds {
  s: number;
  a: number;
  b: number;
  c: number;
}

// -----------------------------------------------------------------------------
// ランク判定閾値定数
// -----------------------------------------------------------------------------

/** 総合スコアからランクへの変換閾値 */
export const RANK_THRESHOLDS: ReadonlyArray<{ readonly min: number; readonly rank: Rank }> = [
  { min: 90, rank: 'S' },
  { min: 80, rank: 'A' },
  { min: 60, rank: 'B' },
  { min: 40, rank: 'C' },
  { min: 0, rank: 'D' },
] as const;

/** ランク別昇給額 (円) */
export const SALARY_CHANGE: Readonly<Record<Rank, number>> = {
  S: 50000,
  A: 30000,
  B: 0,
  C: -20000,
  D: -50000,
} as const;
