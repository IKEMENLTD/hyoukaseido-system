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
  type: 'slack' | 'line' | 'chatwork';
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
  type: 'slack' | 'line' | 'chatwork';
  webhook_url: string;
  events: string[];
}

/**
 * oauth_account_linksテーブルの行型
 * 個人DM通知のOAuth連携情報
 */
export interface OAuthAccountLinkRow {
  id: string;
  member_id: string;
  provider: 'slack' | 'line' | 'chatwork';
  provider_user_id: string;
  provider_display_name: string | null;
  provider_team_id: string | null;
  dm_room_id: string | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
}

/**
 * notification_preferencesテーブルの個人通知設定行型
 */
export interface NotificationPreferenceRow {
  member_id: string;
  slack_enabled: boolean;
  line_enabled: boolean;
  chatwork_enabled: boolean;
}

/**
 * 個人DM通知の送信結果
 */
export interface PersonalNotificationResult {
  channel_id: string;
  success: boolean;
  error?: string;
}
