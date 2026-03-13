// =============================================================================
// 通知関連の型定義
// LINE/Slack通知送信ユーティリティ用
// =============================================================================

/**
 * 設計書Section 9に定義された15種の通知イベント
 */
export type NotificationEvent =
  | 'eval_period_start'
  | 'eval_submitted'
  | 'eval_submission_reminder'
  | 'manager_eval_request'
  | 'calibration_start'
  | 'calibration_complete'
  | 'feedback_ready'
  | 'okr_period_start'
  | 'okr_checkin_reminder'
  | 'okr_review_deadline'
  | 'crosssell_toss'
  | 'crosssell_contracted'
  | 'bonus_confirmed'
  | 'one_on_one_reminder'
  | 'win_session_reminder';

/**
 * 通知送信時のペイロード
 */
export interface NotificationPayload {
  event: NotificationEvent;
  title: string;
  message: string;
  url?: string;
  metadata?: Record<string, string>;
}

/**
 * notification_channelsテーブルの行をマッピングした型
 */
export interface NotificationChannel {
  id: string;
  type: 'slack' | 'line';
  webhookUrl: string;
  events: string[];
}

/**
 * 通知送信結果
 */
export interface NotificationResult {
  channelId: string;
  success: boolean;
  error?: string;
}

/**
 * notification_channelsテーブルのDB行型
 */
export interface NotificationChannelRow {
  id: string;
  type: 'slack' | 'line';
  webhook_url: string;
  events: string[];
}
