'use client';

// =============================================================================
// 上長評価 - 定量KPI確認フォーム (Client Component)
// メンバーの自己評価データを読み取り専用で表示する
// =============================================================================

import type { Rank, Grade } from '@/types/evaluation';
import EvalRankBadge from '@/components/shared/EvalRankBadge';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface KpiItemData {
  id: string;
  name: string;
  description: string | null;
  weight: number;
  measurement_unit: string | null;
  threshold_s: number | null;
  threshold_a: number | null;
  threshold_b: number | null;
  threshold_c: number | null;
  sort_order: number;
}

interface ExistingScore {
  kpi_item_id: string;
  target_value: number | null;
  actual_value: number | null;
  achievement_rate: number | null;
  rank: string | null;
  note: string | null;
}

interface ManagerQuantitativeFormProps {
  periodId: string;
  memberId: string;
  memberName: string;
  memberGrade: Grade;
  kpiItems: KpiItemData[];
  existingScores: ExistingScore[];
}

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

function isValidRank(value: string | null): value is Rank {
  if (value === null) return false;
  return ['S', 'A', 'B', 'C', 'D'].includes(value);
}

function calculateAchievementRate(target: number, actual: number): number {
  if (target <= 0) return 0;
  return Math.round((actual / target) * 10000) / 100;
}

function estimateRank(
  rate: number,
  thresholdS: number | null,
  thresholdA: number | null,
  thresholdB: number | null,
  thresholdC: number | null
): Rank {
  if (thresholdS !== null && rate >= thresholdS) return 'S';
  if (thresholdA !== null && rate >= thresholdA) return 'A';
  if (thresholdB !== null && rate >= thresholdB) return 'B';
  if (thresholdC !== null && rate >= thresholdC) return 'C';
  return 'D';
}

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------

export default function ManagerQuantitativeForm({
  periodId,
  memberId,
  memberName,
  memberGrade,
  kpiItems,
  existingScores,
}: ManagerQuantitativeFormProps) {
  // 既存スコアをマップ化
  const scoreMap = new Map(existingScores.map((s) => [s.kpi_item_id, s]));

  // 入力済み件数
  const completedCount = kpiItems.filter((item) => {
    const score = scoreMap.get(item.id);
    return score?.actual_value !== null && score?.actual_value !== undefined;
  }).length;

  return (
    <div className="space-y-6">
      {/* ヘッダー情報 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
            上長評価 - 定量評価 (KPI)
          </h1>
          <p className="text-sm text-[#737373] mt-1">
            メンバーの自己評価データを確認してください
          </p>
        </div>
        <span className="px-3 py-1 border border-[#333333] text-xs text-[#a3a3a3]">
          入力済: {completedCount} / {kpiItems.length}
        </span>
      </div>

      {/* 対象メンバー情報 */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3 flex items-center gap-4">
        <div className="text-xs text-[#737373] uppercase tracking-wider">
          評価対象
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-[#e5e5e5]">
            {memberName}
          </span>
          <span className="px-2 py-0.5 border border-[#333333] text-xs text-[#a3a3a3]">
            {memberGrade}
          </span>
        </div>
      </div>

      {/* ランク基準 */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3">
        <div className="text-xs text-[#737373]">
          <p>
            達成率に基づいてランクが自動判定されています（読み取り専用）
          </p>
          <p className="mt-1">
            ランク基準は各KPI項目のthreshold設定に基づきます
          </p>
        </div>
      </div>

      {/* KPI確認テーブル */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="border-b border-[#1a1a1a] px-4 py-3">
          <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
            KPI項目 (自己評価データ)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a1a1a] text-[#737373]">
                <th className="px-4 py-2 text-left font-medium">項目名</th>
                <th className="px-4 py-2 text-right font-medium">ウェイト</th>
                <th className="px-4 py-2 text-right font-medium">目標値</th>
                <th className="px-4 py-2 text-right font-medium">実績値</th>
                <th className="px-4 py-2 text-right font-medium">達成率</th>
                <th className="px-4 py-2 text-center font-medium">ランク</th>
                <th className="px-4 py-2 text-left font-medium">備考</th>
              </tr>
            </thead>
            <tbody>
              {kpiItems.map((item) => {
                const score = scoreMap.get(item.id);
                const targetNum = score?.target_value ?? null;
                const actualNum = score?.actual_value ?? null;

                // DB の achievement_rate を優先し、なければクライアント側で計算
                let achievementRate: number | null =
                  score?.achievement_rate ?? null;
                if (
                  achievementRate === null &&
                  targetNum !== null &&
                  actualNum !== null &&
                  targetNum > 0
                ) {
                  achievementRate = calculateAchievementRate(
                    targetNum,
                    actualNum
                  );
                }

                // DB の rank を優先し、なければ達成率から推定
                let displayRank: Rank | null = null;
                if (isValidRank(score?.rank ?? null)) {
                  displayRank = score!.rank as Rank;
                } else if (achievementRate !== null) {
                  displayRank = estimateRank(
                    achievementRate,
                    item.threshold_s,
                    item.threshold_a,
                    item.threshold_b,
                    item.threshold_c
                  );
                }

                return (
                  <tr
                    key={item.id}
                    className="border-b border-[#111111] hover:bg-[#111111] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="text-[#e5e5e5] font-medium">
                        {item.name}
                      </div>
                      {item.description && (
                        <div className="text-[10px] text-[#404040] mt-0.5">
                          {item.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-[#a3a3a3]">
                      {item.weight}%
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-[#737373]">
                        {targetNum !== null
                          ? `${targetNum.toLocaleString()} ${item.measurement_unit ?? ''}`
                          : '---'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-[#e5e5e5] font-bold">
                        {actualNum !== null
                          ? `${actualNum.toLocaleString()} ${item.measurement_unit ?? ''}`
                          : '---'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {achievementRate !== null ? (
                        <span className="text-[#a3a3a3]">
                          {achievementRate}%
                        </span>
                      ) : (
                        <span className="text-[#404040]">---</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {displayRank ? (
                        <EvalRankBadge rank={displayRank} size="sm" />
                      ) : (
                        <span className="text-[#737373]">---</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[#737373] text-xs">
                        {score?.note || '---'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 加重平均スコアサマリー */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#737373] uppercase tracking-wider">
            加重平均達成率
          </span>
          <span className="text-sm font-bold text-[#e5e5e5]">
            {(() => {
              let weightedSum = 0;
              let totalWeight = 0;
              for (const item of kpiItems) {
                const score = scoreMap.get(item.id);
                const targetNum = score?.target_value ?? null;
                const actualNum = score?.actual_value ?? null;
                let rate = score?.achievement_rate ?? null;
                if (
                  rate === null &&
                  targetNum !== null &&
                  actualNum !== null &&
                  targetNum > 0
                ) {
                  rate = calculateAchievementRate(targetNum, actualNum);
                }
                if (rate !== null) {
                  weightedSum += rate * item.weight;
                  totalWeight += item.weight;
                }
              }
              if (totalWeight === 0) return '---';
              return `${(weightedSum / totalWeight).toFixed(1)}%`;
            })()}
          </span>
        </div>
      </div>

      {/* アクションボタン */}
      <div className="flex items-center justify-between">
        <a
          href={`/periods/${periodId}?memberId=${memberId}`}
          className="px-4 py-2 border border-[#333333] text-xs text-[#a3a3a3] hover:border-[#555555] transition-colors"
        >
          戻る
        </a>
        <span className="text-xs text-[#404040]">
          定量評価は自己申告データの確認のみです
        </span>
      </div>
    </div>
  );
}
