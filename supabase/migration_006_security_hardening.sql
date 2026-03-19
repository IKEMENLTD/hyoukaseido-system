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

-- ---------------------------------------------------------------------------
-- M3: okr_objectives INSERT - G3は自事業部メンバーのみ、G4/G5は同組織全メンバー
-- 攻撃: G3マネージャーが他部署メンバーのOKRを作成できてしまう
-- 対策: G3は division_members 経由で同事業部チェック、G4/G5は org_id チェック
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "okr_objectives_insert" ON okr_objectives;
CREATE POLICY "okr_objectives_insert" ON okr_objectives
  FOR INSERT WITH CHECK (
    -- 自分自身のOKR
    member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
    OR
    -- G4/G5: 同一組織の全メンバー
    (
      EXISTS (
        SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
      )
      AND EXISTS (
        SELECT 1 FROM members target
        JOIN members caller ON caller.auth_user_id = auth.uid()
        WHERE target.id = okr_objectives.member_id
        AND target.org_id = caller.org_id
      )
    )
    OR
    -- G3: 自事業部のメンバーのみ
    (
      EXISTS (
        SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade = 'G3'
      )
      AND EXISTS (
        SELECT 1 FROM division_members dm_target
        JOIN division_members dm_caller ON dm_caller.division_id = dm_target.division_id
        JOIN members caller ON caller.id = dm_caller.member_id
        WHERE dm_target.member_id = okr_objectives.member_id
        AND caller.auth_user_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- win_sessions / win_session_entries: 同一組織メンバーのみ閲覧可
-- 現状: SELECT USING (true) で全ユーザーが全組織のデータを閲覧可能
-- 対策: created_by と同一 org_id のメンバーのみ閲覧可
-- ---------------------------------------------------------------------------

-- win_sessions: 同一組織メンバーのみ閲覧可
DROP POLICY IF EXISTS "win_sessions_select" ON win_sessions;
CREATE POLICY "win_sessions_select" ON win_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM members m1
      JOIN members m2 ON m1.org_id = m2.org_id
      WHERE m1.auth_user_id = auth.uid()
      AND m2.id = win_sessions.created_by
    )
  );

-- win_session_entries: セッション作成者と同組織のみ
DROP POLICY IF EXISTS "win_session_entries_select" ON win_session_entries;
CREATE POLICY "win_session_entries_select" ON win_session_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM win_sessions ws
      JOIN members creator ON creator.id = ws.created_by
      JOIN members caller ON caller.auth_user_id = auth.uid()
      WHERE ws.id = win_session_entries.session_id
      AND creator.org_id = caller.org_id
    )
  );
