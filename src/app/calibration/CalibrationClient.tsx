// =============================================================================
// キャリブレーション クライアントコンポーネント (E-03)
// ランク調整インタラクション・分布リアルタイム計算・確定処理
// =============================================================================

'use client';

import { useState, useCallback, useMemo } from 'react';
import { calibrateEvaluation } from '@/lib/evaluation/actions';
import { downloadCSV } from '@/lib/utils/csv-export';
import EvalRankBadge from '@/components/shared/EvalRankBadge';
import ConfirmModal from '@/components/shared/ConfirmModal';
import StatusMessage from '@/components/shared/StatusMessage';
import LoadingButton from '@/components/shared/LoadingButton';
import type { Rank } from '@/types/evaluation';
import { SALARY_CHANGE } from '@/types/evaluation';

// -----------------------------------------------------------------------------
// 型定義
// -----------------------------------------------------------------------------

interface CalibrationEvaluation {
  id: string;
  memberName: string;
  grade: string;
  divisionName: string;
  evaluatorName: string;
  quantitativeScore: number;
  qualitativeScore: number;
  valueScore: number;
  totalScore: number;
  proposedRank: string;
  currentStatus: string;
  salaryChangeRecommended: number | null;
  promotionEligibility: string | null;
}

interface CalibrationProps {
  evalPeriodName: string;
  evaluations: CalibrationEvaluation[];
}

// -----------------------------------------------------------------------------
// 定数
// -----------------------------------------------------------------------------

const RANKS: readonly Rank[] = ['S', 'A', 'B', 'C', 'D'] as const;

const TARGET_DISTRIBUTION: Record<Rank, string> = {
  S: '5-10%',
  A: '20-25%',
  B: '40-50%',
  C: '15-20%',
  D: '5-10%',
};

// -----------------------------------------------------------------------------
// コンポーネント
// -----------------------------------------------------------------------------

