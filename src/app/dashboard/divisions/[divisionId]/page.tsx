// =============================================================================
// 事業部ダッシュボード
// 事業部の詳細情報、メンバー一覧、KPI達成状況、フェーズ表示
// =============================================================================

import type { Phase, Grade, Rank } from '@/types/evaluation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMember } from '@/lib/auth/get-member';
import PhaseIndicator from '@/components/evaluation/PhaseIndicator';
import EvalRankBadge from '@/components/shared/EvalRankBadge';

// -----------------------------------------------------------------------------
// ローカル型定義
// -----------------------------------------------------------------------------

interface DivisionRow {
  id: string;
  name: string;
  phase: Phase;
  mission: string | null;
}

interface DivisionMemberRow {
  role: string;
  is_head: boolean;
  members: {
    id: string;
    name: string;
    grade: Grade;
  };
}

interface EvaluationRow {
  id: string;
  member_id: string;
  total_score: number | null;
  rank: Rank | null;
}

interface KpiScoreRow {
  achievement_rate: number | null;
  kpi_items: {
    name: string;
  };
}

interface MemberDisplay {
  id: string;
  name: string;
  grade: Grade;
  role: string;
  isHead: boolean;
  latestScore: number | null;
  latestRank: Rank | null;
}

interface KPIAchievement {
  overall: number;
  items: Array<{ name: string; achievement: number }>;
}

// -----------------------------------------------------------------------------
// 定数
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// データ取得
// -----------------------------------------------------------------------------

async function fetchDivisionData(divisionId: string): Promise<{
  division: DivisionRow | null;
  members: MemberDisplay[];
  kpiAchievement: KPIAchievement;
}> {
  const supabase = await createClient();

  // 並列取得: 部門情報、メンバー一覧、最新評価期間
  const [divisionResult, divMembersResult, latestPeriodResult] = await Promise.all([
    supabase
      .from('divisions')
      .select('id, name, phase, mission')
      .eq('id', divisionId)
      .single<DivisionRow>(),
    supabase
      .from('division_members')
      .select(`
        role, is_head,
        members (id, name, grade)
      `)
      .eq('division_id', divisionId),
    supabase
      .from('eval_periods')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .single<{ id: string }>(),
  ]);

  const division = divisionResult.data;
  const divMembers = (divMembersResult.data ?? []) as unknown as DivisionMemberRow[];
  const latestPeriod = latestPeriodResult.data;

  // 最新期間の評価を取得
  let evaluations: EvaluationRow[] = [];
  if (latestPeriod) {
    const { data } = await supabase
      .from('evaluations')
      .select('id, member_id, total_score, rank')
      .eq('eval_period_id', latestPeriod.id)
      .eq('division_id', divisionId);
    evaluations = (data ?? []) as EvaluationRow[];
  }

  // KPIスコア取得
  const evaluationIds = evaluations.map((e) => e.id);
  let kpiScores: KpiScoreRow[] = [];
  if (evaluationIds.length > 0) {
    const { data } = await supabase
      .from('eval_kpi_scores')
      .select(`
        achievement_rate,
        kpi_items (name)
      `)
      .in('evaluation_id', evaluationIds);
    kpiScores = (data ?? []) as unknown as KpiScoreRow[];
  }

  // メンバー一覧の変換
  const evaluationMap = new Map(
    evaluations.map((e) => [e.member_id, { score: e.total_score, rank: e.rank }])
  );

  const members: MemberDisplay[] = divMembers.map((dm) => {
    const evalData = evaluationMap.get(dm.members.id);
    return {
      id: dm.members.id,
      name: dm.members.name,
      grade: dm.members.grade,
      role: dm.role,
      isHead: dm.is_head,
      latestScore: evalData?.score ?? null,
      latestRank: evalData?.rank ?? null,
    };
  });

  // KPI達成状況の集計: kpi_items.nameごとにachievement_rateを平均
  const kpiMap = new Map<string, number[]>();
  for (const score of kpiScores) {
    if (score.achievement_rate !== null && score.kpi_items?.name) {
      const existing = kpiMap.get(score.kpi_items.name) ?? [];
      existing.push(score.achievement_rate);
      kpiMap.set(score.kpi_items.name, existing);
    }
  }

  const kpiItems: Array<{ name: string; achievement: number }> = [];
  for (const [name, rates] of kpiMap) {
    const avg = Math.round(rates.reduce((sum, r) => sum + r, 0) / rates.length);
    kpiItems.push({ name, achievement: avg });
  }

  // 全KPIの平均
  const allRates = kpiScores
    .map((s) => s.achievement_rate)
    .filter((r): r is number => r !== null);
  const overall =
    allRates.length > 0
      ? Math.round(allRates.reduce((sum, r) => sum + r, 0) / allRates.length)
      : 0;

  return {
    division,
    members,
    kpiAchievement: { overall, items: kpiItems },
  };
}

