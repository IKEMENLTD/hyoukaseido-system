-- ============================================================
-- Migration 004: notification_channels に api_token カラム追加
-- ChatWork APIトークン / LINE チャネルアクセストークンを
-- 環境変数ではなくDB管理に移行
-- ============================================================

ALTER TABLE notification_channels
  ADD COLUMN IF NOT EXISTS api_token TEXT;

COMMENT ON COLUMN notification_channels.api_token IS
  'ChatWork APIトークン / LINE チャネルアクセストークン。Slackの場合はNULL（Webhook URLに認証情報が含まれるため不要）';
