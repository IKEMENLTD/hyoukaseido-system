// =============================================================================
// 評価制度システム - クロスセル関連型定義
// ARCHITECTURE.txt セクション4-2 データベース設計に準拠
// =============================================================================

// -----------------------------------------------------------------------------
// 列挙型 (Union Types)
// -----------------------------------------------------------------------------

/** トスアップステータス */
export type TossStatus = 'tossed' | 'in_progress' | 'contracted' | 'cancelled';

// -----------------------------------------------------------------------------
// インターフェース
// -----------------------------------------------------------------------------

/** クロスセル経路定義 (crosssell_routes) */
export interface CrosssellRoute {
  id: string;
  org_id: string;
  from_division_id: string;
  to_division_id: string;
  condition: string;
  /** トス元ボーナス率 (0.05 = 5%) */
  toss_bonus_rate: number;
  /** 受注側ボーナス率 (0.025 = 2.5%) */
  receive_bonus_rate: number;
  is_active: boolean;
}

/** トスアップ実績 (crosssell_tosses) */
export interface CrosssellToss {
  id: string;
  route_id: string;
  tosser_id: string;
  receiver_id: string;
  toss_date: string;
  status: TossStatus;
  /** 粗利 (確定後に入力) */
  gross_profit: number | null;
  /** トス元ボーナス率スナップショット */
  toss_bonus_rate: number;
  /** 受注側ボーナス率スナップショット */
  receive_bonus_rate: number;
  /** DB側でGENERATED ALWAYS AS計算されるトス元ボーナス (読み取り専用) */
  toss_bonus: number | null;
  /** DB側でGENERATED ALWAYS AS計算される受注側ボーナス (読み取り専用) */
  receive_bonus: number | null;
  note: string | null;
  created_at: string;
}