export default function CalibrationClient({ evalPeriodName, evaluations }: CalibrationProps) {
  // finalRank状態: evaluationId -> 選択されたRank
  const [finalRanks, setFinalRanks] = useState<Record<string, Rank>>(() => {
    const initial: Record<string, Rank> = {};
    for (const evaluation of evaluations) {
      if (evaluation.proposedRank && isValidRank(evaluation.proposedRank)) {
        initial[evaluation.id] = evaluation.proposedRank;
      }
    }
    return initial;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // ランク分布をリアルタイム計算
  const distribution = useMemo(() => {
    const dist: Record<Rank, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    for (const evaluation of evaluations) {
      const rank = finalRanks[evaluation.id];
      if (rank) {
        dist[rank] += 1;
      }
    }
    return dist;
  }, [evaluations, finalRanks]);

  // 調整済みカウント（proposedRankから変更されたもの）
  const adjustedCount = useMemo(() => {
    let count = 0;
    for (const evaluation of evaluations) {
      const finalRank = finalRanks[evaluation.id];
      if (finalRank && finalRank !== evaluation.proposedRank) {
        count += 1;
      }
    }
    return count;
  }, [evaluations, finalRanks]);

  const totalMembers = evaluations.length;

  // 全員にランクが設定されているか
  const allRanksAssigned = useMemo(() => {
    return evaluations.every((e) => finalRanks[e.id] !== undefined);
  }, [evaluations, finalRanks]);

  const handleRankChange = useCallback((evaluationId: string, rank: Rank) => {
    setFinalRanks((prev) => ({ ...prev, [evaluationId]: rank }));
    setSubmitSuccess(false);
    setSubmitError(null);
  }, []);

  const handleCalibrateClick = useCallback(() => {
    if (!allRanksAssigned) return;
    setConfirmOpen(true);
  }, [allRanksAssigned]);

  const handleConfirmCalibrate = useCallback(async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    setConfirmOpen(false);

    const targetEvaluations = evaluations.filter((e) => finalRanks[e.id]);
    setProgress({ current: 0, total: targetEvaluations.length });

    try {
      for (let i = 0; i < targetEvaluations.length; i++) {
        const evaluation = targetEvaluations[i];
        const rank = finalRanks[evaluation.id];
        if (!rank) continue;

        setProgress({ current: i + 1, total: targetEvaluations.length });
        const result = await calibrateEvaluation(evaluation.id, rank);
        if (!result.success) {
          throw new Error(result.error ?? `評価ID ${evaluation.id} の更新に失敗しました`);
        }
      }

      setSubmitSuccess(true);
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : 'キャリブレーション確定中にエラーが発生しました';
      setSubmitError(errMessage);
    } finally {
      setIsSubmitting(false);
      setProgress({ current: 0, total: 0 });
    }
  }, [evaluations, finalRanks]);

  // CSV出力ハンドラ
  const handleCsvExport = useCallback(() => {
    const headers = [
      '名前', '等級', '事業部', '評価者',
      '定量スコア', '定性スコア', 'バリュースコア', '総合スコア',
      '提案ランク', '最終ランク', '昇給額', '昇格適格性',
    ];

    const rows = evaluations.map((member) => {
      const finalRank = finalRanks[member.id] ?? '';
      const salaryChange = finalRank && isValidRank(finalRank)
        ? String(SALARY_CHANGE[finalRank])
        : member.salaryChangeRecommended !== null
          ? String(member.salaryChangeRecommended)
          : '';
      const promotion = member.promotionEligibility ?? '';

      return [
        member.memberName,
        member.grade,
        member.divisionName,
        member.evaluatorName,
        String(member.quantitativeScore),
        String(member.qualitativeScore),
        String(member.valueScore),
        member.totalScore.toFixed(1),
        member.proposedRank,
        finalRank,
        salaryChange,
        promotion,
      ];
    });

    const today = new Date().toISOString().slice(0, 10);
    const filename = `評価結果_${evalPeriodName}_${today}.csv`;
    downloadCSV(filename, headers, rows);
  }, [evaluations, finalRanks, evalPeriodName]);

  return (
    <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ページヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
              キャリブレーション
            </h1>
            <p className="text-sm text-[#737373] mt-1">
              事業部間ランク分布調整・評価バイアス是正
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 border border-[#333333] text-xs text-[#a3a3a3]">
              {evalPeriodName}
            </span>
            <button
              type="button"
              onClick={handleCsvExport}
              className="px-4 py-2 border border-[#333333] text-xs text-[#a3a3a3] font-bold hover:text-[#e5e5e5] hover:border-[#555555] transition-colors"
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="square" strokeLinejoin="miter" d="M12 5v14m0 0l-6-6m6 6l6-6M5 19h14" />
                </svg>
                CSV出力
              </span>
            </button>
            <LoadingButton
              loading={isSubmitting}
              disabled={!allRanksAssigned || submitSuccess}
              label={submitSuccess ? '確定済み' : '確定'}
              loadingLabel="処理中..."
              variant="primary"
              onClick={handleCalibrateClick}
            />
          </div>
        </div>

        {/* エラー・成功メッセージ */}
        {submitError && (
          <StatusMessage
            message={submitError}
            type="error"
            autoDismissMs={0}
            onDismiss={() => setSubmitError(null)}
          />
        )}
        {submitSuccess && (
          <StatusMessage
            message="キャリブレーションが確定されました。"
            type="success"
            autoDismissMs={0}
            onDismiss={() => setSubmitSuccess(false)}
          />
        )}

        {/* 進捗バー */}
        {progress.total > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-[#a3a3a3]">
              <span>処理中...</span>
              <span>{progress.current} / {progress.total}</span>
            </div>
            <div className="h-1 bg-[#1a1a1a]">
              <div
                className="h-full bg-[#3b82f6] transition-all"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* ランク分布 vs 目標 */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
          <div className="text-xs text-[#737373] uppercase tracking-wider mb-3">
            ランク分布 (現在 / 目標)
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
            {RANKS.map((rank) => {
              const count = distribution[rank];
              const pct = totalMembers > 0 ? ((count / totalMembers) * 100).toFixed(0) : '0';
              return (
                <div key={rank} className="text-center">
                  <EvalRankBadge rank={rank} size="lg" />
                  <div className="text-sm text-[#e5e5e5] font-bold mt-2">{count}名 ({pct}%)</div>
                  <div className="text-[10px] text-[#404040] mt-0.5">
                    目標: {TARGET_DISTRIBUTION[rank]}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 進捗 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-1">対象者数</div>
            <div className="text-2xl font-bold text-[#e5e5e5]">{totalMembers}</div>
          </div>
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-1">調整済み</div>
            <div className="text-2xl font-bold text-[#3b82f6]">{adjustedCount} / {totalMembers}</div>
          </div>
        </div>

        {/* キャリブレーションテーブル */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="border-b border-[#1a1a1a] px-4 py-3">
            <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
              評価一覧
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a1a1a] text-[#737373]">
                  <th className="px-4 py-2 text-left font-medium">名前</th>
                  <th className="px-4 py-2 text-center font-medium">等級</th>
                  <th className="px-4 py-2 text-left font-medium">事業部</th>
                  <th className="px-4 py-2 text-left font-medium">評価者</th>
                  <th className="px-4 py-2 text-right font-medium">定量</th>
                  <th className="px-4 py-2 text-right font-medium">定性</th>
                  <th className="px-4 py-2 text-right font-medium">バリュー</th>
                  <th className="px-4 py-2 text-right font-medium">総合</th>
                  <th className="px-4 py-2 text-center font-medium">提案ランク</th>
                  <th className="px-4 py-2 text-center font-medium">最終ランク</th>
                </tr>
              </thead>
              <tbody>
                {evaluations.map((member) => {
                  const selectedRank = finalRanks[member.id];
                  const isAdjusted = selectedRank !== undefined && selectedRank !== member.proposedRank;
                  return (
                    <tr
                      key={member.id}
                      className={`border-b border-[#111111] hover:bg-[#111111] transition-colors ${isAdjusted ? 'bg-[#3b82f6]/5' : ''}`}
                    >
                      <td className="px-4 py-3 text-[#e5e5e5] font-medium">{member.memberName}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 border border-[#333333] text-xs text-[#a3a3a3]">
                          {member.grade}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#737373]">{member.divisionName}</td>
                      <td className="px-4 py-3 text-[#737373]">{member.evaluatorName}</td>
                      <td className="px-4 py-3 text-right text-[#a3a3a3]">{member.quantitativeScore}</td>
                      <td className="px-4 py-3 text-right text-[#a3a3a3]">{member.qualitativeScore}</td>
                      <td className="px-4 py-3 text-right text-[#a3a3a3]">{member.valueScore}</td>
                      <td className="px-4 py-3 text-right text-[#e5e5e5] font-bold">{member.totalScore.toFixed(1)}</td>
                      <td className="px-4 py-3 text-center">
                        {isValidRank(member.proposedRank) ? (
                          <EvalRankBadge rank={member.proposedRank} size="md" />
                        ) : (
                          <span className="text-[#737373]">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <select
                          value={selectedRank ?? ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (isValidRank(value)) {
                              handleRankChange(member.id, value);
                            }
                          }}
                          disabled={submitSuccess}
                          className="bg-[#0a0a0a] border border-[#333333] text-[#e5e5e5] text-xs px-2 py-1 focus:border-[#3b82f6] focus:outline-none appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="" disabled>選択</option>
                          {RANKS.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        {/* 確定確認モーダル */}
        <ConfirmModal
          open={confirmOpen}
          title="キャリブレーション確定"
          description="全員のランクを確定します。確定後はランクの変更ができなくなります。よろしいですか？"
          confirmLabel="確定する"
          cancelLabel="キャンセル"
          variant="danger"
          loading={isSubmitting}
          onConfirm={handleConfirmCalibrate}
          onCancel={() => setConfirmOpen(false)}
        />
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// ユーティリティ
// -----------------------------------------------------------------------------

function isValidRank(value: string): value is Rank {
  return ['S', 'A', 'B', 'C', 'D'].includes(value);
}
