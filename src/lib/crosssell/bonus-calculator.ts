// =============================================================================
// クロスセルボーナス計算
// ARCHITECTURE.txt セクション4-2 に準拠
// =============================================================================

import type { CrosssellToss } from '@/types/crosssell';

// -----------------------------------------------------------------------------
// 個別ボーナス計算
// -----------------------------------------------------------------------------

/**
 * トス元ボーナスを計算
 * @param grossProfit 粗利額 (円)
 * @param tossRate トス元ボーナス率 (例: 0.05 = 5%)
 * @returns ボーナス額 (円, 端数切り捨て)
 */
export function calculateTossBonus(
  grossProfit: number,
  tossRate: number
): number {
  return Math.round(grossProfit * tossRate);
}

/**
 * 受注側ボーナスを計算
 * @param grossProfit 粗利額 (円)
 * @param receiveRate 受注側ボーナス率 (例: 0.025 = 2.5%)
 * @returns ボーナス額 (円, 端数切り捨て)
 */
export function calculateReceiveBonus(
  grossProfit: number,
  receiveRate: number
): number {
  return Math.round(grossProfit * receiveRate);
}

// -----------------------------------------------------------------------------
// 集計結果型
// -----------------------------------------------------------------------------

interface TotalBonusesResult {
  /** トス元ボーナス合計 */
  totalTossBonus: number;
  /** 受注側ボーナス合計 */
  totalReceiveBonus: number;
  /** 成約件数 */
  contractedCount: number;
  /** 成約率 (0-1) */
  conversionRate: number;
}

// -----------------------------------------------------------------------------
// 一括集計
// -----------------------------------------------------------------------------

/**
 * トスアップ実績の一覧からボーナスを集計
 * contracted ステータスかつ粗利が入力済みの案件のみ集計対象
 */
export function calculateTotalBonuses(
  tosses: ReadonlyArray<CrosssellToss>
): TotalBonusesResult {
  if (tosses.length === 0) {
    return {
      totalTossBonus: 0,
      totalReceiveBonus: 0,
      contractedCount: 0,
      conversionRate: 0,
    };
  }

  let totalTossBonus = 0;
  let totalReceiveBonus = 0;
  let contractedCount = 0;

  for (const toss of tosses) {
    if (toss.status === 'contracted' && toss.gross_profit !== null) {
      contractedCount++;
      totalTossBonus += calculateTossBonus(
        toss.gross_profit,
        toss.toss_bonus_rate
      );
      totalReceiveBonus += calculateReceiveBonus(
        toss.gross_profit,
        toss.receive_bonus_rate
      );
    }
  }

  const conversionRate =
    tosses.length > 0 ? contractedCount / tosses.length : 0;

  return {
    totalTossBonus,
    totalReceiveBonus,
    contractedCount,
    conversionRate: Math.round(conversionRate * 10000) / 10000,
  };
}
