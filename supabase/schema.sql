-- ============================================================
-- 評価制度システム v2.0 データベーススキーマ
-- ============================================================

-- ============================================================
-- 組織・メンバー
-- ============================================================

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                        -- 'イケメングループ'
  fiscal_year_start INT DEFAULT 4,           -- 4月始まり
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE divisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,                        -- 'システム開発事業部'
  phase TEXT NOT NULL CHECK (phase IN ('profitable', 'investing'))
    DEFAULT 'investing',                     -- 黒字/赤字
  mission TEXT,                              -- 'プロダクト品質'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  auth_user_id UUID REFERENCES auth.users(id),  -- Supabase Auth連携
  name TEXT NOT NULL,
  grade TEXT CHECK (grade IN ('G1', 'G2', 'G3', 'G4', 'G5')) NOT NULL,
  monthly_salary INT NOT NULL,               -- 月給（円）
  hire_date DATE,
  status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- メンバー×事業部の多対多（ウェイト付き）
CREATE TABLE division_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES members(id),
  division_id UUID REFERENCES divisions(id),
  role TEXT NOT NULL,                        -- 'sales', 'engineer', 'cs', 'bd', ...
  weight INT DEFAULT 100,                    -- 事業部への関与度（%）
  is_primary BOOLEAN DEFAULT true,
  is_head BOOLEAN DEFAULT false,             -- 事業部長フラグ
  UNIQUE(member_id, division_id)
);

-- ============================================================
-- 等級・KPIテンプレート（可変レイヤーの定義）
-- ============================================================

CREATE TABLE grade_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  grade TEXT NOT NULL,                       -- 'G1', 'G2', 'G3', 'G4', 'G5'
  name TEXT NOT NULL,                        -- 'メンバー', 'シニア', 'マネージャー', '事業部長', '代表'
  salary_range_min INT,
  salary_range_max INT,
  description TEXT,                          -- 期待役割
  expected_multiplier NUMERIC,               -- 参考指標。ダッシュボードで期待貢献利益を表示するためのみに使用
  UNIQUE(org_id, grade)
);

-- 事業部×職種ごとのKPIテンプレート
CREATE TABLE kpi_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID REFERENCES divisions(id),
  role TEXT NOT NULL,                        -- 'sales', 'engineer', ...
  eval_type TEXT CHECK (eval_type IN ('quantitative', 'qualitative', 'value')),
  version INT DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(division_id, role, eval_type, version)
);

CREATE TABLE kpi_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES kpi_templates(id),
  name TEXT NOT NULL,                        -- '受注売上'
  description TEXT,                          -- 'S:130%以上 / A:115% / ...'
  weight INT NOT NULL,                       -- ウェイト（%）
  measurement_unit TEXT,                     -- '円', '件', '%'
  threshold_s NUMERIC,                       -- S基準値
  threshold_a NUMERIC,                       -- A基準値
  threshold_b NUMERIC,                       -- B基準値
  threshold_c NUMERIC,                       -- C基準値
  sort_order INT DEFAULT 0
);

-- バリュー評価項目（全社共通）
CREATE TABLE value_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,                        -- 'Be Bold'
  definition TEXT NOT NULL,                  -- '失敗を恐れず、大胆に挑戦する'
  axis TEXT,                                 -- '外面'
  max_score INT DEFAULT 7,
  sort_order INT DEFAULT 0
);

-- 行動評価項目（事業部×職種別）
CREATE TABLE behavior_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES kpi_templates(id),
  name TEXT NOT NULL,                        -- '提案の質'
  criteria TEXT NOT NULL,                    -- '補助金×開発のクロスセル提案ができているか'
  max_score INT DEFAULT 10,
  sort_order INT DEFAULT 0
);

-- ============================================================
-- OKRレイヤー（四半期サイクル）
-- ============================================================

