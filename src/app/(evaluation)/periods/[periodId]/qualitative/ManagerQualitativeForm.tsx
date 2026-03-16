'use client';

// =============================================================================
// 上長評価 - 定性行動評価フォーム (Client Component)
// メンバーの自己評価スコアを参照しながら、上長がスコアとコメントを入力する
// =============================================================================

import { useState, useCallback } from 'react';
import { saveManagerQualitativeScores } from '@/lib/evaluation/actions';
import type { BehaviorScore, Grade } from '@/types/evaluation';

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
  manager_score: BehaviorScore | null;
  comment: string | null;
  is_upper_grade_behavior: boolean;
}

interface ManagerQualitativeFormProps {
  evaluationId: string;
  periodId: string;
  memberId: string;
  memberName: string;
  memberGrade: Grade;
  behaviorItems: BehaviorItemData[];
  existingScores: ExistingBehaviorScore[];
}

interface ManagerRowState {
  manager_score: BehaviorScore | null;
  manager_comment: string;
  is_upper_grade: boolean;
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

function renderScoreBadge(score: BehaviorScore | null) {
  if (score === null) {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 border border-[#333333] text-xs text-[#404040]">
        -
      </span>
    );
  }
  const config = SCORE_LABELS[score];
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 font-bold text-xs ${config.color}`}>
      {config.symbol}{score}
    </span>
  );
}

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------

export default function ManagerQualitativeForm({
  evaluationId,
  periodId,
  memberId,
  memberName,
  memberGrade,
  behaviorItems,
  existingScores,
}: ManagerQualitativeFormProps) {
  // 自己評価スコアのマップ (READONLY参照用)
  const selfScoreMap = new Map(
    existingScores.map((s) => [s.behavior_item_id, s])
  );

  // 上長評価の初期state構築
  const initialRows: Record<string, ManagerRowState> = {};
  for (const item of behaviorItems) {
    const existing = selfScoreMap.get(item.id);
    initialRows[item.id] = {
      manager_score: existing?.manager_score ?? null,
      manager_comment: existing?.comment ?? '',
      is_upper_grade: existing?.is_upper_grade_behavior ?? false,
    };
  }

  const [rows, setRows] = useState<Record<string, ManagerRowState>>(initialRows);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const setScore = useCallback((itemId: string, score: BehaviorScore) => {
    setRows((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], manager_score: score },
    }));
  }, []);

  const setComment = useCallback((itemId: string, comment: string) => {
    setRows((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], manager_comment: comment },
    }));
  }, []);

  const toggleUpperGrade = useCallback((itemId: string) => {
    setRows((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], is_upper_grade: !prev[itemId].is_upper_grade },
    }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setMessage(null);

    const scores = behaviorItems.map((item) => {
      const row = rows[item.id];
      return {
        behavior_item_id: item.id,
        manager_score: row.manager_score,
        is_upper_grade_behavior: row.is_upper_grade,
        manager_comment: row.manager_comment || null,
      };
    });

    const result = await saveManagerQualitativeScores(evaluationId, scores);

    if (result.success) {
      setMessage({ type: 'success', text: '上長評価を保存しました' });
    } else {
      setMessage({ type: 'error', text: result.error ?? '保存に失敗しました' });
    }

    setSaving(false);
  }, [evaluationId, behaviorItems, rows]);

  const completedCount = behaviorItems.filter(
    (item) => rows[item.id].manager_score !== null
  ).length;

  // memberId is used for potential navigation; suppress unused warning
  void memberId;

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
            上長評価 - 定性評価 (行動)
          </h1>
          <p className="text-sm text-[#737373] mt-1">
            メンバーの自己評価を参照し、上長としてのスコアを入力してください
          </p>
        </div>
        <span className="px-3 py-1 border border-[#333333] text-xs text-[#a3a3a3]">
          入力済: {completedCount} / {behaviorItems.length}
        </span>
      </div>

      {/* 対象メンバー情報 */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3 flex items-center gap-4">
        <div>
          <div className="text-xs text-[#737373] uppercase tracking-wider mb-1">
            評価対象メンバー
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-[#e5e5e5]">{memberName}</span>
            <span className="px-2 py-0.5 border border-[#333333] text-[10px] text-[#a3a3a3] uppercase tracking-wider">
              {memberGrade}
            </span>
          </div>
        </div>
      </div>

      {/* スコア基準 */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3">
        <div className="text-xs text-[#737373] uppercase tracking-wider mb-2">
          評価基準
        </div>
        <div className="grid grid-cols-4 gap-4 text-xs">
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
          const selfData = selfScoreMap.get(item.id);
          const selfScore = selfData?.self_score ?? null;
          const selfComment = selfData?.comment ?? null;

          return (
            <div key={item.id} className="border border-[#1a1a1a] bg-[#0a0a0a]">
              {/* 項目ヘッダー */}
              <div className="px-4 py-3 border-b border-[#1a1a1a]">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#e5e5e5]">{item.name}</h3>
                  <div className="flex items-center gap-2">
                    {/* 上長評価スコアバッジ */}
                    {renderScoreBadge(row.manager_score)}
                  </div>
                </div>
                <p className="text-xs text-[#737373] mt-1">{item.criteria}</p>
              </div>

              <div className="px-4 py-3 space-y-4">
                {/* 自己評価 (READONLY参照) */}
                <div className="border border-[#1a1a1a] bg-[#111111] px-3 py-2">
                  <div className="text-[10px] text-[#737373] uppercase tracking-wider mb-2">
                    自己評価 (参照)
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs text-[#737373]">スコア:</span>
                    {selfScore !== null ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold ${SCORE_LABELS[selfScore].color}`}>
                        {SCORE_LABELS[selfScore].symbol}{selfScore} {SCORE_LABELS[selfScore].label}
                      </span>
                    ) : (
                      <span className="text-xs text-[#404040]">未入力</span>
                    )}
                  </div>
                  {selfComment && (
                    <div>
                      <span className="text-xs text-[#737373]">コメント:</span>
                      <p className="text-xs text-[#a3a3a3] mt-1">{selfComment}</p>
                    </div>
                  )}
                  {!selfComment && (
                    <div>
                      <span className="text-xs text-[#737373]">コメント:</span>
                      <p className="text-xs text-[#404040] mt-1">未入力</p>
                    </div>
                  )}
                </div>

                {/* 上長評価スコア入力 */}
                <div>
                  <div className="text-xs text-[#737373] mb-2">上長評価スコア</div>
                  <div className="flex items-center gap-2">
                    {SCORE_OPTIONS.map((score) => {
                      const config = SCORE_LABELS[score];
                      const isSelected = row.manager_score === score;
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
                </div>

                {/* 上位等級行動フラグ */}
                <div>
                  <div className="text-xs text-[#737373] mb-2">上位等級行動判定</div>
                  <button
                    type="button"
                    onClick={() => toggleUpperGrade(item.id)}
                    className={`px-3 py-1 text-xs transition-colors ${
                      row.is_upper_grade
                        ? 'bg-[#ccff00] text-[#050505] font-bold'
                        : 'border border-[#333333] text-[#404040] hover:border-[#ccff00] hover:text-[#ccff00]'
                    }`}
                  >
                    {row.is_upper_grade ? '上位等級行動' : '上位等級行動なし'}
                  </button>
                </div>

                {/* 上長コメント入力 */}
                <div>
                  <div className="text-xs text-[#737373] mb-1">上長コメント (任意)</div>
                  <textarea
                    value={row.manager_comment}
                    onChange={(e) => setComment(item.id, e.target.value)}
                    rows={2}
                    className="w-full bg-[#111111] border border-[#333333] text-[#a3a3a3] px-3 py-2 text-sm focus:border-[#3b82f6] focus:outline-none resize-none"
                    placeholder="評価の根拠やフィードバックを記載してください"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 上位等級行動ボーナス説明 */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3">
        <div className="text-xs text-[#737373]">
          <span className="text-[#ccff00] font-bold">上位等級行動ボーナス:</span>{' '}
          メンバーが現在の等級より上位の行動基準を満たしている項目に「上位等級行動」フラグを設定してください。
          1-2項目で+1段階、3項目以上で+2段階のランクアップが最終評価に適用されます。
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
      </div>
    </div>
  );
}
