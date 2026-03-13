// =============================================================================
// メインダッシュボード
// 全社サマリー / 事業部比較 / クロスセル / ROI を一覧表示
// Supabase統合: リアルデータ取得
// =============================================================================

import type { Rank, Phase, EvalPeriodStatus } from '@/types/evaluation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMember } from '@/lib/auth/get-member';
import CompanyOverview from '@/components/dashboard/CompanyOverview';
import DivisionComparison from '@/components/dashboard/DivisionComparison';
import CrossSellMap from '@/components/dashboard/CrossSellMap';
import ROIChart from '@/components/dashboard/ROIChart';

// -----------------------------------------------------------------------------
// Supabase行データの型定義（generated typesがないためローカル定義）
// -----------------------------------------------------------------------------

interface DivisionRow {
  id: string;
  name: string;
  phase: Phase;
}

interface MemberRow {
  id: string;
  name: string;
  grade: string;
  monthly_salary: number;
}

interface DivisionMemberRow {
  division_id: string;
  member_id: string;
}

interface EvalPeriodRow {
  id: string;
  name: string;
  half: string | null;
  fiscal_year: number | null;
  status: EvalPeriodStatus;
}

interface EvaluationRow {
  id: string;
  eval_period_id: string;
  member_id: string;
  division_id: string;
  total_score: number | null;
  rank: Rank | null;
  promotion_eligibility: string | null;
}

interface CrossSellTossRow {
  id: string;
  route_id: string;
  status: string;
  gross_profit: number | null;
  toss_bonus: number | null;
  receive_bonus: number | null;
  crosssell_routes: {
    from_division_id: string;
    to_division_id: string;
  } | null;
}

// -----------------------------------------------------------------------------
// データ集計ヘルパー
// -----------------------------------------------------------------------------

function buildRankDistribution(evaluations: EvaluationRow[]): Record<Rank, number> {
  const distribution: Record<Rank, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  for (const evaluation of evaluations) {
    if (evaluation.rank && evaluation.rank in distribution) {
      distribution[evaluation.rank] += 1;
    }
  }
  return distribution;
}

function computeAverageScore(evaluations: EvaluationRow[]): number {
  const scored = evaluations.filter(
    (e): e is EvaluationRow & { total_score: number } => e.total_score !== null
  );
  if (scored.length === 0) return 0;
  const sum = scored.reduce((acc, e) => acc + e.total_score, 0);
  return sum / scored.length;
}

function countByDivision(divisionMembers: DivisionMemberRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const dm of divisionMembers) {
    counts.set(dm.division_id, (counts.get(dm.division_id) ?? 0) + 1);
  }
  return counts;
}

function buildDivisionName(id: string, divisions: DivisionRow[]): string {
  return divisions.find((d) => d.id === id)?.name ?? 'Unknown';
}

// -----------------------------------------------------------------------------
// ページコンポーネント
// -----------------------------------------------------------------------------

