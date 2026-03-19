// =============================================================================
// メインダッシュボード
// 全社サマリー / 事業部比較 / クロスセル / ROI を一覧表示
// Supabase統合: リアルデータ取得
// =============================================================================

import type { Rank, Phase, EvalPeriodStatus, EvaluationStatus } from '@/types/evaluation';
import { createClient } from '@/lib/supabase/server';
import { getMemberResult } from '@/lib/auth/get-member';
import ActionItems from '@/components/dashboard/ActionItems';
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
  status?: EvaluationStatus;
}

/** アクションアイテム用: 部下評価の行データ */
interface SubordinateEvalRow {
  id: string;
  eval_period_id: string;
  member_id: string;
  status: EvaluationStatus;
  members: { name: string } | null;
}

/** アクションアイテム用: 1on1の最新日付 */
interface OneOnOneRow {
  member_id: string;
  meeting_date: string;
}

/** アクションアイテム用: チェックインの最新日付 */
interface CheckinRow {
  checkin_date: string;
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
  const result = await getMemberResult();

  if (result.status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 sm:p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">ログインが必要です</h2>
          <p className="text-sm text-[#737373] mb-4">
            Googleアカウントでログインしてください。
          </p>
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

  if (result.status === 'unlinked') {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 sm:p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">アカウントが未登録です</h2>
          <p className="text-sm text-[#737373] mb-2">
            ログイン中: <span className="text-[#a3a3a3]">{result.user.email}</span>
          </p>
          <p className="text-sm text-[#737373] mb-4">
            このメールアドレスがシステムに登録されていません。管理者にメールアドレスの登録を依頼するか、登録済みの別アカウントでログインしてください。
          </p>
          <a
            href="/login"
            className="inline-block px-6 py-2 text-sm font-bold text-[#050505] bg-[#3b82f6] hover:bg-[#2563eb] transition-colors"
          >
            別のアカウントでログイン
          </a>
        </div>
      </div>
    );
  }

  const currentMember = result.member;

  const allowedGrades: ReadonlyArray<string> = ['G4', 'G5'];
  if (!allowedGrades.includes(currentMember.grade)) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 sm:p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">アクセス権限がありません</h2>
          <p className="text-sm text-[#737373]">
            このページの閲覧にはG4以上の権限が必要です。
          </p>
          <a
            href="/dashboard"
            className="mt-4 inline-block px-4 py-2 border border-[#333333] text-xs text-[#a3a3a3] hover:border-[#e5e5e5] hover:text-[#e5e5e5]"
          >
            ダッシュボードへ戻る
          </a>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  // ROI用: 前月の財務データ取得に使う日付を事前計算
  const now = new Date();
  const roiYear = now.getFullYear();
  const roiMonth = now.getMonth() + 1;

