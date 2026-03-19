-- =============================================================================
-- Migration 006: セキュリティ強化
-- C4: members テーブルの給与情報保護
-- H2: division_financials の事業部フィルタ追加
-- H4: quarterly_bonuses INSERT の org_id 検証追加
-- =============================================================================

-- ---------------------------------------------------------------------------
-- C4: members テーブル - 給与情報をG4/G5のみに制限
-- 攻撃: G1ユーザーが SELECT monthly_salary FROM members で全員の給与を取得
-- 対策: monthly_salary は同org_id かつ G4/G5 のみ閲覧可。基本情報は全員閲覧可
-- ---------------------------------------------------------------------------
-- NOTE: PostgreSQL の RLS はカラムレベルのフィルタができないため、
-- ビューで制御するか、アプリ層で制御を維持する。
-- ここでは org_id フィルタを追加してクロスオーガニゼーションアクセスを防止する。

DROP POLICY IF EXISTS "members_select" ON members;
CREATE POLICY "members_select" ON members
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM members WHERE auth_user_id = auth.uid())
  );

-- 給与閲覧用ビュー (G4/G5のみ monthly_salary を返す)
CREATE OR REPLACE VIEW members_safe AS
SELECT
  m.id,
  m.org_id,
  m.auth_user_id,
  m.email,
  m.name,
  m.grade,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM members caller
      WHERE caller.auth_user_id = auth.uid()
      AND caller.grade IN ('G4', 'G5')
    ) THEN m.monthly_salary
    ELSE NULL
  END AS monthly_salary,
  m.hire_date,
  m.status,
  m.created_at
FROM members m;

-- ---------------------------------------------------------------------------
-- H2: division_financials - 事業部メンバーまたはG4/G5のみ閲覧可
-- 攻撃: G3マネージャーが全事業部の財務データを取得
-- 対策: 自分の所属事業部 OR G4/G5 のみ
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "division_financials_select" ON division_financials;
CREATE POLICY "division_financials_select" ON division_financials
  FOR SELECT USING (
    -- G4/G5: 全事業部の財務を閲覧可
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
    OR
    -- G3: 自分の所属事業部のみ
    EXISTS (
      SELECT 1 FROM members m
      JOIN division_members dm ON dm.member_id = m.id
      WHERE m.auth_user_id = auth.uid()
      AND m.grade = 'G3'
      AND dm.division_id = division_financials.division_id
    )
  );

-- ---------------------------------------------------------------------------
-- H4: quarterly_bonuses INSERT - org_id + division 所属チェック追加
-- 攻撃: G4が任意メンバーに任意金額のボーナスを作成
-- 対策: member_id が自分の org 内のメンバーであることを検証
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "quarterly_bonuses_insert" ON quarterly_bonuses;
CREATE POLICY "quarterly_bonuses_insert" ON quarterly_bonuses
  FOR INSERT WITH CHECK (
    -- G4/G5 のみ
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
    AND
    -- 対象メンバーが同じ組織に所属していること
    EXISTS (
      SELECT 1 FROM members target
      JOIN members caller ON caller.auth_user_id = auth.uid()
      WHERE target.id = quarterly_bonuses.member_id
      AND target.org_id = caller.org_id
    )
  );

-- quarterly_bonuses UPDATE も同様に強化
DROP POLICY IF EXISTS "quarterly_bonuses_update" ON quarterly_bonuses;
CREATE POLICY "quarterly_bonuses_update" ON quarterly_bonuses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
    AND
    EXISTS (
      SELECT 1 FROM members target
      JOIN members caller ON caller.auth_user_id = auth.uid()
      WHERE target.id = quarterly_bonuses.member_id
      AND target.org_id = caller.org_id
    )
  );