// -----------------------------------------------------------------------------
// ページコンポーネント
// -----------------------------------------------------------------------------

interface DivisionPageProps {
  params: Promise<{ divisionId: string }>;
}

export default async function DivisionPage(props: DivisionPageProps) {
  const { divisionId } = await props.params;

  // -- 認証・認可チェック: G3以上のみアクセス可 --
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

  const allowedGrades: ReadonlyArray<string> = ['G3', 'G4', 'G5'];
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

  const { division, members, kpiAchievement } = await fetchDivisionData(divisionId);

  if (!division) {
    return (
      <div className="min-h-screen bg-[#050505] p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">事業部が見つかりません</h2>
          <p className="text-sm text-[#737373]">
            指定された事業部は存在しないか、削除されています。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ページヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
              {division.name}
            </h1>
            {division.mission && (
              <p className="text-sm text-[#737373] mt-1">
                {division.mission}
              </p>
            )}
          </div>
          <PhaseIndicator phase={division.phase} showWeights />
        </div>

        {/* KPI達成状況 */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
              KPI達成状況
            </h3>
            <span className="text-lg font-bold text-[#3b82f6]">
              {kpiAchievement.overall}%
            </span>
          </div>
          <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiAchievement.items.map((item) => {
              const isAbove = item.achievement >= 100;
              return (
                <div key={item.name} className="border border-[#1a1a1a] p-3">
                  <div className="text-xs text-[#737373] mb-2">{item.name}</div>
                  <div className={`text-xl font-bold ${isAbove ? 'text-[#22d3ee]' : 'text-[#f59e0b]'}`}>
                    {item.achievement}%
                  </div>
                  <div className="mt-2 h-1.5 bg-[#1a1a1a]">
                    <div
                      className={`h-full ${isAbove ? 'bg-[#22d3ee]' : 'bg-[#f59e0b]'}`}
                      style={{ width: `${Math.min(item.achievement, 150) / 1.5}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* メンバー一覧 */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="border-b border-[#1a1a1a] px-4 py-3">
            <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
              メンバー一覧 ({members.length}名)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a1a1a] text-[#737373]">
                  <th className="px-4 py-2 text-left font-medium">名前</th>
                  <th className="px-4 py-2 text-center font-medium">等級</th>
                  <th className="px-4 py-2 text-left font-medium">役割</th>
                  <th className="px-4 py-2 text-right font-medium">最新スコア</th>
                  <th className="px-4 py-2 text-center font-medium">ランク</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr
                    key={member.id}
                    className="border-b border-[#111111] hover:bg-[#111111] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[#e5e5e5] font-medium">{member.name}</span>
                        {member.isHead && (
                          <span className="px-1.5 py-0.5 border border-[#3b82f6] text-[10px] text-[#3b82f6] font-bold">
                            HEAD
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 border border-[#333333] text-xs text-[#a3a3a3]">
                        {member.grade}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#a3a3a3]">{member.role}</td>
                    <td className="px-4 py-3 text-right text-[#e5e5e5] font-medium">
                      {member.latestScore !== null ? member.latestScore.toFixed(1) : '---'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {member.latestRank !== null ? (
                        <EvalRankBadge rank={member.latestRank} size="sm" />
                      ) : (
                        <span className="text-[#404040]">---</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
