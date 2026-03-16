// =============================================================================
// 四半期レビュー - クライアントコンポーネント
// OKRの期末スコア入力 + Supabase送信
// =============================================================================

'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReviewKeyResult {
  id: string;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  confidence: number;
  finalScore: number | null;
  sortOrder: number;
}

interface ReviewObjective {
  id: string;
  title: string;
  level: string;
  keyResults: ReviewKeyResult[];
}

interface ReviewClientProps {
  periodName: string;
  periodStatus: string;
  objectives: ReviewObjective[];
}

interface MessageState {
  type: 'success' | 'error';
  text: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getProgressColor(ratio: number): string {
  if (ratio >= 0.7) return 'bg-[#3b82f6]';
  if (ratio >= 0.4) return 'bg-[#22d3ee]';
  return 'bg-[#ef4444]';
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 70) return 'text-[#22d3ee]';
  if (confidence >= 40) return 'text-[#f59e0b]';
  return 'text-[#ef4444]';
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'reviewing':
      return 'REVIEWING';
    case 'active':
      return 'ACTIVE';
    case 'completed':
      return 'COMPLETED';
    default:
      return status.toUpperCase();
  }
}

function getStatusBorderColor(status: string): string {
  switch (status) {
    case 'reviewing':
      return 'border-[#f59e0b] text-[#f59e0b]';
    case 'active':
      return 'border-[#3b82f6] text-[#3b82f6]';
    case 'completed':
      return 'border-[#22d3ee] text-[#22d3ee]';
    default:
      return 'border-[#333333] text-[#a3a3a3]';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ReviewClient({
  periodName,
  periodStatus,
  objectives,
}: ReviewClientProps) {
  // スコア状態: krId -> score
  const [scores, setScores] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const obj of objectives) {
      for (const kr of obj.keyResults) {
        if (kr.finalScore !== null) {
          initial[kr.id] = kr.finalScore;
        }
      }
    }
    return initial;
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<MessageState | null>(null);

  const handleScoreChange = useCallback((krId: string, value: string) => {
    const parsed = parseFloat(value);
    if (value === '' || value === '.') {
      setScores((prev) => {
        const next = { ...prev };
        delete next[krId];
        return next;
      });
      return;
    }
    if (!Number.isNaN(parsed)) {
      const clamped = Math.min(Math.max(parsed, 0), 1);
      setScores((prev) => ({ ...prev, [krId]: clamped }));
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    const entries = Object.entries(scores);
    if (entries.length === 0) {
      setMessage({ type: 'error', text: 'スコアが入力されていません' });
      return;
    }

    setSaving(true);
    setMessage(null);

    const supabase = createClient();

    try {
      for (const [krId, score] of entries) {
        const { error } = await supabase
          .from('okr_key_results')
          .update({ final_score: score })
          .eq('id', krId);

        if (error) {
          throw new Error(`KR更新エラー (${krId}): ${error.message}`);
        }
      }
      setMessage({ type: 'success', text: 'レビューを送信しました' });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'レビューの送信に失敗しました';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setSaving(false);
    }
  }, [scores]);

  // 全KR数とスコア入力済み数
  const totalKRs = objectives.reduce(
    (sum, obj) => sum + obj.keyResults.length,
    0,
  );
  const scoredKRs = Object.keys(scores).length;
  const allScored = totalKRs > 0 && scoredKRs === totalKRs;

  return (
    <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* ページヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
              四半期レビュー
            </h1>
            <p className="text-sm text-[#737373] mt-1">
              OKRの期末スコアを入力してください (0.0 - 1.0)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 border border-[#333333] text-xs text-[#a3a3a3]">
              {periodName}
            </span>
            <span
              className={`px-3 py-1 border text-xs font-bold ${getStatusBorderColor(periodStatus)}`}
            >
              {getStatusLabel(periodStatus)}
            </span>
          </div>
        </div>

        {/* スコアリングガイド */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3">
          <div className="text-xs text-[#737373] uppercase tracking-wider mb-2">
            OKRスコアリング基準
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-[#3b82f6] font-bold">0.7 - 1.0</span>
              <span className="text-[#737373] ml-2">目標達成 / 超過達成</span>
            </div>
            <div>
              <span className="text-[#22d3ee] font-bold">0.4 - 0.6</span>
              <span className="text-[#737373] ml-2">相当の進捗あり</span>
            </div>
            <div>
              <span className="text-[#f59e0b] font-bold">0.1 - 0.3</span>
              <span className="text-[#737373] ml-2">進捗不十分</span>
            </div>
            <div>
              <span className="text-[#ef4444] font-bold">0.0</span>
              <span className="text-[#737373] ml-2">未着手 / 断念</span>
            </div>
          </div>
        </div>

        {/* Objective別レビュー */}
        {objectives.length === 0 ? (
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 text-center">
            <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">
              レビュー対象のOKRがありません
            </h2>
            <p className="text-sm text-[#737373]">
              この期間に登録されたObjectiveがありません。
            </p>
          </div>
        ) : (
          objectives.map((obj) => (
            <div key={obj.id} className="border border-[#1a1a1a] bg-[#0a0a0a]">
              <div className="border-b border-[#1a1a1a] px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 border border-[#a3a3a3] text-[10px] text-[#a3a3a3] font-bold uppercase">
                    {obj.level}
                  </span>
                </div>
                <h3 className="text-sm text-[#e5e5e5] font-medium">
                  {obj.title}
                </h3>
              </div>
              <div className="divide-y divide-[#111111]">
                {obj.keyResults.map((kr) => {
                  const ratio =
                    kr.targetValue === 0
                      ? 0
                      : Math.min(kr.currentValue / kr.targetValue, 1);
                  const percent = Math.round(ratio * 100);

                  return (
                    <div key={kr.id} className="px-4 py-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-[#e5e5e5]">
                          {kr.title}
                        </span>
                        <span
                          className={`text-xs font-medium ${getConfidenceColor(kr.confidence)}`}
                        >
                          自信度 {kr.confidence}%
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mb-3">
                        <div className="flex-1 h-2 bg-[#1a1a1a]">
                          <div
                            className={`h-full ${getProgressColor(ratio)}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="text-xs text-[#a3a3a3] w-32 text-right">
                          {kr.currentValue}/{kr.targetValue} {kr.unit} (
                          {percent}%)
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="text-xs text-[#737373]">
                          期末スコア:
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="1"
                            step="0.1"
                            value={
                              scores[kr.id] !== undefined
                                ? scores[kr.id]
                                : ''
                            }
                            onChange={(e) =>
                              handleScoreChange(kr.id, e.target.value)
                            }
                            placeholder="0.0 - 1.0"
                            className="w-24 bg-[#111111] border border-[#333333] px-3 py-1.5 text-sm text-[#e5e5e5] focus:border-[#3b82f6] focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}

        {/* メッセージ表示 */}
        {message && (
          <div
            className={`border px-4 py-3 text-sm ${
              message.type === 'success'
                ? 'border-[#22d3ee] text-[#22d3ee] bg-[#0a0a0a]'
                : 'border-[#ef4444] text-[#ef4444] bg-[#0a0a0a]'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* 送信ボタン */}
        {objectives.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#737373]">
              {scoredKRs}/{totalKRs} KR にスコア入力済み
            </span>
            <button
              type="button"
              disabled={saving || !allScored}
              onClick={handleSubmit}
              className={`px-6 py-2 text-sm font-bold uppercase tracking-wider transition-colors ${
                saving || !allScored
                  ? 'bg-[#333333] text-[#737373] cursor-not-allowed'
                  : 'bg-[#3b82f6] text-[#e5e5e5] hover:bg-[#2563eb] cursor-pointer'
              }`}
            >
              {saving ? '送信中...' : 'レビュー送信'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