CREATE TABLE okr_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,                        -- '2026 Q1'
  quarter INT NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  fiscal_year INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT CHECK (status IN ('planning', 'active', 'reviewing', 'closed'))
    DEFAULT 'planning',
  UNIQUE(org_id, fiscal_year, quarter)
);

CREATE TABLE okr_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  okr_period_id UUID REFERENCES okr_periods(id),
  member_id UUID REFERENCES members(id),
  division_id UUID REFERENCES divisions(id),
  level TEXT CHECK (level IN ('company', 'division', 'individual')),
  title TEXT NOT NULL,                       -- Objective本文
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE okr_key_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id UUID REFERENCES okr_objectives(id),
  title TEXT NOT NULL,                       -- KR本文
  target_value NUMERIC,                      -- 目標値
  current_value NUMERIC DEFAULT 0,           -- 現在値
  unit TEXT,                                 -- '件', '%', '社'
  confidence INT DEFAULT 50,                 -- 自信度（0-100%）
  final_score NUMERIC,                       -- 期末スコア（0.0-1.0）
  sort_order INT DEFAULT 0
);

CREATE TABLE okr_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_result_id UUID REFERENCES okr_key_results(id),
  member_id UUID REFERENCES members(id),
  checkin_date DATE NOT NULL,
  value NUMERIC,                             -- その週の進捗値
  confidence INT,                            -- 更新された自信度
  note TEXT,                                 -- コメント
  blockers TEXT,                             -- 障壁
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 査定レイヤー（半期サイクル）
-- ============================================================

CREATE TABLE eval_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,                        -- '2026年 H1'
  half TEXT CHECK (half IN ('H1', 'H2')),
  fiscal_year INT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  -- ステータス遷移:
  --   planning       : 期間設定・準備中
  --   target_setting : 目標設定期間（KPI目標値・行動目標を各メンバーが入力）
  --   self_eval      : 自己評価入力期間
  --   manager_eval   : 上長評価入力期間
  --   calibration    : 全社キャリブレーション（G4/代表が評価調整）
  --   feedback       : フィードバック面談期間
  --   closed         : 確定・クローズ
  status TEXT CHECK (status IN (
    'planning', 'target_setting', 'self_eval', 'manager_eval',
    'calibration', 'feedback', 'closed'
  )) DEFAULT 'planning',
  UNIQUE(org_id, fiscal_year, half)
);

-- 評価期間とOKR四半期の中間テーブル（半期に含まれるOKR四半期を関連付け）
CREATE TABLE eval_period_okr_periods (
  eval_period_id UUID NOT NULL REFERENCES eval_periods(id),
  okr_period_id UUID NOT NULL REFERENCES okr_periods(id),
  PRIMARY KEY (eval_period_id, okr_period_id)
);

CREATE TABLE evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eval_period_id UUID REFERENCES eval_periods(id),
  member_id UUID REFERENCES members(id),
  evaluator_id UUID REFERENCES members(id),
  division_id UUID REFERENCES divisions(id),   -- メイン事業部
  grade_at_eval TEXT NOT NULL,                  -- 評価時点の等級
  salary_at_eval INT NOT NULL,                  -- 評価時点の月給

  -- 評価作成時の事業部フェーズをスナップショット保存
  -- ※ 期中のフェーズ変更は既存評価に影響しない。評価作成時点のフェーズで固定
  phase_at_eval TEXT NOT NULL CHECK (phase_at_eval IN ('profitable', 'investing')),

  -- フェーズ別配分（事業部のphaseから自動設定）
  quantitative_weight INT NOT NULL,             -- 50 or 30
  qualitative_weight INT NOT NULL,              -- 30 or 45
  value_weight INT NOT NULL,                    -- 20 or 25
  CHECK (quantitative_weight + qualitative_weight + value_weight = 100),

  -- スコア（評価エンジンが算出）
  quantitative_score NUMERIC,                   -- 0-100
  qualitative_score NUMERIC,                    -- 0-100
  value_score NUMERIC,                          -- 0-100
  total_score NUMERIC,                          -- 加重合計

  -- ランク
  rank TEXT CHECK (rank IN ('S', 'A', 'B', 'C', 'D')),

  -- 上位等級行動ボーナス（0: なし, 1: +1段階, 2: +2段階）
  upper_behavior_bonus INT DEFAULT 0 CHECK (upper_behavior_bonus BETWEEN 0 AND 2),

  -- 昇格判定
  promotion_eligibility TEXT CHECK (promotion_eligibility IN ('immediate', 'candidate', 'none')) DEFAULT 'none',

  -- コメント
  evaluator_comment TEXT,
  self_comment TEXT,
  next_actions TEXT,

  -- 処遇
  salary_change_recommended INT,                -- 推奨昇給額
  promotion_recommended BOOLEAN DEFAULT false,

  -- ステータス
  status TEXT CHECK (status IN (
    'draft', 'self_submitted', 'manager_submitted',
    'calibrated', 'feedback_done', 'finalized'
  )) DEFAULT 'draft',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(eval_period_id, member_id, division_id)
);

