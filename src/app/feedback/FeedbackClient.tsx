// =============================================================================
// フィードバック実施クライアントコンポーネント (E-04)
// calibrated状態の評価に対してフィードバック面談を記録する
// =============================================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Rank, Grade, EvaluationStatus } from '@/types/evaluation';
import { submitFeedback, finalizeEvaluation } from '@/lib/evaluation/actions';
import EvalRankBadge from '@/components/shared/EvalRankBadge';
import StatusMessage from '@/components/shared/StatusMessage';
import LoadingButton from '@/components/shared/LoadingButton';

// -----------------------------------------------------------------------------
// 型定義
// -----------------------------------------------------------------------------

interface FeedbackTarget {
  id: string;
  memberName: string;
  grade: Grade;
  divisionName: string;
  totalScore: number;
  quantitativeScore: number | null;
  qualitativeScore: number | null;
  valueScore: number | null;
  phase: string | null;
  rank: Rank;
  status: EvaluationStatus;
  feedbackDate: string | null;
  feedbackNotes: string | null;
  nextActions: string | null;
}

interface FeedbackClientProps {
  targets: FeedbackTarget[];
  isAdmin: boolean;
}

// -----------------------------------------------------------------------------
// スコアバー
// -----------------------------------------------------------------------------

function ScoreBar({ label, score }: { label: string; score: number | null }) {
  if (score === null || score === undefined) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs text-[#737373] w-24 shrink-0">{label}</span>
        <span className="text-xs text-[#555555]">未評価</span>
      </div>
    );
  }

  const pct = Math.min(Math.max(score, 0), 100);

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[#737373] w-24 shrink-0">{label}</span>
      <span className="text-sm text-[#e5e5e5] w-12 text-right shrink-0">
        {score.toFixed(1)}
      </span>
      <div className="flex-1 h-2 bg-[#1a1a1a]">
        <div
          className="h-full bg-[#3b82f6]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-[#555555] w-10 text-right shrink-0">
        {Math.round(pct)}%
      </span>
    </div>
  );
}

// -----------------------------------------------------------------------------
// コンポーネント
// -----------------------------------------------------------------------------

export default function FeedbackClient({ targets: initialTargets, isAdmin }: FeedbackClientProps) {
  const router = useRouter();
  const [targets, setTargets] = useState<FeedbackTarget[]>(initialTargets);
  const [openFormId, setOpenFormId] = useState<string | null>(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [nextActions, setNextActions] = useState('');
  const [saving, setSaving] = useState(false);
  const [finalizingId, setFinalizingId] = useState<string | null>(null);
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

    const result = await submitFeedback(targetId, feedbackComment || null, nextActions || null);

    setSaving(false);

    if (!result.success) {
      setMessage({ type: 'error', text: result.error ?? 'フィードバックの保存に失敗しました。再度お試しください。' });
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

  const handleFinalize = async (targetId: string) => {
    setFinalizingId(targetId);
    setMessage(null);

    const result = await finalizeEvaluation(targetId);
    setFinalizingId(null);

    if (result.success) {
      setTargets((prev) =>
        prev.map((t) => t.id === targetId ? { ...t, status: 'finalized' as EvaluationStatus } : t)
      );
      setMessage({ type: 'success', text: '評価を確定しました。' });
      router.refresh();
    } else {
      setMessage({ type: 'error', text: result.error ?? '確定に失敗しました。' });
    }
  };

  return (
    <>
      {/* メッセージ表示 */}
      <StatusMessage
        message={message?.text ?? null}
        type={message?.type ?? 'success'}
        onDismiss={() => setMessage(null)}
      />

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
                    {isAdmin && target.status === 'feedback_done' && (
                      <div className="pt-2">
                        <LoadingButton
                          loading={finalizingId === target.id}
                          label="評価確定"
                          loadingLabel="処理中..."
                          variant="primary"
                          onClick={() => handleFinalize(target.id)}
                          className="px-3 py-1"
                        />
                      </div>
                    )}
                    {target.status === 'finalized' && (
                      <div className="pt-2">
                        <span className="px-2 py-0.5 border border-[#22c55e] text-[10px] text-[#22c55e] font-bold">
                          確定済
                        </span>
                      </div>
                    )}
                  </div>
                ) : isFormOpen ? (
                  <div className="space-y-4">
                    {/* 評価サマリーパネル */}
                    <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
                      <div className="text-xs text-[#737373] uppercase tracking-wider mb-3">
                        評価サマリー
                      </div>
                      <div className="flex items-center gap-4 mb-4">
                        <span className="text-lg font-bold text-[#e5e5e5]">
                          総合: {target.totalScore.toFixed(1)}点
                        </span>
                        <EvalRankBadge rank={target.rank} size="md" />
                        <span className="px-2 py-0.5 border border-[#333333] text-xs text-[#a3a3a3]">
                          {target.grade}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <ScoreBar label="定量 (KPI)" score={target.quantitativeScore} />
                        <ScoreBar label="定性 (行動)" score={target.qualitativeScore} />
                        <ScoreBar label="バリュー" score={target.valueScore} />
                      </div>
                    </div>

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
                      <LoadingButton
                        loading={saving}
                        label="FB実施完了"
                        loadingLabel="保存中..."
                        variant="primary"
                        onClick={() => handleSubmit(target.id)}
                      />
                      <LoadingButton
                        loading={false}
                        disabled={saving}
                        label="キャンセル"
                        variant="secondary"
                        onClick={handleCancel}
                      />
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
