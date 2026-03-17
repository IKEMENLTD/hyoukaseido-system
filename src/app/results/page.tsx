// =============================================================================
// 評価結果確認ページ (E-05)
// 確定後の評価結果を被評価者が閲覧するページ
// Supabase統合: リアルデータ取得
// =============================================================================

import type { Rank, Grade, Half } from '@/types/evaluation';
import { SALARY_CHANGE } from '@/types/evaluation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMember } from '@/lib/auth/get-member';
import EvalRankBadge from '@/components/shared/EvalRankBadge';
import PrintButton from './PrintButton';

// -----------------------------------------------------------------------------
// Supabase行データの型定義（generated typesがないためローカル定義）
// -----------------------------------------------------------------------------

interface EvalPeriodJoin {
  name: string;
  half: Half | null;
  fiscal_year: number | null;
}

interface DivisionJoin {
  name: string;
}

interface EvaluationRow {
  id: string;
  quantitative_score: number | null;
  qualitative_score: number | null;
  value_score: number | null;
  total_score: number | null;
  rank: Rank | null;
  salary_change_recommended: number | null;
  promotion_eligibility: string | null;
  evaluator_comment: string | null;
  next_actions: string | null;
  grade_at_eval: Grade | null;
  status: string;
  updated_at: string | null;
  eval_periods: EvalPeriodJoin[];
  divisions: DivisionJoin[];
}

interface KpiItemJoin {
  name: string;
  measurement_unit: string | null;
}

interface KpiScoreRow {
  target_value: number | null;
  actual_value: number | null;
  achievement_rate: number | null;
  rank: string | null;
  note: string | null;
  kpi_items: KpiItemJoin[];
}

interface BehaviorItemJoin {
  name: string;
}

interface BehaviorScoreRow {
  self_score: number | null;
  manager_score: number | null;
  final_score: number | null;
  behavior_items: BehaviorItemJoin[];
}

interface ValueItemJoin {
  name: string;
}

interface ValueScoreRow {
  self_score: number | null;
  manager_score: number | null;
  final_score: number | null;
  evidence: string | null;
  value_items: ValueItemJoin[];
}

// -----------------------------------------------------------------------------
// 定数
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// ページコンポーネント
// -----------------------------------------------------------------------------

