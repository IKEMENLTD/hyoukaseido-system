-- ============================================================
-- Migration 004: notification_channels に api_token カラム追加
-- ChatWork APIトークン / LINE チャネルアクセストークンを
-- 環境変数ではなくDB管理に移行
-- ============================================================

ALTER TABLE notification_channels
  ADD COLUMN IF NOT EXISTS api_token TEXT;

COMMENT ON COLUMN notification_channels.api_token IS
  'ChatWork APIトークン / LINE チャネルアクセストークン。Slackの場合はNULL（Webhook URLに認証情報が含まれるため不要）';

-- RLSポリシーにorg_idフィルタを追加（他組織のチャンネルを操作不可に）
DROP POLICY IF EXISTS "notification_channels_select" ON notification_channels;
CREATE POLICY "notification_channels_select" ON notification_channels
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM members WHERE auth_user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

DROP POLICY IF EXISTS "notification_channels_insert" ON notification_channels;
CREATE POLICY "notification_channels_insert" ON notification_channels
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM members WHERE auth_user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

DROP POLICY IF EXISTS "notification_channels_update" ON notification_channels;
CREATE POLICY "notification_channels_update" ON notification_channels
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM members WHERE auth_user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

DROP POLICY IF EXISTS "notification_channels_delete" ON notification_channels;
CREATE POLICY "notification_channels_delete" ON notification_channels
  FOR DELETE USING (
    org_id IN (SELECT org_id FROM members WHERE auth_user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );
