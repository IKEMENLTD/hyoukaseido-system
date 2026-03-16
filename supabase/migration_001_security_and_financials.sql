-- =============================================================================
-- マイグレーション 001: セキュリティ強化 + 財務データ
-- 実行先: Supabase Dashboard > SQL Editor
-- 実行日: 2026-03-16
-- =============================================================================

-- =============================================
-- 1. members テーブルに email カラム追加
--    (auth/callback でのメンバー自動リンクに必要)
-- =============================================

ALTER TABLE members ADD COLUMN IF NOT EXISTS email TEXT;

-- 既存メンバーにauth.usersのメールを同期 (1回だけ実行)
UPDATE members m
SET email = u.email
FROM auth.users u
WHERE m.auth_user_id = u.id
  AND m.email IS NULL;

-- =============================================
-- 2. rank_thresholds テーブル新規作成
--    (管理画面からランク閾値・昇給額をカスタム設定)
-- =============================================

CREATE TABLE IF NOT EXISTS rank_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  rank TEXT NOT NULL CHECK (rank IN ('S', 'A', 'B', 'C', 'D')),
  min_score NUMERIC NOT NULL,
  salary_change INT NOT NULL,
  UNIQUE(org_id, rank)
);

ALTER TABLE rank_thresholds ENABLE ROW LEVEL SECURITY;

-- ポリシーが既存でなければ作成
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rank_thresholds' AND policyname = 'rank_thresholds_select'
  ) THEN
    CREATE POLICY "rank_thresholds_select" ON rank_thresholds
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rank_thresholds' AND policyname = 'rank_thresholds_modify'
  ) THEN
    CREATE POLICY "rank_thresholds_modify" ON rank_thresholds
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
        )
      );
  END IF;
END
$$;

-- =============================================
-- 3. division_financials テーブル新規作成
--    (事業部別月次財務データ)
-- =============================================

CREATE TABLE IF NOT EXISTS division_financials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES divisions(id),
  fiscal_year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  revenue BIGINT NOT NULL DEFAULT 0,
  cost BIGINT NOT NULL DEFAULT 0,
  gross_profit BIGINT
    GENERATED ALWAYS AS (revenue - cost) STORED,
  operating_cost BIGINT NOT NULL DEFAULT 0,
  net_profit BIGINT
    GENERATED ALWAYS AS (revenue - cost - operating_cost) STORED,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(division_id, fiscal_year, month)
);

ALTER TABLE division_financials ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'division_financials' AND policyname = 'division_financials_select'
  ) THEN
    CREATE POLICY "division_financials_select" ON division_financials
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G3', 'G4', 'G5')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'division_financials' AND policyname = 'division_financials_modify'
  ) THEN
    CREATE POLICY "division_financials_modify" ON division_financials
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
        )
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_division_financials_lookup
  ON division_financials(division_id, fiscal_year, month);

-- =============================================
-- 4. notification_channels の type 制約更新
--    (chatwork を追加)
-- =============================================

ALTER TABLE notification_channels
  DROP CONSTRAINT IF EXISTS notification_channels_type_check;

ALTER TABLE notification_channels
  ADD CONSTRAINT notification_channels_type_check
  CHECK (type IN ('slack', 'line', 'chatwork'));

-- =============================================
-- 5. 確認クエリ (実行結果を目視確認)
-- =============================================

-- 追加カラムの確認
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'members' AND column_name = 'email';

-- 新規テーブルの確認
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('rank_thresholds', 'division_financials')
ORDER BY tablename;

-- RLSの確認
SELECT tablename, policyname
FROM pg_policies
WHERE tablename IN ('rank_thresholds', 'division_financials')
ORDER BY tablename, policyname;

-- ChatWork制約の確認
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'notification_channels'::regclass
  AND conname LIKE '%type%';