export default async function DashboardPage() {
  // -- 認証・認可チェック: G4/G5のみアクセス可 --
  const currentMember = await getCurrentMember();
  if (!currentMember) {
    return (
      <div className="min-h-screen bg-[#050505] p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">アクセス権限がありません</h2>
          <p className="text-sm text-[#737373]">
            ログインが必要です。
          </p>
        </div>
      </div>
    );
  }

  const allowedGrades: ReadonlyArray<string> = ['G4', 'G5'];
  if (!allowedGrades.includes(currentMember.grade)) {
    return (
      <div className="min-h-screen bg-[#050505] p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">アクセス権限がありません</h2>
          <p className="text-sm text-[#737373]">
            適切な権限がありません。
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  // -- 並列データ取得 --
  const [
    divisionsResult,
    divisionMembersResult,
    membersResult,
    evalPeriodsResult,
    evaluationsResult,
    tossesResult,
  ] = await Promise.all([
    supabase
      .from('divisions')
      .select('id, name, phase')
      .order('name'),
    supabase
      .from('division_members')
      .select('division_id, member_id'),
    supabase
      .from('members')
      .select('id, name, grade, monthly_salary')
      .eq('status', 'active'),
    supabase
      .from('eval_periods')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('evaluations')
      .select('id, eval_period_id, member_id, division_id, total_score, rank, promotion_eligibility'),
    supabase
      .from('crosssell_tosses')
      .select('id, route_id, status, gross_profit, toss_bonus, receive_bonus, crosssell_routes(from_division_id, to_division_id)'),
  ]);

  // -- null安全: エラー時は空配列にフォールバック --
  const divisions = (divisionsResult.data ?? []) as DivisionRow[];
  const divisionMembers = (divisionMembersResult.data ?? []) as DivisionMemberRow[];
  const members = (membersResult.data ?? []) as MemberRow[];
  const evalPeriods = (evalPeriodsResult.data ?? []) as EvalPeriodRow[];
  const evaluations = (evaluationsResult.data ?? []) as EvaluationRow[];
  const tosses = (tossesResult.data ?? []) as unknown as CrossSellTossRow[];

  // -- 現在の評価期間 --
  const currentPeriod = evalPeriods[0] ?? null;
  const currentPeriodId = currentPeriod?.id ?? null;

  // -- 当期の評価のみフィルタリング --
  const currentEvaluations = currentPeriodId
    ? evaluations.filter((e) => e.eval_period_id === currentPeriodId)
    : [];

  // -- 全社サマリー --
  const rankDistribution = buildRankDistribution(currentEvaluations);
  const averageScore = computeAverageScore(currentEvaluations);
  const promotionCandidates = currentEvaluations.filter(
    (e) => e.promotion_eligibility === 'immediate' || e.promotion_eligibility === 'candidate'
  ).length;
  const improvementNeeded = currentEvaluations.filter(
    (e) => e.rank === 'C' || e.rank === 'D'
  ).length;

  const overviewData = {
    totalMembers: members.length,
    averageScore,
    rankDistribution,
    promotionCandidates,
    improvementNeeded,
    evalPeriodName: currentPeriod?.name ?? 'データなし',
    evalPeriodStatus: currentPeriod?.status ?? 'planning',
  };

  // -- 事業部比較 --
  const memberCountByDivision = countByDivision(divisionMembers);

  const divisionComparisonData = divisions.map((div) => {
    const divEvals = currentEvaluations.filter((e) => e.division_id === div.id);
    const divAvg = computeAverageScore(divEvals);

    // KPI達成率: 評価がない場合は '---'
    const scoredEvals = divEvals.filter(
      (e): e is EvaluationRow & { total_score: number } => e.total_score !== null
    );
    let kpiAchievement = '---';
    if (scoredEvals.length > 0) {
      // total_scoreの平均を達成率として表示（100点満点ベース）
      const avgPercent = Math.round(divAvg);
      kpiAchievement = `${avgPercent}%`;
    }

    return {
      name: div.name,
      memberCount: memberCountByDivision.get(div.id) ?? 0,
      averageScore: divAvg,
      phase: div.phase,
      kpiAchievement,
    };
  });

  // -- クロスセル実績 --
  // ルートごとに集計（from_division_id + to_division_id でグルーピング）
  const routeAggregation = new Map<
    string,
    { fromId: string; toId: string; tossCount: number; contractedCount: number; totalBonus: number }
  >();

  for (const toss of tosses) {
    const route = toss.crosssell_routes;
    if (!route) continue;

    const key = `${route.from_division_id}_${route.to_division_id}`;
    const existing = routeAggregation.get(key);

    if (existing) {
      existing.tossCount += 1;
      if (toss.status === 'contracted') {
        existing.contractedCount += 1;
        existing.totalBonus += (toss.toss_bonus ?? 0) + (toss.receive_bonus ?? 0);
      }
    } else {
      routeAggregation.set(key, {
        fromId: route.from_division_id,
        toId: route.to_division_id,
        tossCount: 1,
        contractedCount: toss.status === 'contracted' ? 1 : 0,
        totalBonus:
          toss.status === 'contracted'
            ? (toss.toss_bonus ?? 0) + (toss.receive_bonus ?? 0)
            : 0,
      });
    }
  }

  const crossSellRoutes = Array.from(routeAggregation.values()).map((r) => ({
    fromDivision: buildDivisionName(r.fromId, divisions),
    toDivision: buildDivisionName(r.toId, divisions),
    tossCount: r.tossCount,
    contractedCount: r.contractedCount,
    totalBonus: Math.round(r.totalBonus),
  }));

  // -- ROI --
  const monthlySalaryCost = members.reduce((sum, m) => sum + m.monthly_salary, 0);
  const memberCount = members.length;
  const perPersonCost = memberCount > 0 ? Math.round(monthlySalaryCost / memberCount) : 0;

  // monthlyRevenue: 評価制度単体では売上データを持たないため、
  // 給与コストの4倍を暫定表示（実運用ではrevenueテーブル等から取得すべき）
  const monthlyRevenue = monthlySalaryCost * 4;
  const costRatio = monthlyRevenue > 0 ? (monthlySalaryCost / monthlyRevenue) * 100 : 0;

  const roiData = {
    monthlySalaryCost,
    monthlyRevenue,
    costRatio,
    perPersonCost,
  };

  // -- 評価期間表示用 --
  const fiscalYear = currentPeriod?.fiscal_year;
  const half = currentPeriod?.half;

  return (
    <div className="min-h-screen bg-[#050505] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ページヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
              ダッシュボード
            </h1>
            <p className="text-sm text-[#737373] mt-1">
              全社パフォーマンス概況
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
          </div>
        </div>

        {/* 全社サマリー */}
        <CompanyOverview data={overviewData} />

        {/* 2カラムレイアウト: 事業部比較 + ROI */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <DivisionComparison divisions={divisionComparisonData} />
          </div>
          <div>
            <ROIChart data={roiData} />
          </div>
        </div>

        {/* クロスセル実績 */}
        <CrossSellMap routes={crossSellRoutes} />
      </div>
    </div>
  );
}
