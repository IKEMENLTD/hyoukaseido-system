'use client';

// =============================================================================
// 自己評価 - サマリー提出フォーム (Client Component)
// スコアサマリーの表示、自己コメント入力、提出ボタン
// =============================================================================

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { updateTotalScoreAndRank } from '@/lib/evaluation/update-evaluation-scores';
import type { Rank, Phase } from '@/types/evaluation';
import { PHASE_WEIGHTS } from '@/types/evaluation';
import EvalRankBadge from '@/components/shared/EvalRankBadge';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface ScoreData {
  quantitative_score: number | null;
  qualitative_score: number | null;
  value_score: number | null;
}

interface SelfSummarySubmitProps {
  evaluationId: string;
  periodId: string;
  memberName: string;
  grade: string;
  divisionName: string;
  phase: Phase;
  periodName: string;
  scores: ScoreData;
  existingSelfComment: string | null;
  isSubmitted: boolean;
  /** 各セクションにスコアデータ（少なくとも1件の入力）があるかどうか */
  hasQuantitativeData: boolean;
  hasQualitativeData: boolean;
  hasValueData: boolean;
}

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

function calculateRank(score: number): Rank {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------

export default function SelfSummarySubmit({
  evaluationId,
  periodId,
  memberName,
  grade,
  divisionName,
  phase,
  periodName,
  scores,
  existingSelfComment,
  isSubmitted,
  hasQuantitativeData,
  hasQualitativeData,
  hasValueData,
}: SelfSummarySubmitProps) {
  const router = useRouter();
  const [selfComment, setSelfComment] = useState(existingSelfComment ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const weights = PHASE_WEIGHTS[phase];

  // スコアが入っている場合のみ加重計算
  const quantScore = scores.quantitative_score ?? 0;
  const qualScore = scores.qualitative_score ?? 0;
  const valScore = scores.value_score ?? 0;

  const weightedTotal =
    (quantScore * weights.quantitative / 100) +
    (qualScore * weights.qualitative / 100) +
    (valScore * weights.value / 100);

  const estimatedRank = calculateRank(weightedTotal);

  // 全セクションにデータがあるか
  const allSectionsComplete = hasQuantitativeData && hasQualitativeData && hasValueData;

  const scoreBreakdown = [
    {
      label: '定量評価 (KPI)',
      weight: weights.quantitative,
      score: scores.quantitative_score,
      color: 'text-[#3b82f6]',
      barColor: 'bg-[#3b82f6]',
      hasData: hasQuantitativeData,
    },
    {
      label: '定性評価 (行動)',
      weight: weights.qualitative,
      score: scores.qualitative_score,
      color: 'text-[#22d3ee]',
      barColor: 'bg-[#22d3ee]',
      hasData: hasQualitativeData,
    },
    {
      label: 'バリュー評価',
      weight: weights.value,
      score: scores.value_score,
      color: 'text-[#a855f7]',
      barColor: 'bg-[#a855f7]',
      hasData: hasValueData,
    },
  ];

  const handleSubmit = useCallback(async () => {
    if (!allSectionsComplete) return;

    setSubmitting(true);
    setMessage(null);

    const supabase = createClient();

    // Calculate and persist total score and rank first
    await updateTotalScoreAndRank(evaluationId);

    const { error } = await supabase
      .from('evaluations')
      .update({
        self_comment: selfComment || null,
        status: 'self_submitted',
      })
      .eq('id', evaluationId);

    if (error) {
      setMessage({ type: 'error', text: `提出に失敗しました: ${error.message}` });
    } else {
      setMessage({ type: 'success', text: '自己評価を提出しました' });
      router.refresh();
    }

    setSubmitting(false);
  }, [evaluationId, selfComment, allSectionsComplete, router]);

  const handleSaveDraft = useCallback(async () => {
    setSubmitting(true);
    setMessage(null);

    const supabase = createClient();

    const { error } = await supabase
      .from('evaluations')
      .update({ self_comment: selfComment || null })
      .eq('id', evaluationId);

    if (error) {
      setMessage({ type: 'error', text: `保存に失敗しました: ${error.message}` });
    } else {
      setMessage({ type: 'success', text: 'コメントを保存しました' });
    }

    setSubmitting(false);
  }, [evaluationId, selfComment]);

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
            自己評価サマリー
          </h1>
          <p className="text-sm text-[#737373] mt-1">
            {periodName}
          </p>
        </div>
        <span className={`px-3 py-1 border text-xs font-bold ${
          isSubmitted
            ? 'text-[#22d3ee] border-[#22d3ee]'
            : 'text-[#f59e0b] border-[#f59e0b]'
        }`}>
          {isSubmitted ? '提出済' : '下書き'}
        </span>
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

      {/* メンバー情報と推定ランク */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
          <div className="text-xs text-[#737373] uppercase tracking-wider mb-3">
            対象者
          </div>
          <div className="text-lg text-[#e5e5e5] font-bold mb-2">
            {memberName}
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 border border-[#3b82f6] text-xs text-[#3b82f6] font-bold">
              {grade}
            </span>
            <span className="text-xs text-[#737373]">{divisionName}</span>
          </div>
        </div>

        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 flex flex-col items-center justify-center">
          <div className="text-xs text-[#737373] uppercase tracking-wider mb-2">
            推定ランク (自己評価ベース)
          </div>
          <EvalRankBadge rank={estimatedRank} size="xl" />
          <div className="text-sm text-[#e5e5e5] font-bold mt-2">
            {weightedTotal.toFixed(1)} 点
          </div>
          <div className="text-[10px] text-[#404040] mt-1">
            最終ランクは上長評価後に確定
          </div>
        </div>
      </div>

      {/* スコア内訳 */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="border-b border-[#1a1a1a] px-4 py-3">
          <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
            スコア内訳
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a1a1a] text-[#737373]">
                <th className="px-4 py-2 text-left font-medium">評価区分</th>
                <th className="px-4 py-2 text-right font-medium">ウェイト</th>
                <th className="px-4 py-2 text-right font-medium">スコア</th>
                <th className="px-4 py-2 text-right font-medium">加重スコア</th>
                <th className="px-4 py-2 text-left font-medium">プログレス</th>
              </tr>
            </thead>
            <tbody>
              {scoreBreakdown.map((row) => (
                <tr key={row.label} className="border-b border-[#111111]">
                  <td className="px-4 py-3 text-[#e5e5e5]">
                    {row.label}
                    {!row.hasData && (
                      <span className="ml-2 text-[10px] text-[#ef4444]">未入力</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-[#a3a3a3]">{row.weight}%</td>
                  <td className="px-4 py-3 text-right text-[#e5e5e5] font-bold">
                    {row.score !== null ? Number(row.score).toFixed(1) : '---'}
                  </td>
                  <td className={`px-4 py-3 text-right font-bold ${row.color}`}>
                    {row.score !== null ? (Number(row.score) * row.weight / 100).toFixed(1) : '---'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-2 bg-[#1a1a1a] w-full max-w-32">
                      {row.score !== null && (
                        <div className={`h-full ${row.barColor}`} style={{ width: `${Math.min(Number(row.score), 100)}%` }} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#1a1a1a]">
                <td className="px-4 py-3 text-[#e5e5e5] font-bold">合計</td>
                <td className="px-4 py-3 text-right text-[#a3a3a3]">100%</td>
                <td className="px-4 py-3 text-right text-[#e5e5e5]">---</td>
                <td className="px-4 py-3 text-right text-[#e5e5e5] font-bold text-lg">
                  {weightedTotal.toFixed(1)}
                </td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 自己コメント */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="border-b border-[#1a1a1a] px-4 py-3">
          <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
            自己コメント
          </h3>
        </div>
        <div className="px-4 py-3">
          {isSubmitted ? (
            <p className="text-sm text-[#e5e5e5] leading-relaxed">
              {selfComment || '未入力'}
            </p>
          ) : (
            <textarea
              value={selfComment}
              onChange={(e) => setSelfComment(e.target.value)}
              rows={4}
              className="w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] px-3 py-2 text-sm focus:border-[#3b82f6] focus:outline-none resize-none"
              placeholder="今期の振り返り、成果、課題などを記載してください"
            />
          )}
        </div>
      </div>

      {/* 未完了セクションの警告 */}
      {!allSectionsComplete && !isSubmitted && (
        <div className="border border-[#f59e0b] bg-[#0a0a0a] px-4 py-3">
          <p className="text-sm text-[#f59e0b]">
            全ての評価セクションにデータを入力してから提出してください。
          </p>
          <ul className="mt-2 text-xs text-[#737373] space-y-1">
            {!hasQuantitativeData && <li>- 定量評価 (KPI) が未入力です</li>}
            {!hasQualitativeData && <li>- 定性評価 (行動) が未入力です</li>}
            {!hasValueData && <li>- バリュー評価が未入力です</li>}
          </ul>
        </div>
      )}

      {/* アクションボタン */}
      <div className="flex items-center justify-between">
        <a
          href={`/self/${periodId}`}
          className="px-4 py-2 border border-[#333333] text-xs text-[#a3a3a3] hover:border-[#555555] transition-colors"
        >
          戻る
        </a>
        {!isSubmitted && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={submitting}
              className={`px-4 py-2 border text-xs transition-colors ${
                submitting
                  ? 'border-[#333333] text-[#737373] cursor-not-allowed'
                  : 'border-[#333333] text-[#a3a3a3] hover:border-[#555555]'
              }`}
            >
              {submitting ? '保存中...' : '下書き保存'}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !allSectionsComplete}
              className={`px-6 py-2 text-sm font-bold uppercase tracking-wider transition-colors ${
                submitting || !allSectionsComplete
                  ? 'bg-[#3b82f6] text-[#050505] opacity-50 cursor-not-allowed'
                  : 'bg-[#3b82f6] text-[#050505] hover:bg-[#2563eb]'
              }`}
            >
              {submitting ? '提出中...' : '自己評価を提出'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
