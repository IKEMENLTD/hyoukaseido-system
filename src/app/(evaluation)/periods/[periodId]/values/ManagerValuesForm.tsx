'use client';

// =============================================================================
// 上長評価 - バリュー評価フォーム (Client Component)
// 自己評価スコアを参照表示し、上長がマネージャースコアを入力して UPSERT で保存する
// =============================================================================

import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { updateValueScoreManager } from '@/lib/evaluation/update-evaluation-scores';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface ValueItemData {
  id: string;
  name: string;
  definition: string;
  axis: string | null;
  max_score: number;
  sort_order: number;
}

interface ExistingValueScore {
  value_item_id: string;
  self_score: number | null;
  manager_score: number | null;
  evidence: string | null;
}

interface ManagerValuesFormProps {
  evaluationId: string;
  periodId: string;
  memberName: string;
  memberGrade: string;
  valueItems: ValueItemData[];
  existingScores: ExistingValueScore[];
  isReadonly: boolean;
}

interface ValueRowState {
  self_score: number | null;
  manager_score: number | null;
  evidence: string;
}

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------

export default function ManagerValuesForm({
  evaluationId,
  periodId,
  memberName,
  memberGrade,
  valueItems,
  existingScores,
  isReadonly,
}: ManagerValuesFormProps) {
  const scoreMap = new Map(existingScores.map((s) => [s.value_item_id, s]));

  const initialRows: Record<string, ValueRowState> = {};
  for (const item of valueItems) {
    const existing = scoreMap.get(item.id);
    initialRows[item.id] = {
      self_score: existing?.self_score ?? null,
      manager_score: existing?.manager_score ?? null,
      evidence: existing?.evidence ?? '',
    };
  }

  const [rows, setRows] = useState<Record<string, ValueRowState>>(initialRows);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const setManagerScore = useCallback((itemId: string, score: number) => {
    setRows((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], manager_score: score },
    }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setMessage(null);

    const supabase = createClient();
    const upsertData: Array<{
      evaluation_id: string;
      value_item_id: string;
      manager_score: number | null;
    }> = [];

    for (const item of valueItems) {
      const row = rows[item.id];
      upsertData.push({
        evaluation_id: evaluationId,
        value_item_id: item.id,
        manager_score: row.manager_score,
      });
    }

    const { error } = await supabase
      .from('eval_value_scores')
      .upsert(upsertData, { onConflict: 'evaluation_id,value_item_id' });

    if (error) {
      setMessage({ type: 'error', text: `保存に失敗しました: ${error.message}` });
    } else {
      // 集計スコアを再計算・永続化
      await updateValueScoreManager(evaluationId, valueItems.map(v => ({ id: v.id, max_score: v.max_score })));
      setMessage({ type: 'success', text: '上長バリュー評価を保存しました' });
    }

    setSaving(false);
  }, [evaluationId, valueItems, rows]);

  const completedCount = valueItems.filter((item) => rows[item.id].manager_score !== null).length;
  const totalManagerScore = valueItems.reduce((sum, item) => sum + (rows[item.id].manager_score ?? 0), 0);
  const totalSelfScore = valueItems.reduce((sum, item) => sum + (rows[item.id].self_score ?? 0), 0);
  const totalMaxScore = valueItems.reduce((sum, item) => sum + item.max_score, 0);

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
            上長評価 - バリュー評価
          </h1>
          <p className="text-sm text-[#737373] mt-1">
            対象メンバーのバリュー貢献度を評価してください
          </p>
        </div>
        <span className="px-3 py-1 border border-[#333333] text-xs text-[#a3a3a3]">
          入力済: {completedCount} / {valueItems.length}
        </span>
      </div>

      {/* 対象メンバー情報 */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#737373] uppercase tracking-wider">対象者</span>
          <span className="text-sm font-bold text-[#e5e5e5]">{memberName}</span>
          <span className="px-2 py-0.5 border border-[#3b82f6] text-xs text-[#3b82f6] font-bold">
            {memberGrade}
          </span>
        </div>
      </div>

      {/* 説明 */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3">
        <div className="text-xs text-[#737373] space-y-1">
          <p>メンバーの自己評価スコアとエビデンスを参照し、上長としてのスコアを入力してください。</p>
          <p>自己評価スコアは参考値です。上長スコアは独立した評価として入力してください。</p>
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

      {/* バリュー項目リスト */}
      <div className="space-y-4">
        {valueItems.map((item) => {
          const row = rows[item.id];
          return (
            <div key={item.id} className="border border-[#1a1a1a] bg-[#0a0a0a]">
              {/* 項目ヘッダー */}
              <div className="px-4 py-3 border-b border-[#1a1a1a]">
                <div>
                  <h3 className="text-sm font-bold text-[#e5e5e5]">{item.name}</h3>
                  <p className="text-xs text-[#737373] mt-1">{item.definition}</p>
                  {item.axis && (
                    <p className="text-[10px] text-[#404040] mt-0.5">軸: {item.axis}</p>
                  )}
                </div>
              </div>

              {/* 自己評価 (読み取り専用) */}
              <div className="px-4 py-3 border-b border-[#1a1a1a]">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#737373] uppercase tracking-wider">自己評価 (参考)</span>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: item.max_score }, (_, i) => {
                      const scoreValue = i + 1;
                      const isSelected = row.self_score !== null && scoreValue <= row.self_score;
                      return (
                        <span
                          key={i}
                          className={`w-6 h-6 flex items-center justify-center text-xs font-bold ${
                            isSelected
                              ? 'bg-[#404040] text-[#a3a3a3]'
                              : 'border border-[#333333] text-[#404040]'
                          }`}
                        >
                          {scoreValue}
                        </span>
                      );
                    })}
                    <span className="ml-2 text-xs text-[#737373]">
                      {row.self_score !== null ? `${row.self_score}点` : '未入力'}
                    </span>
                  </div>
                </div>
              </div>

              {/* エビデンス (読み取り専用) */}
              <div className="px-4 py-3 border-b border-[#1a1a1a]">
                <div className="text-xs text-[#737373] mb-1">エビデンス (本人記入)</div>
                <p className="text-sm text-[#a3a3a3]">{row.evidence || '未入力'}</p>
              </div>

              {/* 上長スコア入力 */}
              <div className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#22d3ee] uppercase tracking-wider font-bold">上長評価</span>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: item.max_score }, (_, i) => {
                      const scoreValue = i + 1;
                      const isSelected = row.manager_score !== null && scoreValue <= row.manager_score;
                      return (
                        <button
                          key={i}
                          type="button"
                          disabled={isReadonly}
                          onClick={() => setManagerScore(item.id, scoreValue)}
                          className={`w-6 h-6 flex items-center justify-center text-xs font-bold transition-colors ${
                            isSelected
                              ? 'bg-[#22d3ee] text-[#050505]'
                              : isReadonly
                                ? 'border border-[#333333] text-[#404040]'
                                : 'border border-[#333333] text-[#404040] hover:border-[#22d3ee] hover:text-[#22d3ee]'
                          }`}
                        >
                          {scoreValue}
                        </button>
                      );
                    })}
                    <span className="ml-2 text-xs text-[#737373]">
                      {row.manager_score !== null ? `${row.manager_score}点` : '未入力'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 合計スコア比較 */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="px-4 py-3 flex items-center justify-between border-b border-[#1a1a1a]">
          <span className="text-sm text-[#737373]">自己評価 合計 (参考)</span>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-[#a3a3a3]">
              {totalSelfScore}
            </span>
            <span className="text-xs text-[#737373]">
              / {totalMaxScore}
            </span>
          </div>
        </div>
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-[#737373]">上長評価 合計</span>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-[#22d3ee]">
              {totalManagerScore}
            </span>
            <span className="text-xs text-[#737373]">
              / {totalMaxScore}
            </span>
          </div>
        </div>
      </div>

      {/* アクションボタン */}
      <div className="flex items-center justify-between">
        <a
          href={`/periods/${periodId}`}
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
