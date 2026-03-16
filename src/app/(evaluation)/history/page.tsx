// =============================================================================
// 評価履歴ページ
// 過去の評価一覧とランクバッジを表示
// Supabase統合: evaluationsテーブルからログインユーザーの過去評価を取得
// =============================================================================

import type { Rank, Grade, Half, EvaluationStatus } from '@/types/evaluation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMember } from '@/lib/auth/get-member';
import EvalRankBadge from '@/components/shared/EvalRankBadge';

// -----------------------------------------------------------------------------
// Supabase行データの型定義
// -----------------------------------------------------------------------------

interface EvaluationHistoryRow {
  id: string;
  total_score: number | null;
  rank: string | null;
  status: string;
  salary_change_recommended: number | null;
  grade_at_eval: string | null;
  created_at: string;
  updated_at: string | null;
  eval_periods: {
    name: string;
    half: string;
    fiscal_year: number;
  } | null;
  divisions: {
    name: string;
  } | null;
}

// -----------------------------------------------------------------------------
// 定数
// -----------------------------------------------------------------------------

const VALID_RANKS: ReadonlySet<string> = new Set(['S', 'A', 'B', 'C', 'D']);

function isValidRank(value: string | null): value is Rank {
  return value !== null && VALID_RANKS.has(value);
}

function getFeedbackDate(evaluation: EvaluationHistoryRow): string {
  if (evaluation.status === 'feedback_done' || evaluation.status === 'finalized') {
    return evaluation.updated_at ?? '---';
  }
  return '---';
}

export default async function HistoryPage() {
  const member = await getCurrentMember();
  if (!member) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 sm:p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">ログインが必要です</h2>
          <p className="text-sm text-[#737373]">この機能を利用するにはログインしてください。</p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  const { data: rawEvaluations } = await supabase
    .from('evaluations')
    .select(`
      id,
      total_score,
      rank,
      status,
      salary_change_recommended,
      grade_at_eval,
      created_at,
      updated_at,
      eval_periods (
        name,
        half,
        fiscal_year
      ),
      divisions (
        name
      )
    `)
    .eq('member_id', member.id)
    .order('created_at', { ascending: false });

  const evaluations = (rawEvaluations ?? []) as unknown as EvaluationHistoryRow[];

  // サマリー計算
  const scoredEvaluations = evaluations.filter(
    (e): e is EvaluationHistoryRow & { total_score: number } => e.total_score !== null
  );
  const avgScore =
    scoredEvaluations.length > 0
      ? scoredEvaluations.reduce((sum, e) => sum + e.total_score, 0) / scoredEvaluations.length
      : 0;
  const totalSalaryChange = evaluations.reduce(
    (sum, e) => sum + (e.salary_change_recommended ?? 0),
    0
  );

  // ランク推移用（古い順）
  const rankedEvaluations = evaluations.filter(
    (e): e is EvaluationHistoryRow & { rank: Rank } => isValidRank(e.rank)
  );
  const rankTimeline = [...rankedEvaluations].reverse();

  return (
    <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* ページヘッダー */}
        <div>
          <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
            評価履歴
          </h1>
          <p className="text-sm text-[#737373] mt-1">
            過去の評価結果一覧
          </p>
        </div>

        {evaluations.length === 0 ? (
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 text-center">
            <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">評価履歴がありません</h2>
            <p className="text-sm text-[#737373]">
              評価が完了すると、ここに履歴が表示されます。
            </p>
          </div>
        ) : (
          <>
            {/* サマリーカード */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
                <div className="text-xs text-[#737373] uppercase tracking-wider mb-1">評価回数</div>
                <div className="text-2xl font-bold text-[#e5e5e5]">{evaluations.length}</div>
              </div>
              <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
                <div className="text-xs text-[#737373] uppercase tracking-wider mb-1">平均スコア</div>
                <div className="text-2xl font-bold text-[#3b82f6]">
                  {scoredEvaluations.length > 0 ? avgScore.toFixed(1) : '---'}
                </div>
              </div>
              <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
                <div className="text-xs text-[#737373] uppercase tracking-wider mb-1">累積昇給額</div>
                <div className={`text-2xl font-bold ${totalSalaryChange >= 0 ? 'text-[#22d3ee]' : 'text-[#ef4444]'}`}>
                  {totalSalaryChange >= 0 ? '+' : ''}{totalSalaryChange.toLocaleString()}円
                </div>
              </div>
            </div>

            {/* ランク推移 */}
            {rankTimeline.length > 0 && (
              <div className="border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4">
                <div className="text-xs text-[#737373] uppercase tracking-wider mb-3">
                  ランク推移
                </div>
                <div className="flex items-center gap-4">
                  {rankTimeline.map((evaluation, index, arr) => (
                    <div key={evaluation.id} className="flex items-center gap-4">
                      <div className="flex flex-col items-center">
                        <EvalRankBadge rank={evaluation.rank} size="lg" />
                        <div className="text-[10px] text-[#404040] mt-1">
                          {evaluation.eval_periods?.fiscal_year ?? '---'} {evaluation.eval_periods?.half ?? ''}
                        </div>
                      </div>
                      {index < arr.length - 1 && (
                        <div className="w-8 h-px bg-[#333333]" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 詳細テーブル */}
            <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
              <div className="border-b border-[#1a1a1a] px-4 py-3">
                <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
                  評価詳細
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1a1a1a] text-[#737373]">
                      <th className="px-4 py-2 text-left font-medium">期間</th>
                      <th className="px-4 py-2 text-center font-medium">等級</th>
                      <th className="px-4 py-2 text-center font-medium">ランク</th>
                      <th className="px-4 py-2 text-right font-medium">スコア</th>
                      <th className="px-4 py-2 text-right font-medium">昇給額</th>
                      <th className="px-4 py-2 text-left font-medium">FB日</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evaluations.map((evaluation) => (
                      <tr
                        key={evaluation.id}
                        className="border-b border-[#111111] hover:bg-[#111111] transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="text-[#e5e5e5] font-medium">
                            {evaluation.eval_periods?.name ?? '---'}
                          </div>
                          <div className="text-[10px] text-[#404040]">
                            {evaluation.divisions?.name ?? '---'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-0.5 border border-[#333333] text-xs text-[#a3a3a3]">
                            {evaluation.grade_at_eval ?? '---'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isValidRank(evaluation.rank) ? (
                            <EvalRankBadge rank={evaluation.rank} size="md" />
                          ) : (
                            <span className="text-[#737373]">---</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-[#e5e5e5] font-bold">
                          {evaluation.total_score !== null ? evaluation.total_score.toFixed(1) : '---'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {evaluation.salary_change_recommended !== null ? (
                            <span className={`font-bold ${evaluation.salary_change_recommended >= 0 ? 'text-[#22d3ee]' : 'text-[#ef4444]'}`}>
                              {evaluation.salary_change_recommended >= 0 ? '+' : ''}{evaluation.salary_change_recommended.toLocaleString()}円
                            </span>
                          ) : (
                            <span className="text-[#737373]">---</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[#737373] text-xs">
                          {getFeedbackDate(evaluation)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
