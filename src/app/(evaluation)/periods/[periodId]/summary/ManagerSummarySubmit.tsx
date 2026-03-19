'use client';

// =============================================================================
// 上長評価 - サマリー提出フォーム (Client Component)
// スコアサマリー表示、上長コメント・次期アクション入力、提出ボタン
// =============================================================================

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { submitManagerEvaluation, saveManagerDraft } from '@/lib/evaluation/actions';
import type { Rank, Phase, Grade } from '@/types/evaluation';
import { PHASE_WEIGHTS, SALARY_CHANGE } from '@/types/evaluation';
import EvalRankBadge from '@/components/shared/EvalRankBadge';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface ScoreData {
  quantitative_score: number | null;
  qualitative_score: number | null;
  value_score: number | null;
}

interface ManagerSummarySubmitProps {
  evaluationId: string;
  periodId: string;
  memberName: string;
  grade: Grade;
  divisionName: string;
  phase: Phase;
  periodName: string;
  scores: ScoreData;
  existingSelfComment: string | null;
  existingEvaluatorComment: string | null;
  existingNextActions: string | null;
  isReadonly: boolean;
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

export default function ManagerSummarySubmit({
  evaluationId,
  periodId,
  memberName,
  grade,
  divisionName,
  phase,
  periodName,
  scores,
  existingSelfComment,
  existingEvaluatorComment,
  existingNextActions,
  isReadonly,
  hasQuantitativeData,
  hasQualitativeData,
  hasValueData,
}: ManagerSummarySubmitProps) {
  const router = useRouter();
  const [evaluatorComment, setEvaluatorComment] = useState(existingEvaluatorComment ?? '');
  const [nextActions, setNextActions] = useState(existingNextActions ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const weights = PHASE_WEIGHTS[phase];

  // スコア計算
  const quantScore = scores.quantitative_score ?? 0;
  const qualScore = scores.qualitative_score ?? 0;
  const valScore = scores.value_score ?? 0;

  const weightedTotal =
    (quantScore * weights.quantitative / 100) +
    (qualScore * weights.qualitative / 100) +
    (valScore * weights.value / 100);

  const estimatedRank = calculateRank(weightedTotal);
  const salaryChange = SALARY_CHANGE[estimatedRank];

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

    const confirmed = window.confirm(
      '上長評価を提出します。提出後は内容の編集ができなくなります。\n\nよろしいですか？'
    );
    if (!confirmed) return;

    setSubmitting(true);
    setMessage(null);

    const result = await submitManagerEvaluation(
      evaluationId,
      evaluatorComment || null,
      nextActions || null
    );

    if (result.success) {
      setMessage({ type: 'success', text: '上長評価を提出しました' });
      router.refresh();
    } else {
      setMessage({ type: 'error', text: result.error ?? '提出に失敗しました' });
    }

    setSubmitting(false);
  }, [evaluationId, evaluatorComment, nextActions, allSectionsComplete, router]);

  const handleSaveDraft = useCallback(async () => {
    setSubmitting(true);
    setMessage(null);

    const result = await saveManagerDraft(evaluationId, evaluatorComment || null);

    if (result.success) {
      setMessage({ type: 'success', text: '上長コメントを保存しました' });
    } else {
      setMessage({ type: 'error', text: result.error ?? '保存に失敗しました' });
    }

    setSubmitting(false);
  }, [evaluationId, evaluatorComment]);

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
            上長評価サマリー
          </h1>
          <p className="text-sm text-[#737373] mt-1">
            {periodName}
          </p>
        </div>
        <span className={`px-3 py-1 border text-xs font-bold ${
          isReadonly
            ? 'text-[#22d3ee] border-[#22d3ee]'
            : 'text-[#f59e0b] border-[#f59e0b]'
        }`}>
          {isReadonly ? '提出済' : '評価中'}
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* メンバー情報 */}
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

        {/* 推定ランク */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 flex flex-col items-center justify-center">
          <div className="text-xs text-[#737373] uppercase tracking-wider mb-2">
            推定ランク
          </div>
          <EvalRankBadge rank={estimatedRank} size="xl" />
          <div className="text-sm text-[#e5e5e5] font-bold mt-2">
            {weightedTotal.toFixed(1)} 点
          </div>
          <div className="text-[10px] text-[#404040] mt-1">
            最終ランクはキャリブレーション後に確定
          </div>
        </div>

        {/* 処遇見込み */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
          <div className="text-xs text-[#737373] uppercase tracking-wider mb-3">
            処遇見込み
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#737373]">推定昇給額</span>
              <span className={`text-sm font-bold ${salaryChange >= 0 ? 'text-[#22d3ee]' : 'text-[#ef4444]'}`}>
                {salaryChange >= 0 ? '+' : ''}{salaryChange.toLocaleString()}円
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#737373]">フェーズ</span>
              <span className="text-xs font-bold text-[#a3a3a3]">
                {phase === 'profitable' ? '黒字事業' : '赤字事業'}
              </span>
            </div>
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

      {/* 自己コメント (読み取り専用) */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="border-b border-[#1a1a1a] px-4 py-3">
          <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
            自己コメント (本人記入)
          </h3>
        </div>
        <div className="px-4 py-3">
          <p className="text-sm text-[#e5e5e5] leading-relaxed">
            {existingSelfComment || '未入力'}
          </p>
        </div>
      </div>

      {/* 上長コメント */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="border-b border-[#1a1a1a] px-4 py-3">
          <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
            上長コメント
          </h3>
        </div>
        <div className="px-4 py-3">
          {isReadonly ? (
            <p className="text-sm text-[#e5e5e5] leading-relaxed">
              {evaluatorComment || '未入力'}
            </p>
          ) : (
            <textarea
              value={evaluatorComment}
              onChange={(e) => setEvaluatorComment(e.target.value)}
              rows={4}
              className="w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] px-3 py-2 text-sm focus:border-[#3b82f6] focus:outline-none resize-none"
              placeholder="メンバーへの評価コメントを記載してください"
            />
          )}
        </div>
      </div>

      {/* 次期アクション */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="border-b border-[#1a1a1a] px-4 py-3">
          <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
            次期アクション
          </h3>
        </div>
        <div className="px-4 py-3">
          {isReadonly ? (
            <p className="text-sm text-[#e5e5e5] leading-relaxed">
              {nextActions || '未入力'}
            </p>
          ) : (
            <textarea
              value={nextActions}
              onChange={(e) => setNextActions(e.target.value)}
              rows={3}
              className="w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] px-3 py-2 text-sm focus:border-[#3b82f6] focus:outline-none resize-none"
              placeholder="来期に向けた改善点やアクションプランを記載してください"
            />
          )}
        </div>
      </div>

      {/* 未完了セクションの警告 */}
      {!allSectionsComplete && !isReadonly && (
        <div className="border border-[#f59e0b] bg-[#0a0a0a] px-4 py-3">
          <p className="text-sm text-[#f59e0b]">
            全ての評価セクションにデータが入力されていません。提出前にご確認ください。
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
          href={`/periods/${periodId}`}
          className="px-4 py-2 border border-[#333333] text-xs text-[#a3a3a3] hover:border-[#555555] transition-colors"
        >
          戻る
        </a>
        {!isReadonly && (
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
              {submitting ? '提出中...' : '上長評価を提出'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
