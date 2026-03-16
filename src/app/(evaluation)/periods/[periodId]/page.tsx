// =============================================================================
// 上長評価 - 評価期間概要ページ (Server Component)
// マネージャー(G3+/部門長)が自部門メンバーの評価進捗を確認し、
// 各メンバーの評価サブページへ遷移する
// =============================================================================

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMember } from '@/lib/auth/get-member';
import type {
  EvalPeriodStatus,
  EvaluationStatus,
  Grade,
  Rank,
} from '@/types/evaluation';
import EvalRankBadge from '@/components/shared/EvalRankBadge';

// -----------------------------------------------------------------------------
// 定数
// -----------------------------------------------------------------------------

const STATUS_CONFIG: Record<EvalPeriodStatus, { label: string; color: string }> = {
  planning: { label: '計画中', color: 'text-[#737373] border-[#737373]' },
  target_setting: { label: '目標設定', color: 'text-[#f59e0b] border-[#f59e0b]' },
  self_eval: { label: '自己評価', color: 'text-[#3b82f6] border-[#3b82f6]' },
  manager_eval: { label: '上長評価', color: 'text-[#22d3ee] border-[#22d3ee]' },
  calibration: { label: 'キャリブレーション', color: 'text-[#a855f7] border-[#a855f7]' },
  feedback: { label: 'フィードバック', color: 'text-[#22d3ee] border-[#22d3ee]' },
  closed: { label: '完了', color: 'text-[#a3a3a3] border-[#a3a3a3]' },
};

const EVAL_STATUS_CONFIG: Record<EvaluationStatus, { label: string; color: string }> = {
  draft: { label: '下書き', color: 'text-[#737373]' },
  self_submitted: { label: '自己評価済', color: 'text-[#f59e0b]' },
  manager_submitted: { label: '上長評価済', color: 'text-[#22d3ee]' },
  calibrated: { label: '調整済', color: 'text-[#a855f7]' },
  feedback_done: { label: 'FB済', color: 'text-[#3b82f6]' },
  finalized: { label: '確定', color: 'text-[#a3a3a3]' },
};

const ALL_STATUSES: EvalPeriodStatus[] = [
  'planning',
  'target_setting',
  'self_eval',
  'manager_eval',
  'calibration',
  'feedback',
  'closed',
];

/** G3以上の等級を判定 */
const MANAGER_GRADES: ReadonlySet<Grade> = new Set<Grade>(['G3', 'G4', 'G5']);

/** 上長評価完了とみなすステータス群 */
const MANAGER_DONE_STATUSES: ReadonlySet<EvaluationStatus> = new Set<EvaluationStatus>([
  'manager_submitted',
  'calibrated',
  'feedback_done',
  'finalized',
]);

// -----------------------------------------------------------------------------
// 型定義
// -----------------------------------------------------------------------------

interface PeriodPageProps {
  params: Promise<{ periodId: string }>;
}

interface TeamMemberRow {
  evaluationId: string;
  memberId: string;
  memberName: string;
  gradeAtEval: Grade;
  status: EvaluationStatus;
  rank: Rank | null;
  totalScore: number | null;
}

// -----------------------------------------------------------------------------
// ヘルパーコンポーネント
// -----------------------------------------------------------------------------

function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
      <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 max-w-md text-center">
        <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">{title}</h2>
        <p className="text-sm text-[#737373]">{message}</p>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// メインページコンポーネント
// -----------------------------------------------------------------------------