  // -- 並列データ取得（financialクエリも統合） --
  const [
    divisionsResult,
    divisionMembersResult,
    membersResult,
    evalPeriodsResult,
    evaluationsResult,
    tossesResult,
    activePeriodsResult,
    myEvalsResult,
    latestCheckinResult,
    financialResult,
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
      .select('id, name, half, fiscal_year, status')
      .order('created_at', { ascending: false })
      .limit(1),
    // NOTE: eval_period_idでフィルタしたいが、最新periodIdはevalPeriodsの結果に依存するため
    // ここではフィルタできない。取得後にJSでフィルタする。
    supabase
      .from('evaluations')
      .select('id, eval_period_id, member_id, division_id, total_score, rank, promotion_eligibility, status'),
    supabase
      .from('crosssell_tosses')
      .select('id, route_id, status, gross_profit, toss_bonus, receive_bonus, crosssell_routes(from_division_id, to_division_id)'),
    // アクションアイテム用: アクティブな評価期間
    supabase
      .from('eval_periods')
      .select('id, name, status')
      .in('status', ['target_setting', 'self_eval', 'manager_eval', 'calibration', 'feedback'])
      .eq('org_id', currentMember.org_id),
    // アクションアイテム用: 自分の評価レコード
    supabase
      .from('evaluations')
      .select('id, eval_period_id, status')
      .eq('member_id', currentMember.id),
    // アクションアイテム用: 自分の最新OKRチェックイン
    supabase
      .from('okr_checkins')
      .select('checkin_date')
      .eq('member_id', currentMember.id)
      .order('checkin_date', { ascending: false })
      .limit(1),
    // ROI用: 前月の財務データ
    supabase
      .from('division_financials')
      .select('revenue')
      .eq('fiscal_year', roiYear)
      .eq('month', roiMonth > 1 ? roiMonth - 1 : 12),
  ]);

  if (divisionsResult.error) console.error('[DB] divisions 取得エラー:', divisionsResult.error);
  if (divisionMembersResult.error) console.error('[DB] division_members 取得エラー:', divisionMembersResult.error);
  if (membersResult.error) console.error('[DB] members 取得エラー:', membersResult.error);
  if (evalPeriodsResult.error) console.error('[DB] eval_periods 取得エラー:', evalPeriodsResult.error);
  if (evaluationsResult.error) console.error('[DB] evaluations 取得エラー:', evaluationsResult.error);
  if (tossesResult.error) console.error('[DB] crosssell_tosses 取得エラー:', tossesResult.error);
  if (activePeriodsResult.error) console.error('[DB] active eval_periods 取得エラー:', activePeriodsResult.error);
  if (myEvalsResult.error) console.error('[DB] my evaluations 取得エラー:', myEvalsResult.error);
  if (latestCheckinResult.error) console.error('[DB] okr_checkins 取得エラー:', latestCheckinResult.error);
  if (financialResult.error) console.error('[DB] division_financials 取得エラー:', financialResult.error);

  // -- null安全: エラー時は空配列にフォールバック --
  const divisions = (divisionsResult.data ?? []) as DivisionRow[];
  const divisionMembers = (divisionMembersResult.data ?? []) as DivisionMemberRow[];
  const members = (membersResult.data ?? []) as MemberRow[];
  const evalPeriods = (evalPeriodsResult.data ?? []) as EvalPeriodRow[];
  const evaluations = (evaluationsResult.data ?? []) as EvaluationRow[];
  const tosses = (tossesResult.data ?? []) as unknown as CrossSellTossRow[];

  // -- アクションアイテム用データ --
  const activePeriods = (activePeriodsResult.data ?? []) as Array<{
    id: string;
    name: string;
    status: EvalPeriodStatus;
  }>;
  const myEvaluations = (myEvalsResult.data ?? []) as Array<{
    id: string;
    eval_period_id: string;
    status: EvaluationStatus;
  }>;
  const latestCheckins = (latestCheckinResult.data ?? []) as CheckinRow[];
  const latestCheckinDate = latestCheckins.length > 0
    ? latestCheckins[0].checkin_date
    : null;

  // 部下の評価データ・1on1データ取得（マネージャー/管理者のみ）
  // 自分の事業部に所属するメンバーの評価を取得
  let subordinateEvaluations: Array<{
    id: string;
    eval_period_id: string;
    member_id: string;
    member_name: string;
    status: EvaluationStatus;
  }> = [];
  let subordinateLastOneOnOne: Array<{
    member_id: string;
    member_name: string;
    last_meeting_date: string | null;
  }> = [];

  if (currentMember.division_ids.length > 0) {
    const [subEvalsResult, oneOnOneResult] = await Promise.all([
      supabase
        .from('evaluations')
        .select('id, eval_period_id, member_id, status, members(name)')
        .in('division_id', currentMember.division_ids)
        .neq('member_id', currentMember.id),
      supabase
        .from('one_on_ones')
        .select('member_id, meeting_date')
        .eq('manager_id', currentMember.id)
        .order('meeting_date', { ascending: false }),
    ]);
    if (subEvalsResult.error) console.error('[DB] subordinate evaluations 取得エラー:', subEvalsResult.error);
    if (oneOnOneResult.error) console.error('[DB] one_on_ones 取得エラー:', oneOnOneResult.error);

    const subEvalsRaw = (subEvalsResult.data ?? []) as unknown as SubordinateEvalRow[];
    subordinateEvaluations = subEvalsRaw.map((e) => ({
      id: e.id,
      eval_period_id: e.eval_period_id,
      member_id: e.member_id,
      member_name: e.members?.name ?? '不明',
      status: e.status,
    }));

    // 部下ごとの最新1on1日付を算出
    const oneOnOneRows = (oneOnOneResult.data ?? []) as OneOnOneRow[];
    const latestOneOnOneMap = new Map<string, string>();
    for (const row of oneOnOneRows) {
      if (!latestOneOnOneMap.has(row.member_id)) {
        latestOneOnOneMap.set(row.member_id, row.meeting_date);
      }
    }

    // 自分の事業部の部下メンバー一覧を取得
    const subordinateMemberIds = new Set<string>();
    for (const dm of (divisionMembersResult.data ?? []) as DivisionMemberRow[]) {
      if (
        currentMember.division_ids.includes(dm.division_id) &&
        dm.member_id !== currentMember.id
      ) {
        subordinateMemberIds.add(dm.member_id);
      }
    }

    const membersData = (membersResult.data ?? []) as MemberRow[];
    subordinateLastOneOnOne = Array.from(subordinateMemberIds).map((memberId) => {
      const memberData = membersData.find((m) => m.id === memberId);
      return {
        member_id: memberId,
        member_name: memberData?.name ?? '不明',
        last_meeting_date: latestOneOnOneMap.get(memberId) ?? null,
      };
    });
  }

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

  // -- ROI (実データベース) --
  const monthlySalaryCost = members.reduce((sum, m) => sum + m.monthly_salary, 0);
  const memberCount = members.length;
  const perPersonCost = memberCount > 0 ? Math.round(monthlySalaryCost / memberCount) : 0;

  // 直近月の財務データから全社売上を集計（Promise.allで取得済み）
  const financialRows = financialResult.data;
  const monthlyRevenue = financialRows && financialRows.length > 0
    ? (financialRows as Array<{ revenue: number }>).reduce((sum, r) => sum + r.revenue, 0)
    : monthlySalaryCost * 4; // データなしの場合はフォールバック
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
    <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
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

        {/* やるべきことリスト */}
        <ActionItems
          memberGrade={currentMember.grade}
          memberId={currentMember.id}
          divisionIds={currentMember.division_ids}
          orgId={currentMember.org_id}
          evalPeriods={activePeriods}
          myEvaluations={myEvaluations}
          subordinateEvaluations={subordinateEvaluations}
          latestCheckinDate={latestCheckinDate}
          subordinateLastOneOnOne={subordinateLastOneOnOne}
        />

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
