'use client';

// =============================================================================
// 自己評価 - 定性行動評価フォーム (Client Component)
// 各行動項目について4段階で自己評価し、コメントを入力する
// =============================================================================

import { useState, useCallback } from 'react';
import { saveSelfQualitativeScores } from '@/lib/evaluation/actions';
import { useAutoSaveDraft } from '@/hooks/useAutoSaveDraft';
import type { BehaviorScore } from '@/types/evaluation';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface BehaviorItemData {
  id: string;
  name: string;
  criteria: string;
  max_score: number;
  sort_order: number;
}

interface ExistingBehaviorScore {
  behavior_item_id: string;
  self_score: BehaviorScore | null;
  comment: string | null;
}

interface SelfQualitativeFormProps {
  evaluationId: string;
  periodId: string;
  behaviorItems: BehaviorItemData[];
  existingScores: ExistingBehaviorScore[];
  isReadonly: boolean;
}

interface BehaviorRowState {
  self_score: BehaviorScore | null;
  comment: string;
}

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

const SCORE_LABELS: Record<BehaviorScore, { symbol: string; label: string; color: string }> = {
  4: { symbol: '\u25CE', label: '期待超え', color: 'bg-[#3b82f6] text-[#050505]' },
  3: { symbol: '\u25CB', label: '基準達成', color: 'bg-[#22d3ee] text-[#050505]' },
  2: { symbol: '\u25B3', label: 'やや不足', color: 'bg-[#f59e0b] text-[#050505]' },
  1: { symbol: '\u00D7', label: '不十分', color: 'bg-[#ef4444] text-[#050505]' },
};

const SCORE_OPTIONS: readonly BehaviorScore[] = [4, 3, 2, 1] as const;

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

