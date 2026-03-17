-- ============================================================
-- Migration 003: 共通固定費テーブル (shared_costs)
-- 家賃・人件費・交際費・コンサル費・借入返済・利息・その他を月次管理
-- ============================================================

CREATE TABLE shared_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  fiscal_year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  category TEXT NOT NULL CHECK (category IN (
    'rent', 'personnel', 'entertainment', 'consulting',
    'loan_repayment', 'interest', 'other'
  )),
  label TEXT NOT NULL,
  amount BIGINT NOT NULL DEFAULT 0,
  is_loan BOOLEAN NOT NULL DEFAULT false,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE shared_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shared_costs_select" ON shared_costs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G3','G4','G5'))
  );

CREATE POLICY "shared_costs_modify" ON shared_costs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4','G5'))
  );

CREATE INDEX idx_shared_costs_lookup ON shared_costs(org_id, fiscal_year, month);