-- 定量KPIスコア（事業部×職種のKPI項目ごと）
CREATE TABLE eval_kpi_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID REFERENCES evaluations(id),
  kpi_item_id UUID REFERENCES kpi_items(id),
  target_value NUMERIC,                        -- 目標値
  actual_value NUMERIC,                        -- 実績値
  achievement_rate NUMERIC                     -- 達成率（自動計算）
    GENERATED ALWAYS AS (
      CASE WHEN target_value > 0
        THEN actual_value / target_value * 100
        ELSE NULL
      END
    ) STORED,
  rank TEXT CHECK (rank IN ('S', 'A', 'B', 'C', 'D')),
  note TEXT,
  UNIQUE(evaluation_id, kpi_item_id)
);

-- 定性行動評価スコア
-- 4段階評価: x=1, △=2, ○=3, ◎=4
CREATE TABLE eval_behavior_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID REFERENCES evaluations(id),
  behavior_item_id UUID REFERENCES behavior_items(id),
  self_score INT CHECK (self_score BETWEEN 1 AND 4),         -- 自己評価
  manager_score INT CHECK (manager_score BETWEEN 1 AND 4),   -- 上長評価
  final_score INT CHECK (final_score BETWEEN 1 AND 4),       -- 確定スコア
  is_upper_grade_behavior BOOLEAN DEFAULT false,              -- 上位等級行動フラグ
  comment TEXT,
  UNIQUE(evaluation_id, behavior_item_id)
);

-- バリュー評価スコア
CREATE TABLE eval_value_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID REFERENCES evaluations(id),
  value_item_id UUID REFERENCES value_items(id),
  self_score INT,                              -- 自己評価（/7）
  manager_score INT,                           -- 上長評価（/7）
  final_score INT,                             -- 確定スコア
  evidence TEXT,                               -- 根拠エピソード
  UNIQUE(evaluation_id, value_item_id)
);

-- ============================================================
-- クロスセルボーナス
-- ============================================================

-- クロスセル経路定義
CREATE TABLE crosssell_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  from_division_id UUID REFERENCES divisions(id),
  to_division_id UUID REFERENCES divisions(id),
  condition TEXT NOT NULL,                     -- '契約先が補助金申請に至った場合'
  toss_bonus_rate NUMERIC NOT NULL,            -- トス元ボーナス率（0.05 = 5%）
  receive_bonus_rate NUMERIC NOT NULL,         -- 受注側ボーナス率（0.025 = 2.5%）
  is_active BOOLEAN DEFAULT true,
  UNIQUE(from_division_id, to_division_id, condition)
);