export default async function ResultsPage() {
  const member = await getCurrentMember();
  if (!member) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 sm:p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">ログインが必要です</h2>
          <p className="text-sm text-[#737373] mb-4">この機能を利用するにはログインしてください。</p>
          <a
            href="/login"
            className="inline-block px-6 py-2 text-sm font-bold text-[#050505] bg-[#3b82f6] hover:bg-[#2563eb] transition-colors"
          >
            ログインページへ
          </a>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  // -- 最新の確定済み評価を取得 --
  const { data: evaluationData } = await supabase
    .from('evaluations')
    .select(`
      id, quantitative_score, qualitative_score, value_score, total_score,
      rank, salary_change_recommended, promotion_eligibility, evaluator_comment, next_actions,
      grade_at_eval, status, updated_at,
      eval_periods (name, half, fiscal_year),
      divisions (name)
    `)
    .eq('member_id', member.id)
    .in('status', ['feedback_done', 'finalized'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const evaluation = evaluationData as EvaluationRow | null;

  if (!evaluation) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 sm:p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">確定済みの評価結果がありません</h2>
          <p className="text-sm text-[#737373]">
            評価が確定されると、こちらに結果が表示されます。
          </p>
        </div>
      </div>
    );
  }

  // -- KPI・行動・バリュー評価の詳細を並列取得 --
  const [kpiResult, behaviorResult, valueResult] = await Promise.all([
    supabase
      .from('eval_kpi_scores')
      .select(`
        target_value, actual_value, achievement_rate, rank, note,
        kpi_items (name, measurement_unit)
      `)
      .eq('evaluation_id', evaluation.id),
    supabase
      .from('eval_behavior_scores')
      .select(`
        self_score, manager_score, final_score,
        behavior_items (name)
      `)
      .eq('evaluation_id', evaluation.id),
    supabase
      .from('eval_value_scores')
      .select(`
        self_score, manager_score, final_score, evidence,
        value_items (name)
      `)
      .eq('evaluation_id', evaluation.id),
  ]);

  const kpiScores = (kpiResult.data ?? []) as KpiScoreRow[];
  const behaviorScores = (behaviorResult.data ?? []) as BehaviorScoreRow[];
  const valueScores = (valueResult.data ?? []) as ValueScoreRow[];

  // -- 表示用データの整形 --
  const evalPeriod = evaluation.eval_periods[0] ?? null;
  const division = evaluation.divisions[0] ?? null;
  const periodName = evalPeriod?.name ?? '評価期間不明';
  const fiscalYear = evalPeriod?.fiscal_year;
  const half = evalPeriod?.half;
  const divisionName = division?.name ?? '事業部不明';
  const grade = evaluation.grade_at_eval ?? 'G1';
  const totalScore = evaluation.total_score ?? 0;
  const quantitativeScore = evaluation.quantitative_score ?? 0;
  const qualitativeScore = evaluation.qualitative_score ?? 0;
  const valueScore = evaluation.value_score ?? 0;
  const rank = evaluation.rank ?? 'B';
  const salaryChange = evaluation.salary_change_recommended ?? SALARY_CHANGE[rank];
  const promotionEligibility = evaluation.promotion_eligibility;
  const evaluatorComment = evaluation.evaluator_comment ?? '';
  const nextActions = evaluation.next_actions ?? '';
  const feedbackDate = evaluation.updated_at
    ? new Date(evaluation.updated_at).toLocaleDateString('ja-JP')
    : '---';

  return (
    <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* ページヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
              評価結果
            </h1>
            <p className="text-sm text-[#737373] mt-1">
              {periodName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 border border-[#333333] text-xs text-[#a3a3a3]">
              {fiscalYear ? `${fiscalYear}年度` : 'データなし'}
            </span>
            {half && (
              <span className="px-3 py-1 border border-[#3b82f6] text-xs text-[#3b82f6] font-bold">
                {half}
              </span>
            )}
            <PrintButton />
          </div>
        </div>

        {/* 総合結果カード */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-3 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="text-xs text-[#737373] uppercase tracking-wider">総合スコア</div>
              <div className="text-4xl font-bold text-[#e5e5e5]">{totalScore.toFixed(1)}</div>
              <div className="text-xs text-[#737373]">
                {divisionName} / {grade}
              </div>
            </div>
            <div className="text-center">
              <EvalRankBadge rank={rank} size="xl" />
              <div className={`text-sm font-bold mt-2 ${salaryChange >= 0 ? 'text-[#22d3ee]' : 'text-[#ef4444]'}`}>
                {salaryChange >= 0 ? '+' : ''}{salaryChange.toLocaleString()}円
              </div>
              {promotionEligibility && promotionEligibility !== 'none' && (
                <div className={`mt-2 px-2 py-0.5 border text-[10px] font-bold ${
                  promotionEligibility === 'immediate'
                    ? 'border-[#ccff00] text-[#ccff00]'
                    : 'border-[#3b82f6] text-[#3b82f6]'
                }`}>
                  {promotionEligibility === 'immediate' ? '昇格検討対象' : '昇格候補'}
                </div>
              )}
            </div>
          </div>

          {/* スコア内訳バー */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <div>
              <div className="text-[10px] text-[#737373] uppercase tracking-wider mb-1">定量評価</div>
              <div className="text-lg font-bold text-[#e5e5e5]">{quantitativeScore}</div>
            </div>
            <div>
              <div className="text-[10px] text-[#737373] uppercase tracking-wider mb-1">定性評価</div>
              <div className="text-lg font-bold text-[#e5e5e5]">{qualitativeScore}</div>
            </div>
            <div>
              <div className="text-[10px] text-[#737373] uppercase tracking-wider mb-1">バリュー評価</div>
              <div className="text-lg font-bold text-[#e5e5e5]">{valueScore}</div>
            </div>
          </div>
        </div>

        {/* 定量評価詳細 */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="border-b border-[#1a1a1a] px-4 py-3">
            <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
              定量評価 詳細
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a1a1a] text-[#737373]">
                  <th className="px-4 py-2 text-left font-medium">KPI項目</th>
                  <th className="px-4 py-2 text-right font-medium">目標</th>
                  <th className="px-4 py-2 text-right font-medium">実績</th>
                  <th className="px-4 py-2 text-right font-medium">達成率</th>
                </tr>
              </thead>
              <tbody>
                {kpiScores.map((item) => {
                  const kpiItem = item.kpi_items[0] ?? null;
                  const name = kpiItem?.name ?? '---';
                  const unit = kpiItem?.measurement_unit ?? '';
                  const target = item.target_value ?? 0;
                  const actual = item.actual_value ?? 0;
                  const achievementRate = item.achievement_rate ?? 0;
                  return (
                    <tr key={name} className="border-b border-[#111111]">
                      <td className="px-4 py-3 text-[#e5e5e5]">{name}</td>
                      <td className="px-4 py-3 text-right text-[#737373]">
                        {target}{unit}
                      </td>
                      <td className="px-4 py-3 text-right text-[#e5e5e5] font-bold">
                        {actual}{unit}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold ${
                          achievementRate >= 100 ? 'text-[#22d3ee]' : 'text-[#f59e0b]'
                        }`}>
                          {achievementRate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 定性・バリュー評価詳細 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 定性 */}
          <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
            <div className="border-b border-[#1a1a1a] px-4 py-3">
              <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
                定性評価
              </h3>
            </div>
            <div className="divide-y divide-[#111111]">
              {behaviorScores.map((item) => {
                const name = item.behavior_items[0]?.name ?? '---';
                return (
                  <div key={name} className="px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-[#e5e5e5]">{name}</span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-[#737373]">自己: {item.self_score ?? '---'}</span>
                      <span className="text-[#737373]">上長: {item.manager_score ?? '---'}</span>
                      <span className="text-[#3b82f6] font-bold">確定: {item.final_score ?? '---'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* バリュー */}
          <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
            <div className="border-b border-[#1a1a1a] px-4 py-3">
              <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
                バリュー評価
              </h3>
            </div>
            <div className="divide-y divide-[#111111]">
              {valueScores.map((item) => {
                const name = item.value_items[0]?.name ?? '---';
                return (
                  <div key={name} className="px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-[#e5e5e5]">{name}</span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-[#737373]">自己: {item.self_score ?? '---'}</span>
                      <span className="text-[#737373]">上長: {item.manager_score ?? '---'}</span>
                      <span className="text-[#3b82f6] font-bold">確定: {item.final_score ?? '---'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 評価者コメント */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="border-b border-[#1a1a1a] px-4 py-3">
            <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
              評価者コメント
            </h3>
          </div>
          <div className="p-4">
            <p className="text-sm text-[#a3a3a3] leading-relaxed">
              {evaluatorComment}
            </p>
          </div>
        </div>

        {/* 次期アクション */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="border-b border-[#1a1a1a] px-4 py-3">
            <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
              次期アクション
            </h3>
          </div>
          <div className="p-4">
            <pre className="text-sm text-[#22d3ee] leading-relaxed whitespace-pre-wrap font-sans">
              {nextActions}
            </pre>
          </div>
        </div>

        {/* フィードバック日 */}
        <div className="text-center text-xs text-[#404040]">
          フィードバック実施日: {feedbackDate}
        </div>
      </div>
    </div>
  );
}
