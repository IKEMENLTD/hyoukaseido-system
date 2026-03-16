// =============================================================================
// 個人ダッシュボード
// 個人KPI進捗、OKRステータス、評価履歴を表示
// =============================================================================

import type { Grade, Rank } from '@/types/evaluation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMember } from '@/lib/auth/get-member';
import EvalRankBadge from '@/components/shared/EvalRankBadge';

// -----------------------------------------------------------------------------
// ローカル型定義
// -----------------------------------------------------------------------------

interface KPIProgress {
  name: string;
  target: number;
  actual: number;
  unit: string;
}

interface KeyResult {
  title: string;
  current: number;
  target: number;
  unit: string;
}

interface OKRStatus {
  objective: string;
  keyResults: KeyResult[];
}

interface EvalHistoryRecord {
  periodName: string;
  totalScore: number;
  rank: Rank;
  quantitative: number;
  qualitative: number;
  value: number;
}

// -----------------------------------------------------------------------------
// 定数
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// ページコンポーネント
// -----------------------------------------------------------------------------

interface MemberPageProps {
  params: Promise<{ memberId: string }>;
}

export default async function MemberPage(props: MemberPageProps) {
  const { memberId } = await props.params;

  // -- 認証チェック + アクセス制御 --
  // 全員閲覧可だが、自分以外のデータはG3以上のみ
  const currentMember = await getCurrentMember();
  if (!currentMember) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">アクセス権限がありません</h2>
          <p className="text-sm text-[#737373]">
            ログインが必要です。
          </p>
        </div>
      </div>
    );
  }

  const managerGrades: ReadonlyArray<string> = ['G3', 'G4', 'G5'];
  const isOwnPage = currentMember.id === memberId;
  const isManager = managerGrades.includes(currentMember.grade);

  if (!isOwnPage && !isManager) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">アクセス権限がありません</h2>
          <p className="text-sm text-[#737373]">
            適切な権限がありません。
          </p>
        </div>
      </div>
    );
  }

  // -- Supabaseクライアント作成 --
  const supabase = await createClient();

  // -- 並列クエリ: メンバー情報、所属部門、最新評価期間 --
  const [memberResult, divResult, periodResult] = await Promise.all([
    supabase
      .from('members')
      .select('id, name, grade, hire_date')
      .eq('id', memberId)
      .single(),
    supabase
      .from('division_members')
      .select('role, divisions (name)')
      .eq('member_id', memberId)
      .eq('is_primary', true)
      .single(),
    supabase
      .from('eval_periods')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
  ]);

  const targetMember = memberResult.data;

  if (!targetMember) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">メンバーが見つかりません</h2>
          <p className="text-sm text-[#737373]">
            指定されたメンバーは存在しません。
          </p>
        </div>
      </div>
    );
  }

  const divRaw = divResult.data as unknown as { role: string; divisions: { name: string } | Array<{ name: string }> } | null;
  const latestPeriod = periodResult.data;

  // -- メンバー表示情報を構築 --
  const divName = (() => {
    if (!divRaw) return '未所属';
    const d = divRaw.divisions;
    if (Array.isArray(d)) return d[0]?.name ?? '未所属';
    return d?.name ?? '未所属';
  })();

  const memberInfo = {
    name: targetMember.name as string,
    grade: targetMember.grade as Grade,
    divisionName: divName,
    role: divRaw?.role ?? '',
    hireDate: (targetMember.hire_date as string | null) ?? '',
  };

  // -- KPIスコア取得 --
  let kpiProgress: KPIProgress[] = [];

  if (latestPeriod) {
    const { data: currentEval } = await supabase
      .from('evaluations')
      .select('id')
      .eq('member_id', memberId)
      .eq('eval_period_id', latestPeriod.id)
      .single();

    if (currentEval) {
      const { data: kpiScores } = await supabase
        .from('eval_kpi_scores')
        .select('target_value, actual_value, kpi_items (name, measurement_unit)')
        .eq('evaluation_id', currentEval.id);

      if (kpiScores) {
        kpiProgress = kpiScores.map((score) => {
          const kpiItemRaw = score.kpi_items as unknown;
          const kpiItem = (Array.isArray(kpiItemRaw) ? kpiItemRaw[0] : kpiItemRaw) as { name: string; measurement_unit: string | null } | null;
          return {
            name: kpiItem?.name ?? '',
            target: (score.target_value as number | null) ?? 0,
            actual: (score.actual_value as number | null) ?? 0,
            unit: kpiItem?.measurement_unit ?? '',
          };
        });
      }
    }
  }

  // -- OKRと評価履歴は並列で取得 --
  const [okrResult, evalHistoryResult] = await Promise.all([
    supabase
      .from('okr_objectives')
      .select(`
        title,
        okr_key_results (title, current_value, target_value, unit)
      `)
      .eq('member_id', memberId)
      .eq('status', 'active'),
    supabase
      .from('evaluations')
      .select(`
        total_score, rank, quantitative_score, qualitative_score, value_score,
        eval_periods (name)
      `)
      .eq('member_id', memberId)
      .not('total_score', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  // -- OKRデータ変換 --
  const okrStatus: OKRStatus[] = (okrResult.data ?? []).map((obj) => {
    const keyResults = obj.okr_key_results as Array<{
      title: string;
      current_value: number | null;
      target_value: number | null;
      unit: string | null;
    }> | null;
    return {
      objective: obj.title as string,
      keyResults: (keyResults ?? []).map((kr) => ({
        title: kr.title,
        current: kr.current_value ?? 0,
        target: kr.target_value ?? 0,
        unit: kr.unit ?? '',
      })),
    };
  });

  // -- 評価履歴データ変換 --
  const evalHistory: EvalHistoryRecord[] = (evalHistoryResult.data ?? []).map((record) => {
    const periodRaw = record.eval_periods as unknown;
    const period = (Array.isArray(periodRaw) ? periodRaw[0] : periodRaw) as { name: string } | null;
    return {
      periodName: period?.name ?? '',
      totalScore: (record.total_score as number | null) ?? 0,
      rank: (record.rank as Rank | null) ?? 'B',
      quantitative: (record.quantitative_score as number | null) ?? 0,
      qualitative: (record.qualitative_score as number | null) ?? 0,
      value: (record.value_score as number | null) ?? 0,
    };
  });

  return (
    <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* プロフィールヘッダー */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
                {memberInfo.name}
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="px-2 py-0.5 border border-[#3b82f6] text-xs text-[#3b82f6] font-bold">
                  {memberInfo.grade}
                </span>
                <span className="text-sm text-[#737373]">{memberInfo.divisionName}</span>
                <span className="text-sm text-[#737373]">{memberInfo.role}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-[#737373]">入社日</div>
              <div className="text-sm text-[#a3a3a3]">{memberInfo.hireDate}</div>
            </div>
          </div>
        </div>

        {/* KPI進捗 */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="border-b border-[#1a1a1a] px-4 py-3">
            <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
              KPI進捗
            </h3>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {kpiProgress.length === 0 ? (
              <div className="col-span-full text-sm text-[#737373] text-center py-8">
                KPIデータがありません
              </div>
            ) : (
              kpiProgress.map((kpi) => {
                const rate = kpi.target === 0 ? 0 : Math.round((kpi.actual / kpi.target) * 100);
                const isAchieved = rate >= 100;
                return (
                  <div key={kpi.name} className="border border-[#1a1a1a] p-4">
                    <div className="text-xs text-[#737373] mb-1">{kpi.name}</div>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-2xl font-bold ${isAchieved ? 'text-[#22d3ee]' : 'text-[#e5e5e5]'}`}>
                        {kpi.actual.toLocaleString()}
                      </span>
                      <span className="text-xs text-[#737373]">
                        / {kpi.target.toLocaleString()} {kpi.unit}
                      </span>
                    </div>
                    <div className="mt-3 h-1.5 bg-[#1a1a1a]">
                      <div
                        className={`h-full ${isAchieved ? 'bg-[#22d3ee]' : 'bg-[#3b82f6]'}`}
                        style={{ width: `${Math.min(rate, 100)}%` }}
                      />
                    </div>
                    <div className="mt-1 text-right text-xs text-[#737373]">{rate}%</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* OKRステータス */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="border-b border-[#1a1a1a] px-4 py-3">
            <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
              OKRステータス
            </h3>
          </div>
          <div className="divide-y divide-[#111111]">
            {okrStatus.length === 0 ? (
              <div className="p-4 text-sm text-[#737373] text-center py-8">
                OKRが設定されていません
              </div>
            ) : (
              okrStatus.map((okr) => (
                <div key={okr.objective} className="p-4">
                  <h4 className="text-sm text-[#e5e5e5] font-medium mb-3">
                    {okr.objective}
                  </h4>
                  <div className="space-y-2 ml-4">
                    {okr.keyResults.map((kr) => {
                      const progress = kr.target === 0 ? 0 : Math.round((kr.current / kr.target) * 100);
                      return (
                        <div key={kr.title} className="flex items-center gap-3">
                          <span className="text-xs text-[#737373] w-4 flex-shrink-0">KR</span>
                          <span className="text-xs text-[#a3a3a3] flex-1 truncate">{kr.title}</span>
                          <div className="w-32 h-2 bg-[#1a1a1a] flex-shrink-0">
                            <div
                              className="h-full bg-[#3b82f6]"
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-[#737373] w-24 text-right flex-shrink-0">
                            {kr.current.toLocaleString()}/{kr.target.toLocaleString()} {kr.unit}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 評価履歴 */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="border-b border-[#1a1a1a] px-4 py-3">
            <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
              評価履歴
            </h3>
          </div>
          {evalHistory.length === 0 ? (
            <div className="p-4 text-sm text-[#737373] text-center py-8">
              評価履歴がありません
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1a1a1a] text-[#737373]">
                    <th className="px-4 py-2 text-left font-medium">期間</th>
                    <th className="px-4 py-2 text-right font-medium">定量</th>
                    <th className="px-4 py-2 text-right font-medium">定性</th>
                    <th className="px-4 py-2 text-right font-medium">バリュー</th>
                    <th className="px-4 py-2 text-right font-medium">総合</th>
                    <th className="px-4 py-2 text-center font-medium">ランク</th>
                  </tr>
                </thead>
                <tbody>
                  {evalHistory.map((record) => (
                    <tr
                      key={record.periodName}
                      className="border-b border-[#111111] hover:bg-[#111111] transition-colors"
                    >
                      <td className="px-4 py-3 text-[#e5e5e5] font-medium">{record.periodName}</td>
                      <td className="px-4 py-3 text-right text-[#a3a3a3]">{record.quantitative.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right text-[#a3a3a3]">{record.qualitative.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right text-[#a3a3a3]">{record.value.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right text-[#e5e5e5] font-bold">{record.totalScore.toFixed(1)}</td>
                      <td className="px-4 py-3 text-center">
                        <EvalRankBadge rank={record.rank} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