-- トスアップ実績
CREATE TABLE crosssell_tosses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID REFERENCES crosssell_routes(id),
  tosser_id UUID REFERENCES members(id),       -- トスした人
  receiver_id UUID REFERENCES members(id),     -- 受けた人
  toss_date DATE NOT NULL,
  status TEXT CHECK (status IN (
    'tossed', 'in_progress', 'contracted', 'cancelled'
  )) DEFAULT 'tossed',
  gross_profit NUMERIC,                        -- 粗利（確定後に入力）
  -- トス登録時にレートをスナップショット保存（経路定義変更の影響を受けない）
  toss_bonus_rate NUMERIC NOT NULL,            -- トス元ボーナス率スナップショット
  receive_bonus_rate NUMERIC NOT NULL,         -- 受注側ボーナス率スナップショット
  toss_bonus NUMERIC                           -- トス元ボーナス（自動計算）
    GENERATED ALWAYS AS (gross_profit * toss_bonus_rate) STORED,
  receive_bonus NUMERIC                        -- 受注側ボーナス（自動計算）
    GENERATED ALWAYS AS (gross_profit * receive_bonus_rate) STORED,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 1on1・面談記録
-- ============================================================

CREATE TABLE one_on_ones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES members(id),
  manager_id UUID REFERENCES members(id),
  meeting_date DATE NOT NULL,
  meeting_type TEXT CHECK (meeting_type IN (
    'weekly_checkin', 'monthly_1on1', 'quarterly_review', 'semi_annual_feedback'
  )),
  okr_progress TEXT,                          -- OKR進捗メモ
  blockers TEXT,                              -- 課題・障壁
  action_items TEXT,                          -- 次アクション
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 改善計画（C/D評価時の改善計画管理）
-- ============================================================

CREATE TABLE improvement_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES evaluations(id),
  member_id UUID NOT NULL REFERENCES members(id),
  manager_id UUID NOT NULL REFERENCES members(id),
  plan_description TEXT NOT NULL,
  milestones JSONB,
  review_frequency TEXT CHECK (review_frequency IN ('weekly', 'monthly')) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT CHECK (status IN ('active', 'completed', 'cancelled')) DEFAULT 'active',
  outcome TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 四半期インセンティブ
-- ============================================================

CREATE TABLE quarterly_bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  okr_period_id UUID NOT NULL REFERENCES okr_periods(id),
  member_id UUID NOT NULL REFERENCES members(id),
  division_id UUID NOT NULL REFERENCES divisions(id),
  bonus_type TEXT CHECK (bonus_type IN ('kpi_achievement', 'okr_stretch', 'special')) NOT NULL,
  amount INT NOT NULL,
  calculation_basis TEXT,
  approved_by UUID REFERENCES members(id),
  status TEXT CHECK (status IN ('pending', 'approved', 'paid')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ウィンセッション（週次）
-- ============================================================

CREATE TABLE win_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  session_date DATE NOT NULL,
  facilitator_id UUID REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE win_session_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES win_sessions(id),
  member_id UUID NOT NULL REFERENCES members(id),
  division_id UUID REFERENCES divisions(id),
  win_description TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

-- メンバーは自分のデータのみ閲覧可
-- マネージャー(G3)は自事業部のデータを閲覧可
-- G4（事業部長）は全事業部データ閲覧可
-- G5（代表）は全データ閲覧・編集可

-- ヘルパー: 現在のauth.uid()に対応するmember_idを取得
-- (SELECT id FROM members WHERE auth_user_id = auth.uid()) を各ポリシーで使用

-- === evaluations ===
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eval_select" ON evaluations
  FOR SELECT USING (
    member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
    OR evaluator_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM members
      WHERE auth_user_id = auth.uid()
      AND grade IN ('G4', 'G5')
    )
    OR EXISTS (
      -- G3は自事業部のみ閲覧可
      SELECT 1 FROM members m
      JOIN division_members dm ON dm.member_id = m.id
      WHERE m.auth_user_id = auth.uid()
      AND m.grade = 'G3'
      AND dm.division_id = evaluations.division_id
    )
  );

CREATE POLICY "eval_insert" ON evaluations
  FOR INSERT WITH CHECK (
    -- 自己評価の作成（自分のevaluation）
    member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM members
      WHERE auth_user_id = auth.uid()
      AND grade IN ('G4', 'G5')
    )
  );

