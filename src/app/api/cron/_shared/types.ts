// =============================================================================
// Cronルート用の型定義
// =============================================================================

/**
 * eval_periodsテーブルのCronクエリ結果行
 */
export interface EvalPeriodRow {
  id: string;
  org_id: string;
  name: string;
  end_date: string;
  status: string;
}

/**
 * okr_periodsテーブルのCronクエリ結果行
 */
export interface OkrPeriodRow {
  id: string;
  org_id: string;
  name: string;
  end_date: string;
  status: string;
}

/**
 * organizationsテーブルのCronクエリ結果行
 */
export interface OrganizationRow {
  id: string;
  name: string;
}
