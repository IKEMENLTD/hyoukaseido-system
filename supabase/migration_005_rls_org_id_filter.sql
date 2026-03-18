-- ============================================================
-- Migration 005: RLSポリシーにorg_idフィルタを追加
-- マルチテナント対応: 他組織のデータが見えないように修正
-- ============================================================

BEGIN;

-- === 1. divisions (org_id直接) ===
DROP POLICY IF EXISTS "divisions_select" ON divisions;
CREATE POLICY "divisions_select" ON divisions
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM members WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "divisions_modify" ON divisions;
CREATE POLICY "divisions_modify" ON divisions
  FOR ALL USING (
    org_id IN (SELECT org_id FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5'))
  );

-- === 2. division_members (division_id経由) ===
DROP POLICY IF EXISTS "division_members_select" ON division_members;
CREATE POLICY "division_members_select" ON division_members
  FOR SELECT USING (
    division_id IN (SELECT id FROM divisions WHERE org_id IN (SELECT org_id FROM members WHERE auth_user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "division_members_modify" ON division_members;
CREATE POLICY "division_members_modify" ON division_members
  FOR ALL USING (
    division_id IN (SELECT id FROM divisions WHERE org_id IN (SELECT org_id FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')))
  );

-- === 3. grade_definitions (org_id直接) ===
DROP POLICY IF EXISTS "grade_definitions_select" ON grade_definitions;
CREATE POLICY "grade_definitions_select" ON grade_definitions
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM members WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "grade_definitions_modify" ON grade_definitions;
CREATE POLICY "grade_definitions_modify" ON grade_definitions
  FOR ALL USING (
    org_id IN (SELECT org_id FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5'))
  );

-- === 4. kpi_templates (division_id経由) ===
DROP POLICY IF EXISTS "kpi_templates_select" ON kpi_templates;
CREATE POLICY "kpi_templates_select" ON kpi_templates
  FOR SELECT USING (
    division_id IN (SELECT id FROM divisions WHERE org_id IN (SELECT org_id FROM members WHERE auth_user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "kpi_templates_modify" ON kpi_templates;
CREATE POLICY "kpi_templates_modify" ON kpi_templates
  FOR ALL USING (
    division_id IN (SELECT id FROM divisions WHERE org_id IN (SELECT org_id FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')))
  );

-- === 5. kpi_items (template_id -> kpi_templates.division_id経由) ===
DROP POLICY IF EXISTS "kpi_items_select" ON kpi_items;
CREATE POLICY "kpi_items_select" ON kpi_items
  FOR SELECT USING (
    template_id IN (SELECT id FROM kpi_templates WHERE division_id IN (SELECT id FROM divisions WHERE org_id IN (SELECT org_id FROM members WHERE auth_user_id = auth.uid())))
  );

DROP POLICY IF EXISTS "kpi_items_modify" ON kpi_items;
CREATE POLICY "kpi_items_modify" ON kpi_items
  FOR ALL USING (
    template_id IN (SELECT id FROM kpi_templates WHERE division_id IN (SELECT id FROM divisions WHERE org_id IN (SELECT org_id FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5'))))
  );

-- === 6. value_items (org_id直接) ===
DROP POLICY IF EXISTS "value_items_select" ON value_items;
CREATE POLICY "value_items_select" ON value_items
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM members WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "value_items_modify" ON value_items;
CREATE POLICY "value_items_modify" ON value_items
  FOR ALL USING (
    org_id IN (SELECT org_id FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5'))
  );

-- === 7. behavior_items (template_id -> kpi_templates.division_id経由) ===
DROP POLICY IF EXISTS "behavior_items_select" ON behavior_items;
CREATE POLICY "behavior_items_select" ON behavior_items
  FOR SELECT USING (
    template_id IN (SELECT id FROM kpi_templates WHERE division_id IN (SELECT id FROM divisions WHERE org_id IN (SELECT org_id FROM members WHERE auth_user_id = auth.uid())))
  );

DROP POLICY IF EXISTS "behavior_items_modify" ON behavior_items;
CREATE POLICY "behavior_items_modify" ON behavior_items
  FOR ALL USING (
    template_id IN (SELECT id FROM kpi_templates WHERE division_id IN (SELECT id FROM divisions WHERE org_id IN (SELECT org_id FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5'))))
  );

-- === 8. crosssell_routes (org_id直接) ===
DROP POLICY IF EXISTS "crosssell_routes_select" ON crosssell_routes;
CREATE POLICY "crosssell_routes_select" ON crosssell_routes
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM members WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "crosssell_routes_modify" ON crosssell_routes;
CREATE POLICY "crosssell_routes_modify" ON crosssell_routes
  FOR ALL USING (
    org_id IN (SELECT org_id FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5'))
  );

-- === 9. eval_periods (org_id直接) ===
DROP POLICY IF EXISTS "eval_periods_select" ON eval_periods;
CREATE POLICY "eval_periods_select" ON eval_periods
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM members WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "eval_periods_modify" ON eval_periods;
CREATE POLICY "eval_periods_modify" ON eval_periods
  FOR ALL USING (
    org_id IN (SELECT org_id FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5'))
  );

-- === 10. okr_periods (org_id直接) ===
DROP POLICY IF EXISTS "okr_periods_select" ON okr_periods;
CREATE POLICY "okr_periods_select" ON okr_periods
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM members WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "okr_periods_modify" ON okr_periods;
CREATE POLICY "okr_periods_modify" ON okr_periods
  FOR ALL USING (
    org_id IN (SELECT org_id FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5'))
  );

COMMIT;