CREATE POLICY "eval_update" ON evaluations
  FOR UPDATE USING (
    -- 本人（自己評価の更新: self_comment, status）
    member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
    -- 評価者（evaluator_idが設定済みの場合）
    OR evaluator_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
    -- G3は自事業部のevaluationを更新可（上長評価）
    OR EXISTS (
      SELECT 1 FROM members m
      JOIN division_members dm ON dm.member_id = m.id
      WHERE m.auth_user_id = auth.uid()
      AND m.grade = 'G3'
      AND dm.division_id = evaluations.division_id
      AND dm.is_head = true
    )
    -- G4/G5は全evaluation更新可
    OR EXISTS (
      SELECT 1 FROM members
      WHERE auth_user_id = auth.uid()
      AND grade IN ('G4', 'G5')
    )
  )
  WITH CHECK (
    member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
    OR evaluator_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM members m
      JOIN division_members dm ON dm.member_id = m.id
      WHERE m.auth_user_id = auth.uid()
      AND m.grade = 'G3'
      AND dm.division_id = evaluations.division_id
      AND dm.is_head = true
    )
    OR EXISTS (
      SELECT 1 FROM members
      WHERE auth_user_id = auth.uid()
      AND grade IN ('G4', 'G5')
    )
  );

CREATE POLICY "eval_delete" ON evaluations
  FOR DELETE USING (
    -- 削除はG4/G5のみ（かつdraftステータスのみ想定）
    EXISTS (
      SELECT 1 FROM members
      WHERE auth_user_id = auth.uid()
      AND grade IN ('G4', 'G5')
    )
  );

-- === eval_kpi_scores ===
ALTER TABLE eval_kpi_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eval_kpi_scores_select" ON eval_kpi_scores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = eval_kpi_scores.evaluation_id
      AND (
        e.member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
        OR e.evaluator_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
        )
        OR EXISTS (
          SELECT 1 FROM members m
          JOIN division_members dm ON dm.member_id = m.id
          WHERE m.auth_user_id = auth.uid() AND m.grade = 'G3' AND dm.division_id = e.division_id
        )
      )
    )
  );

CREATE POLICY "eval_kpi_scores_insert" ON eval_kpi_scores
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = eval_kpi_scores.evaluation_id
      AND (
        e.member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
        OR e.evaluator_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
        )
      )
    )
  );

CREATE POLICY "eval_kpi_scores_update" ON eval_kpi_scores
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = eval_kpi_scores.evaluation_id
      AND (
        e.member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
        OR e.evaluator_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
        )
      )
    )
  );

CREATE POLICY "eval_kpi_scores_delete" ON eval_kpi_scores
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

-- === eval_behavior_scores ===
ALTER TABLE eval_behavior_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eval_behavior_scores_select" ON eval_behavior_scores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = eval_behavior_scores.evaluation_id
      AND (
        e.member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
        OR e.evaluator_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
        )
        OR EXISTS (
          SELECT 1 FROM members m
          JOIN division_members dm ON dm.member_id = m.id
          WHERE m.auth_user_id = auth.uid() AND m.grade = 'G3' AND dm.division_id = e.division_id
        )
      )
    )
  );

CREATE POLICY "eval_behavior_scores_insert" ON eval_behavior_scores
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = eval_behavior_scores.evaluation_id
      AND (
        e.member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
        OR e.evaluator_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
        )
      )
    )
  );

CREATE POLICY "eval_behavior_scores_update" ON eval_behavior_scores
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = eval_behavior_scores.evaluation_id
      AND (
        e.member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
        OR e.evaluator_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
        )
      )
    )
  );

CREATE POLICY "eval_behavior_scores_delete" ON eval_behavior_scores
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

