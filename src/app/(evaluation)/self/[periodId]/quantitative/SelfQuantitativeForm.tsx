'use client';

// =============================================================================
// 自己評価 - 定量KPI入力フォーム (Client Component)
// 各KPI項目の目標値・実績値を入力し、UPSERT で保存する
// =============================================================================

import { useState, useCallback } from 'react';
import { saveSelfQuantitativeScores } from '@/lib/evaluation/actions';
import type { Rank } from '@/types/evaluation';
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

interface SelfQuantitativeFormProps {
  evaluationId: string;
  periodId: string;
  kpiItems: KpiItemData[];
  existingScores: ExistingScore[];
  isReadonly: boolean;
}

interface KpiRowState {
  target_value: string;
  actual_value: string;
  note: string;
}

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

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

export default function SelfQuantitativeForm({
  evaluationId,
  periodId,
  kpiItems,
  existingScores,
  isReadonly,
}: SelfQuantitativeFormProps) {
  // 既存スコアをマップ化
  const scoreMap = new Map(existingScores.map((s) => [s.kpi_item_id, s]));

  // 各KPI項目の入力状態を初期化
  const initialRows: Record<string, KpiRowState> = {};
  for (const item of kpiItems) {
    const existing = scoreMap.get(item.id);
    initialRows[item.id] = {
      target_value: existing?.target_value?.toString() ?? '',
      actual_value: existing?.actual_value?.toString() ?? '',
      note: existing?.note ?? '',
    };
  }

  const [rows, setRows] = useState<Record<string, KpiRowState>>(initialRows);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const updateRow = useCallback((itemId: string, field: keyof KpiRowState, value: string) => {
    setRows((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setMessage(null);

    const scores = kpiItems.map((item) => {
      const row = rows[item.id];
      return {
        kpi_item_id: item.id,
        target_value: row.target_value ? parseFloat(row.target_value) : null,
        actual_value: row.actual_value ? parseFloat(row.actual_value) : null,
        note: row.note || null,
      };
    });

    const result = await saveSelfQuantitativeScores(evaluationId, scores);

    if (result.success) {
      setMessage({ type: 'success', text: '定量評価を保存しました' });
    } else {
      setMessage({ type: 'error', text: result.error ?? '保存に失敗しました' });
    }

    setSaving(false);
  }, [evaluationId, kpiItems, rows]);

  const completedCount = kpiItems.filter((item) => {
    const row = rows[item.id];
    return row.actual_value !== '';
  }).length;

  return (
    <div className="space-y-6">
      {/* ヘッダー情報 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
            自己評価 - 定量評価 (KPI)
          </h1>
          <p className="text-sm text-[#737373] mt-1">
            各KPI項目の目標値と実績値を入力してください
          </p>
        </div>
        <span className="px-3 py-1 border border-[#333333] text-xs text-[#a3a3a3]">
          入力済: {completedCount} / {kpiItems.length}
        </span>
      </div>

      {/* ランク基準 */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3">
        <div className="text-xs text-[#737373]">
          <p>達成率に基づいてランクが自動判定されます</p>
          <p className="mt-1">ランク基準は各KPI項目のthreshold設定に基づきます</p>
        </div>
      </div>

      {/* 保存メッセージ */}
      {message && (
        <div className={`border px-4 py-3 text-sm ${
          message.type === 'success'
            ? 'border-[#22d3ee] text-[#22d3ee]'
            : 'border-[#ef4444] text-[#ef4444]'
        }`}>
          {message.text}
        </div>
      )}

      {/* KPI入力テーブル */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="border-b border-[#1a1a1a] px-4 py-3">
          <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
            KPI項目
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
                const row = rows[item.id];
                const targetNum = row.target_value ? parseFloat(row.target_value) : null;
                const actualNum = row.actual_value ? parseFloat(row.actual_value) : null;

                const achievementRate = (targetNum !== null && actualNum !== null && targetNum > 0)
                  ? calculateAchievementRate(targetNum, actualNum)
                  : null;

                const estimatedRank = achievementRate !== null
                  ? estimateRank(achievementRate, item.threshold_s, item.threshold_a, item.threshold_b, item.threshold_c)
                  : null;

                return (
                  <tr
                    key={item.id}
                    className="border-b border-[#111111] hover:bg-[#111111] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="text-[#e5e5e5] font-medium">{item.name}</div>
                      {item.description && (
                        <div className="text-[10px] text-[#404040] mt-0.5">{item.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-[#a3a3a3]">{item.weight}%</td>
                    <td className="px-4 py-3 text-right">
                      {isReadonly ? (
                        <span className="text-[#737373]">
                          {targetNum !== null ? `${targetNum.toLocaleString()} ${item.measurement_unit ?? ''}` : '---'}
                        </span>
                      ) : (
                        <input
                          type="number"
                          value={row.target_value}
                          onChange={(e) => updateRow(item.id, 'target_value', e.target.value)}
                          className="w-28 bg-[#111111] border border-[#333333] text-[#e5e5e5] text-right px-2 py-1 text-sm focus:border-[#3b82f6] focus:outline-none"
                          placeholder="目標"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isReadonly ? (
                        <span className="text-[#e5e5e5] font-bold">
                          {actualNum !== null ? `${actualNum.toLocaleString()} ${item.measurement_unit ?? ''}` : '---'}
                        </span>
                      ) : (
                        <input
                          type="number"
                          value={row.actual_value}
                          onChange={(e) => updateRow(item.id, 'actual_value', e.target.value)}
                          className="w-28 bg-[#111111] border border-[#333333] text-[#e5e5e5] text-right px-2 py-1 text-sm focus:border-[#3b82f6] focus:outline-none"
                          placeholder="実績"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {achievementRate !== null ? (
                        <span className="text-[#a3a3a3]">{achievementRate}%</span>
                      ) : (
                        <span className="text-[#404040]">---</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {estimatedRank ? (
                        <EvalRankBadge rank={estimatedRank} size="sm" />
                      ) : (
                        <span className="text-[#737373]">---</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isReadonly ? (
                        <span className="text-[#737373] text-xs">{row.note || '---'}</span>
                      ) : (
                        <input
                          type="text"
                          value={row.note}
                          onChange={(e) => updateRow(item.id, 'note', e.target.value)}
                          className="w-full bg-[#111111] border border-[#333333] text-[#a3a3a3] px-2 py-1 text-xs focus:border-[#3b82f6] focus:outline-none"
                          placeholder="備考"
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* アクションボタン */}
      <div className="flex items-center justify-between">
        <a
          href={`/self/${periodId}`}
          className="px-4 py-2 border border-[#333333] text-xs text-[#a3a3a3] hover:border-[#555555] transition-colors"
        >
          戻る
        </a>
        {!isReadonly && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`px-6 py-2 text-sm font-bold uppercase tracking-wider transition-colors ${
              saving
                ? 'bg-[#333333] text-[#737373] cursor-not-allowed'
                : 'bg-[#3b82f6] text-[#050505] hover:bg-[#2563eb]'
            }`}
          >
            {saving ? '保存中...' : '保存する'}
          </button>
        )}
      </div>
    </div>
  );
}
