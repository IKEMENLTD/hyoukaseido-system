// =============================================================================
// 上長評価 - サマリー & 提出ページ (Server Component)
// 対象メンバーの全スコアを集約し、上長コメント入力・提出フォームに渡す
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import { getCurrentMember } from '@/lib/auth/get-member';
import { redirect } from 'next/navigation';
import ManagerSummarySubmit from './ManagerSummarySubmit';
import type { Phase, Grade, EvaluationStatus, Rank, PromotionEligibility } from '@/types/evaluation';

interface SummaryPageProps {
  params: Promise<{ periodId: string }>;
  searchParams: Promise<{ memberId?: string }>;
}

interface EvaluationData {
  id: string;
  member_id: string;
  division_id: string;
  grade_at_eval: Grade;
  phase_at_eval: Phase;
  quantitative_score: number | null;
  qualitative_score: number | null;
  value_score: number | null;
  total_score: number | null;
  rank: Rank | null;
  self_comment: string | null;
  evaluator_comment: string | null;
  next_actions: string | null;
  status: EvaluationStatus;
  promotion_eligibility: PromotionEligibility;
  salary_change_recommended: number | null;
  promotion_recommended: boolean;
  upper_behavior_bonus: number;
}

export default async function SummaryPage(props: SummaryPageProps) {
  const { periodId } = await props.params;
  const { memberId } = await props.searchParams;

  // 認証チェック
  const currentMember = await getCurrentMember();
  if (!currentMember) {
    return (
      <div className="min-h-screen bg-[#050505] p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">メンバー未登録</h2>
          <p className="text-sm text-[#737373]">
            ログインユーザーにメンバー情報が紐付けられていません。
          </p>
        </div>
      </div>
    );
  }

  // マネージャー等級チェック (G3以上)
  const managerGrades = ['G3', 'G4', 'G5'];
  if (!managerGrades.includes(currentMember.grade)) {
    return (
      <div className="min-h-screen bg-[#050505] p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">アクセス権限がありません</h2>
          <p className="text-sm text-[#737373]">
            上長評価はG3以上の等級のメンバーのみ利用できます。
          </p>
        </div>
      </div>
    );
  }

  // memberId パラメータチェック
  if (!memberId) {
    redirect(`/periods/${periodId}`);
  }

  const supabase = await createClient();

  // G3の場合、事業部長として対象メンバーの事業部に所属しているか確認
  // G4/G5は全評価にアクセス可能
  if (currentMember.grade === 'G3') {
    const { data: managerDivisions } = await supabase
      .from('division_members')
      .select('division_id')
      .eq('member_id', currentMember.id)
      .eq('is_head', true);

    const { data: targetDivisions } = await supabase
      .from('division_members')
      .select('division_id')
      .eq('member_id', memberId);

    const managerDivIds = new Set((managerDivisions ?? []).map((d: { division_id: string }) => d.division_id));
    const hasAccess = (targetDivisions ?? []).some((d: { division_id: string }) => managerDivIds.has(d.division_id));

    if (!hasAccess) {
      return (
        <div className="min-h-screen bg-[#050505] p-6 flex items-center justify-center">
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 max-w-md text-center">
            <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">アクセス権限がありません</h2>
            <p className="text-sm text-[#737373]">
              対象メンバーが所属する事業部の事業部長ではありません。
            </p>
          </div>
        </div>
      );
    }
  }

  // 対象メンバー情報を取得
  const { data: targetMember } = await supabase
    .from('members')
    .select('id, name, grade')
    .eq('id', memberId)
    .single();

  if (!targetMember) {
    return (
      <div className="min-h-screen bg-[#050505] p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">対象メンバーが見つかりません</h2>
          <p className="text-sm text-[#737373]">
            指定されたメンバーIDに対応するメンバーが存在しません。
          </p>
        </div>
      </div>
    );
  }

  const member = targetMember as { id: string; name: string; grade: string };

  // 対象メンバーの評価レコードを取得
  const { data: evaluation } = await supabase
    .from('evaluations')
    .select(
      'id, member_id, division_id, grade_at_eval, phase_at_eval, ' +
      'quantitative_score, qualitative_score, value_score, total_score, rank, ' +
      'self_comment, evaluator_comment, next_actions, status, ' +
      'promotion_eligibility, salary_change_recommended, promotion_recommended, upper_behavior_bonus'
    )
    .eq('member_id', memberId)
    .eq('eval_period_id', periodId)
    .limit(1)
    .single();

  if (!evaluation) {
    return (
      <div className="min-h-screen bg-[#050505] p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">評価データが見つかりません</h2>
          <p className="text-sm text-[#737373]">
            対象メンバーの評価レコードが存在しません。自己評価が完了していない可能性があります。
          </p>
        </div>
      </div>
    );
  }

  const evalData = evaluation as unknown as EvaluationData;

  // 評価期間情報を取得
  const { data: period } = await supabase
    .from('eval_periods')
    .select('name')
    .eq('id', periodId)
    .single();

  const periodName = (period as { name: string } | null)?.name ?? '不明な評価期間';

  // 事業部名を取得
  const { data: division } = await supabase
    .from('divisions')
    .select('name')
    .eq('id', evalData.division_id)
    .single();

  const divisionName = (division as { name: string } | null)?.name ?? '不明';

  // 各セクションのデータ有無を確認
  const { count: kpiCount } = await supabase
    .from('eval_kpi_scores')
    .select('id', { count: 'exact', head: true })
    .eq('evaluation_id', evalData.id)
    .not('actual_value', 'is', null);

  const { count: behaviorCount } = await supabase
    .from('eval_behavior_scores')
    .select('id', { count: 'exact', head: true })
    .eq('evaluation_id', evalData.id)
    .not('self_score', 'is', null);

  const { count: valueCount } = await supabase
    .from('eval_value_scores')
    .select('id', { count: 'exact', head: true })
    .eq('evaluation_id', evalData.id)
    .not('self_score', 'is', null);

  const hasQuantitativeData = (kpiCount ?? 0) > 0;
  const hasQualitativeData = (behaviorCount ?? 0) > 0;
  const hasValueData = (valueCount ?? 0) > 0;

  // 上長評価提出済みかどうか
  const readonlyStatuses: EvaluationStatus[] = ['manager_submitted', 'calibrated', 'feedback_done', 'finalized'];
  const isReadonly = readonlyStatuses.includes(evalData.status);

  return (
    <div className="min-h-screen bg-[#050505] p-6">
      <div className="max-w-5xl mx-auto">
        <ManagerSummarySubmit
          evaluationId={evalData.id}
          periodId={periodId}
          currentManagerId={currentMember.id}
          memberName={member.name}
          grade={evalData.grade_at_eval}
          divisionName={divisionName}
          phase={evalData.phase_at_eval}
          periodName={periodName}
          scores={{
            quantitative_score: evalData.quantitative_score,
            qualitative_score: evalData.qualitative_score,
            value_score: evalData.value_score,
          }}
          existingSelfComment={evalData.self_comment}
          existingEvaluatorComment={evalData.evaluator_comment}
          existingNextActions={evalData.next_actions}
          isReadonly={isReadonly}
          hasQuantitativeData={hasQuantitativeData}
          hasQualitativeData={hasQualitativeData}
          hasValueData={hasValueData}
        />
      </div>
    </div>
  );
}