-- === eval_value_scores ===
ALTER TABLE eval_value_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eval_value_scores_select" ON eval_value_scores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = eval_value_scores.evaluation_id
      AND (
        e.member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
        OR e.evaluator_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
        )
        OR EXISTS (
          SELECT 1 FROM members m
          JOIN division_members dm ON dm.member_id = m.id
          WHERE m.auth_user_id = auth.uid() AND m.grade = 'G3' AND dm.division_id = e.division_id
        )
      )
    )
  );

CREATE POLICY "eval_value_scores_insert" ON eval_value_scores
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = eval_value_scores.evaluation_id
      AND (
        e.member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
        OR e.evaluator_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
        )
      )
    )
  );

CREATE POLICY "eval_value_scores_update" ON eval_value_scores
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = eval_value_scores.evaluation_id
      AND (
        e.member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
        OR e.evaluator_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
        )
      )
    )
  );

CREATE POLICY "eval_value_scores_delete" ON eval_value_scores
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

-- === members ===
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select" ON members
  FOR SELECT USING (
    -- 全員が基本情報を閲覧可（name, grade）
    -- salary列はG4/G5のみ（アプリ側で制御）
    true
  );

CREATE POLICY "members_update" ON members
  FOR UPDATE USING (
    auth_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

CREATE POLICY "members_insert" ON members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

CREATE POLICY "members_delete" ON members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

-- === one_on_ones ===
ALTER TABLE one_on_ones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "one_on_ones_select" ON one_on_ones
  FOR SELECT USING (
    member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
    OR manager_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

CREATE POLICY "one_on_ones_insert" ON one_on_ones
  FOR INSERT WITH CHECK (
    -- G3以上（manager_idが自分）
    manager_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G3', 'G4', 'G5')
    )
  );

CREATE POLICY "one_on_ones_update" ON one_on_ones
  FOR UPDATE USING (
    member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
    OR manager_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

CREATE POLICY "one_on_ones_delete" ON one_on_ones
  FOR DELETE USING (
    member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
    OR manager_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

-- === crosssell_tosses ===
ALTER TABLE crosssell_tosses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crosssell_tosses_select" ON crosssell_tosses
  FOR SELECT USING (
    tosser_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
    OR receiver_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G3', 'G4', 'G5')
    )
  );

CREATE POLICY "crosssell_tosses_insert" ON crosssell_tosses
  FOR INSERT WITH CHECK (
    -- 全員（tosser_idが自分）
    tosser_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "crosssell_tosses_update" ON crosssell_tosses
  FOR UPDATE USING (
    tosser_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
    OR receiver_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

CREATE POLICY "crosssell_tosses_delete" ON crosssell_tosses
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

-- ============================================================
-- 通知チャンネル設定
-- ============================================================

CREATE TABLE notification_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  type TEXT NOT NULL CHECK (type IN ('slack', 'line')),
  channel_name TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  events JSONB DEFAULT '[]'::jsonb,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notification_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_channels_select" ON notification_channels
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

CREATE POLICY "notification_channels_insert" ON notification_channels
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

CREATE POLICY "notification_channels_update" ON notification_channels
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

CREATE POLICY "notification_channels_delete" ON notification_channels
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

-- ============================================================
-- インデックス
-- ============================================================
-- === divisions ===
ALTER TABLE divisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "divisions_select" ON divisions
  FOR SELECT USING (true);

CREATE POLICY "divisions_modify" ON divisions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

-- === division_members ===
ALTER TABLE division_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "division_members_select" ON division_members
  FOR SELECT USING (true);

CREATE POLICY "division_members_modify" ON division_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

-- === grade_definitions ===
ALTER TABLE grade_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grade_definitions_select" ON grade_definitions
  FOR SELECT USING (true);

CREATE POLICY "grade_definitions_modify" ON grade_definitions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

-- === kpi_templates ===
ALTER TABLE kpi_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpi_templates_select" ON kpi_templates
  FOR SELECT USING (true);

CREATE POLICY "kpi_templates_modify" ON kpi_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

-- === kpi_items ===
ALTER TABLE kpi_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpi_items_select" ON kpi_items
  FOR SELECT USING (true);

CREATE POLICY "kpi_items_modify" ON kpi_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

-- === value_items ===
ALTER TABLE value_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "value_items_select" ON value_items
  FOR SELECT USING (true);

CREATE POLICY "value_items_modify" ON value_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

-- === behavior_items ===
ALTER TABLE behavior_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "behavior_items_select" ON behavior_items
  FOR SELECT USING (true);

CREATE POLICY "behavior_items_modify" ON behavior_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

-- === okr_periods ===
ALTER TABLE okr_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "okr_periods_select" ON okr_periods
  FOR SELECT USING (true);

CREATE POLICY "okr_periods_modify" ON okr_periods
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

-- === okr_objectives ===
ALTER TABLE okr_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "okr_objectives_select" ON okr_objectives
  FOR SELECT USING (
    member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM members m
      JOIN division_members dm ON dm.member_id = m.id
      WHERE m.auth_user_id = auth.uid()
      AND m.grade IN ('G3', 'G4', 'G5')
      AND dm.division_id = okr_objectives.division_id
    )
    OR EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

CREATE POLICY "okr_objectives_insert" ON okr_objectives
  FOR INSERT WITH CHECK (
    member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G3', 'G4', 'G5')
    )
  );

CREATE POLICY "okr_objectives_update" ON okr_objectives
  FOR UPDATE USING (
    member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G3', 'G4', 'G5')
    )
  );

CREATE POLICY "okr_objectives_delete" ON okr_objectives
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

-- === okr_key_results ===
ALTER TABLE okr_key_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "okr_key_results_select" ON okr_key_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM okr_objectives o
      WHERE o.id = okr_key_results.objective_id
      AND (
        o.member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM members m
          JOIN division_members dm ON dm.member_id = m.id
          WHERE m.auth_user_id = auth.uid()
          AND m.grade IN ('G3', 'G4', 'G5')
          AND dm.division_id = o.division_id
        )
        OR EXISTS (
          SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
        )
      )
    )
  );