function formatTime(date: Date): string {
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------

export default function SelfQualitativeForm({
  evaluationId,
  periodId,
  behaviorItems,
  existingScores,
  isReadonly,
}: SelfQualitativeFormProps) {
  const scoreMap = new Map(existingScores.map((s) => [s.behavior_item_id, s]));

  const initialRows: Record<string, BehaviorRowState> = {};
  for (const item of behaviorItems) {
    const existing = scoreMap.get(item.id);
    initialRows[item.id] = {
      self_score: existing?.self_score ?? null,
      comment: existing?.comment ?? '',
    };
  }

  const [rows, setRows] = useState<Record<string, BehaviorRowState>>(initialRows);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // --- 自動下書き保存 ---
  const draftKey = `draft-self-qual-${evaluationId}`;
  const { lastSaved, clearDraft, restoredData, dismissRestore } =
    useAutoSaveDraft<Record<string, BehaviorRowState>>(draftKey, rows);

  // 下書き復元処理（派生値）
  const showRestoreBanner = restoredData !== null && !isReadonly;

  const handleRestore = useCallback(() => {
    if (restoredData !== null) {
      setRows(restoredData);
    }
    dismissRestore();
  }, [restoredData, dismissRestore]);

  const handleDismissRestore = useCallback(() => {
    dismissRestore();
  }, [dismissRestore]);

  const setScore = useCallback((itemId: string, score: BehaviorScore) => {
    setRows((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], self_score: score },
    }));
  }, []);

  const setComment = useCallback((itemId: string, comment: string) => {
    setRows((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], comment },
    }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setMessage(null);

    const scores = behaviorItems.map((item) => {
      const row = rows[item.id];
      return {
        behavior_item_id: item.id,
        self_score: row.self_score,
        comment: row.comment || null,
      };
    });

    const result = await saveSelfQualitativeScores(evaluationId, scores);

    if (result.success) {
      setMessage({ type: 'success', text: '定性評価を保存しました' });
      clearDraft();
    } else {
      setMessage({ type: 'error', text: result.error ?? '保存に失敗しました' });
    }

    setSaving(false);
  }, [evaluationId, behaviorItems, rows, clearDraft]);

  const completedCount = behaviorItems.filter((item) => rows[item.id].self_score !== null).length;

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
            自己評価 - 定性評価 (行動)
          </h1>
          <p className="text-sm text-[#737373] mt-1">
            各行動項目について自己評価してください
          </p>
          {/* 自動保存ステータス */}
          {!isReadonly && lastSaved && (
            <p className="text-[10px] text-[#404040] mt-1">
              下書き自動保存済み ({formatTime(lastSaved)})
            </p>
          )}
        </div>
        <span className="px-3 py-1 border border-[#333333] text-xs text-[#a3a3a3]">
          入力済: {completedCount} / {behaviorItems.length}
        </span>
      </div>

      {/* 下書き復元バナー */}
      {showRestoreBanner && (
        <div className="border border-[#333333] bg-[#0a0a0a] px-4 py-3 flex items-center justify-between">
          <span className="text-xs text-[#a3a3a3]">
            前回の下書きがあります。復元しますか？
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRestore}
              className="px-3 py-1 text-xs font-bold bg-[#3b82f6] text-[#050505] hover:bg-[#2563eb] transition-colors"
            >
              復元する
            </button>
            <button
              type="button"
              onClick={handleDismissRestore}
              className="px-3 py-1 text-xs border border-[#333333] text-[#737373] hover:border-[#555555] transition-colors"
            >
              破棄
            </button>
          </div>
        </div>
      )}

      {/* スコア基準 */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3">
        <div className="text-xs text-[#737373] uppercase tracking-wider mb-2">
          評価基準
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          {SCORE_OPTIONS.map((score) => {
            const config = SCORE_LABELS[score];
            return (
              <div key={score} className="flex items-center gap-2">
                <span className={`inline-flex items-center justify-center w-6 h-6 font-bold text-[10px] ${config.color}`}>
                  {config.symbol}
                </span>
                <span className="text-[#a3a3a3]">{score}: {config.label}</span>
              </div>
            );
          })}
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

      {/* 行動項目リスト */}
      <div className="space-y-4">
        {behaviorItems.map((item) => {
          const row = rows[item.id];
          return (
            <div key={item.id} className="border border-[#1a1a1a] bg-[#0a0a0a]">
              <div className="px-4 py-3 border-b border-[#1a1a1a]">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#e5e5e5]">{item.name}</h3>
                  {row.self_score !== null ? (
                    <span className={`inline-flex items-center justify-center w-8 h-8 font-bold text-xs ${SCORE_LABELS[row.self_score].color}`}>
                      {row.self_score}
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center w-8 h-8 border border-[#333333] text-xs text-[#404040]">
                      ?
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#737373] mt-1">{item.criteria}</p>
              </div>
              <div className="px-4 py-3 space-y-3">
                {/* スコア選択ボタン */}
                {!isReadonly && (
                  <div className="flex items-center gap-2">
                    {SCORE_OPTIONS.map((score) => {
                      const config = SCORE_LABELS[score];
                      const isSelected = row.self_score === score;
                      return (
                        <button
                          key={score}
                          type="button"
                          onClick={() => setScore(item.id, score)}
                          className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                            isSelected
                              ? config.color
                              : 'border border-[#333333] text-[#737373] hover:border-[#555555]'
                          }`}
                        >
                          {config.symbol} {score}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* コメント入力 */}
                <div>
                  <div className="text-xs text-[#737373] mb-1">自己評価コメント</div>
                  {isReadonly ? (
                    <p className="text-sm text-[#a3a3a3]">{row.comment || '未入力'}</p>
                  ) : (
                    <textarea
                      value={row.comment}
                      onChange={(e) => setComment(item.id, e.target.value)}
                      rows={2}
                      className="w-full bg-[#111111] border border-[#333333] text-[#a3a3a3] px-3 py-2 text-sm focus:border-[#3b82f6] focus:outline-none resize-none"
                      placeholder="具体的な行動事例を記載してください"
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 上位等級行動ボーナス説明 */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3">
        <div className="text-xs text-[#737373]">
          上位等級の行動基準を満たしている場合、加点ボーナスが適用されます。
          上長評価時に判定されます。
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
