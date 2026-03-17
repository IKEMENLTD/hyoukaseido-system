-- ============================================================
-- Migration 002: OAuth Account Links
-- Slack/LINE/ChatWork のアカウント連携テーブル
-- ============================================================

-- OAuth Account Links
CREATE TABLE oauth_account_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('slack', 'line', 'chatwork')),
  provider_user_id TEXT NOT NULL,
  provider_display_name TEXT,
  provider_team_id TEXT,
  dm_room_id TEXT,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  linked_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (member_id, provider)
);

ALTER TABLE oauth_account_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oauth_links_select" ON oauth_account_links
  FOR SELECT USING (
    member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "oauth_links_delete" ON oauth_account_links
  FOR DELETE USING (
    member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
  );

-- chatwork_enabled追加
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS chatwork_enabled BOOLEAN DEFAULT false;
