// =============================================================================
// フィードバック実施クライアントコンポーネント (E-04)
// calibrated状態の評価に対してフィードバック面談を記録する
// =============================================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Rank, Grade, EvaluationStatus } from '@/types/evaluation';
import { createClient } from '@/lib/supabase/client';
import EvalRankBadge from '@/components/shared/EvalRankBadge';

// -----------------------------------------------------------------------------
// 型定義
// -----------------------------------------------------------------------------

interface FeedbackTarget {
  id: string;
  memberName: string;
  grade: Grade;
  divisionName: string;
  totalScore: number;
  rank: Rank;
  status: EvaluationStatus;
  feedbackDate: string | null;
  feedbackNotes: string | null;
  nextActions: string | null;
}

interface FeedbackClientProps {
  targets: FeedbackTarget[];
}

// -----------------------------------------------------------------------------
// コンポーネント
// -----------------------------------------------------------------------------

export default function FeedbackClient({ targets: initialTargets }: FeedbackClientProps) {
  const router = useRouter();
  const [targets, setTargets] = useState<FeedbackTarget[]>(initialTargets);
  const [openFormId, setOpenFormId] = useState<string | null>(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [nextActions, setNextActions] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleOpenForm = (target: FeedbackTarget) => {
    setOpenFormId(target.id);
    setFeedbackComment(target.feedbackNotes ?? '');
    setNextActions(target.nextActions ?? '');
    setMessage(null);
  };

  const handleCancel = () => {
    setOpenFormId(null);
    setFeedbackComment('');
    setNextActions('');
    setMessage(null);
  };

  const handleSubmit = async (targetId: string) => {
    setSaving(true);
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase
      .from('evaluations')
      .update({
        evaluator_comment: feedbackComment,
        next_actions: nextActions,
        status: 'feedback_done' as const,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetId)
      .eq('status', 'calibrated');

    setSaving(false);

    if (error) {
      setMessage({ type: 'error', text: 'フィードバックの保存に失敗しました。再度お試しください。' });
      return;
    }

    // ローカルステートを更新
    setTargets((prev) =>
      prev.map((t) =>
        t.id === targetId
          ? {
              ...t,
              status: 'feedback_done' as EvaluationStatus,
              feedbackDate: new Date().toISOString().split('T')[0],
              feedbackNotes: feedbackComment,
              nextActions,
            }
          : t,
      ),
    );

    setOpenFormId(null);
    setFeedbackComment('');
    setNextActions('');
    setMessage({ type: 'success', text: 'フィードバックを記録しました。' });

    // サーバー側データを再取得してサマリーカードも更新
    router.refresh();
  };

  return (
    <>
      {/* メッセージ表示 */}
      {message && (
        <div
          className={`border px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'border-[#22d3ee]/30 bg-[#22d3ee]/5 text-[#22d3ee]'
              : 'border-[#ef4444]/30 bg-[#ef4444]/5 text-[#ef4444]'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* フィードバック対象者一覧 */}
      <div className="space-y-4">
        {targets.map((target) => {
          const isDone = target.status === 'feedback_done';
          const isFormOpen = openFormId === target.id;

          return (
            <div
              key={target.id}
              className={`border bg-[#0a0a0a] ${isDone ? 'border-[#1a1a1a]' : 'border-[#f59e0b]/30'}`}
            >
              {/* カードヘッダー */}
              <div className="border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[#e5e5e5] font-bold">{target.memberName}</span>
                  <span className="px-2 py-0.5 border border-[#333333] text-xs text-[#a3a3a3]">
                    {target.grade}
                  </span>
                  <span className="text-xs text-[#737373]">{target.divisionName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <EvalRankBadge rank={target.rank} size="md" />
                  <span className="text-sm text-[#e5e5e5] font-bold">
                    {target.totalScore.toFixed(1)}点
                  </span>
                </div>
              </div>

              {/* カードボディ */}
              <div className="p-4">
                {isDone ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 border border-[#22d3ee] text-[10px] text-[#22d3ee] font-bold">
                        FB済
                      </span>
                      <span className="text-xs text-[#737373]">{target.feedbackDate}</span>
                    </div>
                    {target.feedbackNotes && (
                      <div>
                        <span className="text-xs text-[#737373]">コメント:</span>
                        <p className="text-sm text-[#a3a3a3] mt-1">{target.feedbackNotes}</p>
                      </div>
                    )}
                    {target.nextActions && (
                      <div>
                        <span className="text-xs text-[#737373]">次期アクション:</span>
                        <p className="text-sm text-[#a3a3a3] mt-1">{target.nextActions}</p>
                      </div>
                    )}
                  </div>
                ) : isFormOpen ? (
                  <div className="space-y-4">
                    {/* フィードバックコメント */}
                    <div>
                      <label className="block text-xs text-[#a3a3a3] mb-1">
                        フィードバックコメント
                      </label>
                      <textarea
                        value={feedbackComment}
                        onChange={(e) => setFeedbackComment(e.target.value)}
                        rows={4}
                        className="w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] px-3 py-2 text-sm focus:border-[#3b82f6] focus:outline-none resize-vertical"
                        placeholder="評価結果に対するフィードバック内容を入力してください"
                      />
                    </div>

                    {/* 次期アクション */}
                    <div>
                      <label className="block text-xs text-[#a3a3a3] mb-1">
                        次期アクション
                      </label>
                      <textarea
                        value={nextActions}
                        onChange={(e) => setNextActions(e.target.value)}
                        rows={3}
                        className="w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] px-3 py-2 text-sm focus:border-[#3b82f6] focus:outline-none resize-vertical"
                        placeholder="次の評価期間に向けたアクションプランを入力してください"
                      />
                    </div>

                    {/* ボタン群 */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleSubmit(target.id)}
                        disabled={saving}
                        className={`px-4 py-2 border text-xs font-bold ${
                          saving
                            ? 'border-[#333333] text-[#737373] cursor-not-allowed'
                            : 'border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6] hover:bg-[#3b82f6]/20'
                        }`}
                      >
                        {saving ? '保存中...' : 'FB実施完了'}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancel}
                        disabled={saving}
                        className="px-4 py-2 border border-[#333333] text-xs text-[#a3a3a3] font-bold hover:border-[#555555]"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#f59e0b]">フィードバック未実施</span>
                    <button
                      type="button"
                      onClick={() => handleOpenForm(target)}
                      className="px-4 py-2 border border-[#3b82f6] text-xs text-[#3b82f6] font-bold hover:bg-[#3b82f6]/10"
                    >
                      FB実施
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export type { FeedbackTarget };
