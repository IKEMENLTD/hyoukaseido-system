// =============================================================================
// 改善計画管理ページ (IP-01)
// C/Dランクメンバーの改善計画の作成と進捗管理
// =============================================================================

import type { ImprovementPlanStatus, ReviewFrequency, Rank, Grade, ImprovementMilestone } from '@/types/evaluation';
import { getCurrentMember } from '@/lib/auth/get-member';
import { createClient } from '@/lib/supabase/server';
import EvalRankBadge from '@/components/shared/EvalRankBadge';
import ImprovementPlanFormClient from './ImprovementPlanFormClient';
import PlanActions from './PlanActions';

/** Supabaseクエリ結果の行型 */
interface ImprovementPlanRow {
  id: string;
  plan_description: string;
  milestones: unknown;
  review_frequency: ReviewFrequency;
  start_date: string;
  end_date: string | null;
  status: ImprovementPlanStatus;
  outcome: string | null;
  members: { name: string; grade: Grade } | null;
  manager: { name: string } | null;
  evaluations: { rank: Rank; divisions: { name: string } | null } | null;
}

/** UI表示用の改善計画型 */
interface DisplayPlan {
  id: string;
  memberName: string;
  grade: Grade;
  divisionName: string;
  managerName: string;
  rank: Rank;
  planDescription: string;
  milestones: Array<{ title: string; dueDate: string; completed: boolean }>;
  reviewFrequency: ReviewFrequency;
  startDate: string;
  endDate: string | null;
  status: ImprovementPlanStatus;
  outcome: string | null;
}

/** JSONB milestonesを安全にパースする */
function parseMilestones(raw: unknown): Array<{ title: string; dueDate: string; completed: boolean }> {
  if (!Array.isArray(raw)) return [];
  return (raw as ImprovementMilestone[]).map((m) => ({
    title: m.title,
    dueDate: m.due_date,
    completed: m.completed,
  }));
}

/** Supabase行をUI表示用に変換する */
function toDisplayPlan(row: ImprovementPlanRow): DisplayPlan {
  return {
    id: row.id,
    memberName: row.members?.name ?? '---',
    grade: row.members?.grade ?? 'G1',
    divisionName: row.evaluations?.divisions?.name ?? '---',
    managerName: row.manager?.name ?? '---',
    rank: (row.evaluations?.rank as Rank) ?? 'C',
    planDescription: row.plan_description,
    milestones: parseMilestones(row.milestones),
    reviewFrequency: row.review_frequency,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    outcome: row.outcome,
  };
}

/** C/D評価のSupabaseクエリ結果型 */
interface CdEvalRow {
  id: string;
  member_id: string;
  rank: Rank;
  members: { name: string } | null;
}

const STATUS_CONFIG: Record<ImprovementPlanStatus, { label: string; color: string }> = {
  active: { label: '進行中', color: 'text-[#f59e0b] border-[#f59e0b]' },
  completed: { label: '完了', color: 'text-[#22d3ee] border-[#22d3ee]' },
  cancelled: { label: '中止', color: 'text-[#737373] border-[#737373]' },
};