CREATE POLICY "okr_key_results_insert" ON okr_key_results
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM okr_objectives o
      WHERE o.id = okr_key_results.objective_id
      AND (
        o.member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G3', 'G4', 'G5')
        )
      )
    )
  );

CREATE POLICY "okr_key_results_update" ON okr_key_results
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM okr_objectives o
      WHERE o.id = okr_key_results.objective_id
      AND (
        o.member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G3', 'G4', 'G5')
        )
      )
    )
  );

CREATE POLICY "okr_key_results_delete" ON okr_key_results
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

-- === okr_checkins ===
ALTER TABLE okr_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "okr_checkins_select" ON okr_checkins
  FOR SELECT USING (
    member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM okr_key_results kr
      JOIN okr_objectives o ON o.id = kr.objective_id
      JOIN division_members dm ON dm.division_id = o.division_id
      JOIN members m ON m.id = dm.member_id
      WHERE kr.id = okr_checkins.key_result_id
      AND m.auth_user_id = auth.uid()
      AND m.grade IN ('G3', 'G4', 'G5')
    )
    OR EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

CREATE POLICY "okr_checkins_insert" ON okr_checkins
  FOR INSERT WITH CHECK (
    member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "okr_checkins_update" ON okr_checkins
  FOR UPDATE USING (
    member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

CREATE POLICY "okr_checkins_delete" ON okr_checkins
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

-- === improvement_plans ===
ALTER TABLE improvement_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "improvement_plans_select" ON improvement_plans
  FOR SELECT USING (
    member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
    OR manager_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

CREATE POLICY "improvement_plans_insert" ON improvement_plans
  FOR INSERT WITH CHECK (
    manager_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G3', 'G4', 'G5')
    )
  );

CREATE POLICY "improvement_plans_update" ON improvement_plans
  FOR UPDATE USING (
    manager_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

CREATE POLICY "improvement_plans_delete" ON improvement_plans
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

-- === quarterly_bonuses ===
ALTER TABLE quarterly_bonuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quarterly_bonuses_select" ON quarterly_bonuses
  FOR SELECT USING (
    member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G3', 'G4', 'G5')
    )
  );

CREATE POLICY "quarterly_bonuses_insert" ON quarterly_bonuses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

CREATE POLICY "quarterly_bonuses_update" ON quarterly_bonuses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

CREATE POLICY "quarterly_bonuses_delete" ON quarterly_bonuses
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

-- === win_sessions ===
ALTER TABLE win_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "win_sessions_select" ON win_sessions
  FOR SELECT USING (true);

CREATE POLICY "win_sessions_insert" ON win_sessions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "win_sessions_update" ON win_sessions
  FOR UPDATE USING (
    facilitator_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

CREATE POLICY "win_sessions_delete" ON win_sessions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

-- === win_session_entries ===
ALTER TABLE win_session_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "win_session_entries_select" ON win_session_entries
  FOR SELECT USING (true);

CREATE POLICY "win_session_entries_insert" ON win_session_entries
  FOR INSERT WITH CHECK (
    member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "win_session_entries_update" ON win_session_entries
  FOR UPDATE USING (
    member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

CREATE POLICY "win_session_entries_delete" ON win_session_entries
  FOR DELETE USING (
    member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

-- === eval_periods ===
ALTER TABLE eval_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eval_periods_select" ON eval_periods
  FOR SELECT USING (true);

CREATE POLICY "eval_periods_modify" ON eval_periods
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

-- === eval_period_okr_periods ===
ALTER TABLE eval_period_okr_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eval_period_okr_periods_select" ON eval_period_okr_periods
  FOR SELECT USING (true);

CREATE POLICY "eval_period_okr_periods_modify" ON eval_period_okr_periods
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

-- === organizations ===
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organizations_select" ON organizations
  FOR SELECT USING (true);

CREATE POLICY "organizations_modify" ON organizations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade = 'G5'
    )
  );

-- === crosssell_routes ===
ALTER TABLE crosssell_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crosssell_routes_select" ON crosssell_routes
  FOR SELECT USING (true);

CREATE POLICY "crosssell_routes_modify" ON crosssell_routes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND grade IN ('G4', 'G5')
    )
  );

CREATE INDEX idx_evaluations_period ON evaluations(eval_period_id);
CREATE INDEX idx_evaluations_member ON evaluations(member_id);
CREATE INDEX idx_evaluations_division ON evaluations(division_id);
CREATE INDEX idx_eval_kpi_scores_eval ON eval_kpi_scores(evaluation_id);
CREATE INDEX idx_eval_behavior_scores_eval ON eval_behavior_scores(evaluation_id);
CREATE INDEX idx_eval_value_scores_eval ON eval_value_scores(evaluation_id);
CREATE INDEX idx_division_members_member ON division_members(member_id);
CREATE INDEX idx_division_members_division ON division_members(division_id);
CREATE INDEX idx_okr_checkins_kr_date ON okr_checkins(key_result_id, checkin_date);
CREATE INDEX idx_okr_key_results_obj ON okr_key_results(objective_id);
CREATE INDEX idx_crosssell_tosses_route ON crosssell_tosses(route_id);
CREATE INDEX idx_crosssell_tosses_tosser ON crosssell_tosses(tosser_id);
CREATE INDEX idx_one_on_ones_member ON one_on_ones(member_id, meeting_date);
CREATE INDEX idx_improvement_plans_member ON improvement_plans(member_id);

-- ============================================================
-- 通知プリファレンス（個人設定）
-- ============================================================

CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) UNIQUE,
  line_enabled BOOLEAN DEFAULT false,
  slack_enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- === notification_preferences RLS ===
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_pref_select" ON notification_preferences
  FOR SELECT USING (
    member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "notif_pref_insert" ON notification_preferences
  FOR INSERT WITH CHECK (
    member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "notif_pref_update" ON notification_preferences
  FOR UPDATE USING (
    member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
  );