export default async function PeriodPage(props: PeriodPageProps) {
  const { periodId } = await props.params;

  // ---- 認証チェック ----
  const member = await getCurrentMember();
  if (!member) {
    return (
      <ErrorCard
        title="メンバー未登録"
        message="ログインユーザーにメンバー情報が紐付けられていません。管理者にお問い合わせください。"
      />
    );
  }

  const supabase = await createClient();

  // ---- 部門長権限チェック ----
  const { data: headDivisions } = await supabase
    .from('division_members')
    .select('division_id')
    .eq('member_id', member.id)
    .eq('is_head', true);

  const headDivisionIds = (headDivisions ?? []).map(
    (d) => (d as { division_id: string }).division_id
  );
  const isManagerGrade = MANAGER_GRADES.has(member.grade);

  if (headDivisionIds.length === 0 && !isManagerGrade) {
    return (
      <ErrorCard
        title="アクセス権限がありません"
        message="このページは部門長(is_head=true)またはG3以上の等級のメンバーのみアクセスできます。"
      />
    );
  }

  // ---- 評価期間の取得 ----
  const { data: periodData } = await supabase
    .from('eval_periods')
    .select('id, name, half, fiscal_year, start_date, end_date, status')
    .eq('id', periodId)
    .single();

  if (!periodData) {
    return (
      <ErrorCard
        title="評価期間が見つかりません"
        message="指定された評価期間は存在しません。URLを確認してください。"
      />
    );
  }

  const evalPeriod = periodData as {
    id: string;
    name: string;
    half: string | null;
    fiscal_year: number | null;
    start_date: string;
    end_date: string;
    status: EvalPeriodStatus;
  };

  // ---- 管理対象の事業部IDリストを決定 ----
  let managedDivisionIds: string[];

  if (headDivisionIds.length > 0) {
    managedDivisionIds = headDivisionIds;
  } else {
    // G3+ だが is_head ではない場合、所属する全事業部を取得
    const { data: memberDivisions } = await supabase
      .from('division_members')
      .select('division_id')
      .eq('member_id', member.id);

    managedDivisionIds = (memberDivisions ?? []).map(
      (d) => (d as { division_id: string }).division_id
    );
  }

  if (managedDivisionIds.length === 0) {
    return (
      <ErrorCard
        title="事業部が見つかりません"
        message="管理対象の事業部が見つかりません。管理者にお問い合わせください。"
      />
    );
  }

  // ---- 事業部名の取得 ----
  const { data: divisionsData } = await supabase
    .from('divisions')
    .select('id, name')
    .in('id', managedDivisionIds);

  const divisionNameMap = new Map<string, string>();
  for (const div of (divisionsData ?? []) as Array<{ id: string; name: string }>) {
    divisionNameMap.set(div.id, div.name);
  }

  // ---- 評価データの取得 ----
  const { data: evaluationsData } = await supabase
    .from('evaluations')
    .select('id, member_id, division_id, grade_at_eval, status, rank, total_score')
    .eq('eval_period_id', periodId)
    .in('division_id', managedDivisionIds);

  const evaluations = (evaluationsData ?? []) as Array<{
    id: string;
    member_id: string;
    division_id: string;
    grade_at_eval: Grade;
    status: EvaluationStatus;
    rank: Rank | null;
    total_score: number | null;
  }>;

  // ---- メンバー名の取得 ----
  const memberIds = evaluations.map((e) => e.member_id);
  const memberNameMap = new Map<string, string>();

  if (memberIds.length > 0) {
    const { data: membersData } = await supabase
      .from('members')
      .select('id, name')
      .in('id', memberIds);

    for (const m of (membersData ?? []) as Array<{ id: string; name: string }>) {
      memberNameMap.set(m.id, m.name);
    }
  }

  // ---- チームメンバー行データの構築 ----
  const teamMembers: TeamMemberRow[] = evaluations.map((ev) => ({
    evaluationId: ev.id,
    memberId: ev.member_id,
    memberName: memberNameMap.get(ev.member_id) ?? '不明',
    gradeAtEval: ev.grade_at_eval,
    status: ev.status,
    rank: ev.rank,
    totalScore: ev.total_score,
  }));

  // 等級の降順 -> 名前の昇順でソート
  const gradeOrder: Record<Grade, number> = { G5: 5, G4: 4, G3: 3, G2: 2, G1: 1 };
  teamMembers.sort((a, b) => {
    const gradeDiff = gradeOrder[b.gradeAtEval] - gradeOrder[a.gradeAtEval];
    if (gradeDiff !== 0) return gradeDiff;
    return a.memberName.localeCompare(b.memberName, 'ja');
  });

  // ---- 進捗の集計 ----
  const totalCount = teamMembers.length;
  const selfSubmittedCount = teamMembers.filter((m) => m.status !== 'draft').length;
  const managerDoneCount = teamMembers.filter((m) =>
    MANAGER_DONE_STATUSES.has(m.status)
  ).length;
  const managerProgress =
    totalCount > 0 ? Math.round((managerDoneCount / totalCount) * 100) : 0;

  const currentStatusIndex = ALL_STATUSES.indexOf(evalPeriod.status);

  // ---- 事業部名表示 ----
  const divisionDisplayName = managedDivisionIds
    .map((id) => divisionNameMap.get(id) ?? '不明')
    .join(' / ');

  return (
    <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ページヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
              上長評価 - {evalPeriod.name}
            </h1>
            <p className="text-sm text-[#737373] mt-1">
              {evalPeriod.start_date} ~ {evalPeriod.end_date}
            </p>
          </div>
          <span
            className={`px-3 py-1 border text-xs font-bold ${STATUS_CONFIG[evalPeriod.status].color}`}
          >
            {STATUS_CONFIG[evalPeriod.status].label}
          </span>
        </div>

        {/* マネージャー情報 */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg text-[#e5e5e5] font-bold">{member.name}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 border border-[#3b82f6] text-xs text-[#3b82f6] font-bold">
                  {member.grade}
                </span>
                <span className="text-xs text-[#737373]">{divisionDisplayName}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-[#737373]">管理対象</div>
              <div className="text-sm text-[#a3a3a3] font-bold">
                {totalCount}名
              </div>
            </div>
          </div>
        </div>

        {/* 評価フローステータスバー */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4">
          <div className="text-xs text-[#737373] uppercase tracking-wider mb-3">
            評価フロー
          </div>
          <div className="flex items-center gap-1">
            {ALL_STATUSES.map((status, index) => {
              const isActive = index === currentStatusIndex;
              const isCompleted = index < currentStatusIndex;
              return (
                <div key={status} className="flex items-center gap-1 flex-1">
                  <div
                    className={`flex-1 h-2 ${
                      isCompleted
                        ? 'bg-[#3b82f6]'
                        : isActive
                          ? 'bg-[#3b82f6]/50'
                          : 'bg-[#1a1a1a]'
                    }`}
                  />
                  {index < ALL_STATUSES.length - 1 && (
                    <div className="w-px h-2 bg-[#050505]" />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-2">
            {ALL_STATUSES.map((status, index) => {
              const isActive = index === currentStatusIndex;
              return (
                <span
                  key={status}
                  className={`text-[10px] ${
                    isActive ? 'text-[#3b82f6] font-bold' : 'text-[#404040]'
                  }`}
                >
                  {STATUS_CONFIG[status].label}
                </span>
              );
            })}
          </div>
        </div>

        {/* 進捗サマリー */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 text-center">
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-1">
              対象メンバー
            </div>
            <div className="text-2xl font-bold text-[#e5e5e5]">{totalCount}</div>
          </div>
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 text-center">
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-1">
              自己評価完了
            </div>
            <div className="text-2xl font-bold text-[#3b82f6]">{selfSubmittedCount}</div>
          </div>
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 text-center">
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-1">
              上長評価完了
            </div>
            <div className="text-2xl font-bold text-[#22d3ee]">{managerDoneCount}</div>
          </div>
        </div>

        {/* 上長評価進捗バー */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-[#737373] uppercase tracking-wider">
              上長評価進捗
            </div>
            <div className="text-sm text-[#e5e5e5]">
              <span className="text-[#22d3ee] font-bold">{managerDoneCount}</span>
              <span className="text-[#737373]"> / {totalCount}名完了</span>
              <span className="text-[#737373] ml-2">({managerProgress}%)</span>
            </div>
          </div>
          <div className="w-full h-2 bg-[#1a1a1a]">
            <div
              className="h-2 bg-[#22d3ee] transition-all"
              style={{ width: `${managerProgress}%` }}
            />
          </div>
        </div>

        {/* 評価メニュー */}
        <div className="grid grid-cols-2 lg:grid-cols-2 sm:grid-cols-4 gap-4">
          <Link
            href={`/periods/${periodId}/quantitative`}
            className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 hover:border-[#3b82f6] transition-colors block"
          >
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-2">
              定量評価
            </div>
            <div className="text-lg font-bold text-[#3b82f6]">KPI</div>
            <div className="text-xs text-[#404040] mt-1">売上/商談数等の実績入力</div>
          </Link>
          <Link
            href={`/periods/${periodId}/qualitative`}
            className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 hover:border-[#22d3ee] transition-colors block"
          >
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-2">
              定性評価
            </div>
            <div className="text-lg font-bold text-[#22d3ee]">行動</div>
            <div className="text-xs text-[#404040] mt-1">行動評価チェックリスト</div>
          </Link>
          <Link
            href={`/periods/${periodId}/values`}
            className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 hover:border-[#a855f7] transition-colors block"
          >
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-2">
              バリュー評価
            </div>
            <div className="text-lg font-bold text-[#a855f7]">VALUE</div>
            <div className="text-xs text-[#404040] mt-1">企業価値への貢献度</div>
          </Link>
          <Link
            href={`/periods/${periodId}/summary`}
            className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 hover:border-[#e5e5e5] transition-colors block"
          >
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-2">
              サマリー
            </div>
            <div className="text-lg font-bold text-[#e5e5e5]">総合</div>
            <div className="text-xs text-[#404040] mt-1">全スコアとランク確認</div>
          </Link>
        </div>

        {/* チーム評価進捗テーブル */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="border-b border-[#1a1a1a] px-4 py-3">
            <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
              チーム評価進捗
            </h3>
          </div>
          {teamMembers.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-[#737373]">
                この評価期間にはまだ評価レコードがありません。
                メンバーが自己評価を開始すると表示されます。
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1a1a1a] text-[#737373]">
                    <th className="px-4 py-2 text-left font-medium">名前</th>
                    <th className="px-4 py-2 text-center font-medium">等級</th>
                    <th className="px-4 py-2 text-center font-medium">ステータス</th>
                    <th className="px-4 py-2 text-center font-medium">スコア</th>
                    <th className="px-4 py-2 text-center font-medium">ランク</th>
                    <th className="px-4 py-2 text-center font-medium">アクション</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMembers.map((tm) => {
                    const canEvaluate =
                      tm.status === 'self_submitted' ||
                      tm.status === 'manager_submitted';

                    return (
                      <tr
                        key={tm.evaluationId}
                        className="border-b border-[#111111] hover:bg-[#111111] transition-colors"
                      >
                        <td className="px-4 py-3 text-[#e5e5e5] font-medium">
                          {tm.memberName}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-0.5 border border-[#333333] text-xs text-[#a3a3a3]">
                            {tm.gradeAtEval}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`text-xs font-medium ${EVAL_STATUS_CONFIG[tm.status].color}`}
                          >
                            {EVAL_STATUS_CONFIG[tm.status].label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {tm.totalScore !== null ? (
                            <span className="text-sm font-bold text-[#e5e5e5]">
                              {Number(tm.totalScore).toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-[#404040]">---</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {tm.rank ? (
                            <EvalRankBadge rank={tm.rank} size="sm" />
                          ) : (
                            <span className="text-[#737373]">---</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {canEvaluate ? (
                            <Link
                              href={`/periods/${periodId}/quantitative?memberId=${tm.memberId}`}
                              className="px-3 py-1 bg-[#3b82f6] text-[#050505] text-xs font-bold uppercase tracking-wider hover:bg-[#2563eb] transition-colors inline-block"
                            >
                              評価する
                            </Link>
                          ) : tm.status === 'draft' ? (
                            <span className="text-xs text-[#404040]">
                              自己評価待ち
                            </span>
                          ) : (
                            <Link
                              href={`/periods/${periodId}/summary?memberId=${tm.memberId}`}
                              className="px-3 py-1 border border-[#333333] text-xs text-[#a3a3a3] hover:border-[#555555] transition-colors inline-block"
                            >
                              確認
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ナビゲーション */}
        <div className="flex items-center justify-between">
          <Link
            href="/history"
            className="px-4 py-2 border border-[#333333] text-xs text-[#a3a3a3] hover:border-[#555555] transition-colors"
          >
            評価履歴へ
          </Link>
        </div>
      </div>
    </div>
  );
}