export default async function ImprovementPlansPage() {
  const member = await getCurrentMember();
  if (!member || !['G3', 'G4', 'G5'].includes(member.grade)) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 sm:p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">アクセス権限がありません</h2>
          <p className="text-sm text-[#737373]">改善計画管理はG3以上の等級のメンバーのみ利用可能です。</p>
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
  const { data: rawPlans } = await supabase
    .from('improvement_plans')
    .select(`
      id, plan_description, milestones, review_frequency, start_date, end_date, status, outcome,
      members!improvement_plans_member_id_fkey (name, grade),
      manager:members!improvement_plans_manager_id_fkey (name),
      evaluations (rank, divisions (name))
    `)
    .order('created_at', { ascending: false });

  const plans: DisplayPlan[] = (rawPlans as ImprovementPlanRow[] | null)?.map(toDisplayPlan) ?? [];

  // C/Dランクの評価を取得（改善計画作成フォーム用）
  // まだ改善計画が作られていないevaluationのみ対象
  const { data: cdEvalRaw } = await supabase
    .from('evaluations')
    .select('id, member_id, rank, members!evaluations_member_id_fkey(name)')
    .in('rank', ['C', 'D'])
    .in('status', ['calibrated', 'feedback_done', 'finalized'])
    .order('created_at', { ascending: false });

  // 既存の改善計画で使われているevaluation_idを除外
  const { data: existingPlanEvalIds } = await supabase
    .from('improvement_plans')
    .select('evaluation_id');

  const usedEvalIdSet = new Set(
    (existingPlanEvalIds as Array<{ evaluation_id: string }> | null)?.map(
      (row) => row.evaluation_id
    ) ?? []
  );

  const cdMembers = (cdEvalRaw as CdEvalRow[] | null)
    ?.filter((row) => !usedEvalIdSet.has(row.id))
    .map((row) => ({
      evaluationId: row.id,
      memberId: row.member_id,
      memberName: row.members?.name ?? '---',
      rank: row.rank as string,
    })) ?? [];

  const activeCount = plans.filter((p) => p.status === 'active').length;
  const completedCount = plans.filter((p) => p.status === 'completed').length;

  return (
    <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* ページヘッダー */}
        <div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
                改善計画管理
              </h1>
              <p className="text-sm text-[#737373] mt-1">
                C/Dランクメンバーの改善計画と進捗管理
              </p>
            </div>
          </div>
        </div>

        {/* 新規作成フォーム */}
        <ImprovementPlanFormClient
          managerId={member.id}
          cdMembers={cdMembers}
        />

        {/* サマリー */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-1">合計</div>
            <div className="text-2xl font-bold text-[#e5e5e5]">{plans.length}</div>
          </div>
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-1">進行中</div>
            <div className="text-2xl font-bold text-[#f59e0b]">{activeCount}</div>
          </div>
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-1">完了</div>
            <div className="text-2xl font-bold text-[#22d3ee]">{completedCount}</div>
          </div>
        </div>

        {/* 改善計画カード */}
        <div className="space-y-4">
          {plans.length === 0 && (
            <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-6 sm:p-12 text-center">
              <p className="text-sm text-[#737373]">改善計画はまだ登録されていません</p>
            </div>
          )}
          {plans.map((plan) => {
            const statusConfig = STATUS_CONFIG[plan.status];
            const completedMilestones = plan.milestones.filter((m) => m.completed).length;
            const totalMilestones = plan.milestones.length;
            const progressPct = totalMilestones > 0
              ? Math.round((completedMilestones / totalMilestones) * 100)
              : 0;

            return (
              <div key={plan.id} className="border border-[#1a1a1a] bg-[#0a0a0a]">
                {/* ヘッダー */}
                <div className="border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-[#e5e5e5] font-bold">{plan.memberName}</span>
                    <span className="px-2 py-0.5 border border-[#333333] text-xs text-[#a3a3a3]">
                      {plan.grade}
                    </span>
                    <EvalRankBadge rank={plan.rank} size="sm" />
                    <span className="text-xs text-[#737373]">{plan.divisionName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 border text-[10px] font-bold ${statusConfig.color}`}>
                      {statusConfig.label}
                    </span>
                    <span className="text-xs text-[#404040]">
                      {plan.reviewFrequency === 'weekly' ? '週次' : '月次'}レビュー
                    </span>
                  </div>
                </div>

                {/* 内容 */}
                <div className="p-4 space-y-4">
                  {/* 計画内容 */}
                  <div>
                    <div className="text-[10px] text-[#737373] uppercase tracking-wider mb-1">
                      改善計画
                    </div>
                    <p className="text-sm text-[#a3a3a3] leading-relaxed">
                      {plan.planDescription}
                    </p>
                  </div>

                  {/* 期間 */}
                  <div className="flex items-center gap-4 text-xs text-[#737373]">
                    <span>開始: {plan.startDate}</span>
                    <span>終了: {plan.endDate ?? '未定'}</span>
                    <span>担当上長: {plan.managerName}</span>
                  </div>

                  {/* マイルストーン */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] text-[#737373] uppercase tracking-wider">
                        マイルストーン ({completedMilestones}/{totalMilestones})
                      </div>
                      <span className="text-xs text-[#3b82f6] font-bold">{progressPct}%</span>
                    </div>
                    {/* 進捗バー */}
                    <div className="w-full h-1 bg-[#1a1a1a] mb-3">
                      <div
                        className="h-1 bg-[#3b82f6] transition-all"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <div className="space-y-2">
                      {plan.milestones.map((milestone) => (
                        <div
                          key={milestone.title}
                          className="flex items-center justify-between text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 border ${
                              milestone.completed
                                ? 'bg-[#3b82f6] border-[#3b82f6]'
                                : 'border-[#333333]'
                            }`} />
                            <span className={milestone.completed ? 'text-[#737373] line-through' : 'text-[#e5e5e5]'}>
                              {milestone.title}
                            </span>
                          </div>
                          <span className="text-xs text-[#404040]">{milestone.dueDate}</span>
                        </div>
                      ))}
                    </div>
                    <PlanActions
                      planId={plan.id}
                      status={plan.status}
                      milestones={plan.milestones}
                      canManage={['G3', 'G4', 'G5'].includes(member.grade)}
                    />
                  </div>

                  {/* 結果 (完了時) */}
                  {plan.outcome && (
                    <div className="border-t border-[#1a1a1a] pt-3">
                      <div className="text-[10px] text-[#737373] uppercase tracking-wider mb-1">
                        結果
                      </div>
                      <p className="text-sm text-[#22d3ee]">{plan.outcome}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
