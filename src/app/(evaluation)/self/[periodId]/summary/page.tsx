// =============================================================================
// 自己評価 - サマリー & 提出ページ (Server Component)
// 全スコアを集約し、提出用クライアントコンポーネントに渡す
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import { getCurrentMember } from '@/lib/auth/get-member';
import { getOrCreateEvaluation } from '@/lib/evaluation/get-or-create-evaluation';
import SelfSummarySubmit from './SelfSummarySubmit';
import type { Phase } from '@/types/evaluation';

interface SelfSummaryPageProps {
  params: Promise<{ periodId: string }>;
}

export default async function SelfSummaryPage(props: SelfSummaryPageProps) {
  const { periodId } = await props.params;

  // 認証チェック
  const member = await getCurrentMember();
  if (!member) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 sm:p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">メンバー未登録</h2>
          <p className="text-sm text-[#737373]">
            ログインユーザーにメンバー情報が紐付けられていません。
          </p>
        </div>
      </div>
    );
  }

  // 評価レコード取得
  const evaluation = await getOrCreateEvaluation(member.id, periodId);
  if (!evaluation) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 sm:p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">評価データが見つかりません</h2>
          <p className="text-sm text-[#737373]">評価レコードの作成に失敗しました。</p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  // 評価期間名を取得
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
    .eq('id', evaluation.division_id)
    .single();

  const divisionName = (division as { name: string } | null)?.name ?? '不明';

  // 各セクションのデータ有無を確認
  const { count: kpiCount } = await supabase
    .from('eval_kpi_scores')
    .select('id', { count: 'exact', head: true })
    .eq('evaluation_id', evaluation.id)
    .not('actual_value', 'is', null);

  const { count: behaviorCount } = await supabase
    .from('eval_behavior_scores')
    .select('id', { count: 'exact', head: true })
    .eq('evaluation_id', evaluation.id)
    .not('self_score', 'is', null);

  const { count: valueCount } = await supabase
    .from('eval_value_scores')
    .select('id', { count: 'exact', head: true })
    .eq('evaluation_id', evaluation.id)
    .not('self_score', 'is', null);

  const hasQuantitativeData = (kpiCount ?? 0) > 0;
  const hasQualitativeData = (behaviorCount ?? 0) > 0;
  const hasValueData = (valueCount ?? 0) > 0;

  const isSubmitted = evaluation.status !== 'draft';

  return (
    <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <SelfSummarySubmit
          evaluationId={evaluation.id}
          periodId={periodId}
          memberName={member.name}
          grade={evaluation.grade_at_eval}
          divisionName={divisionName}
          phase={evaluation.phase_at_eval as Phase}
          periodName={periodName}
          scores={{
            quantitative_score: evaluation.quantitative_score,
            qualitative_score: evaluation.qualitative_score,
            value_score: evaluation.value_score,
          }}
          existingSelfComment={evaluation.self_comment}
          isSubmitted={isSubmitted}
          hasQuantitativeData={hasQuantitativeData}
          hasQualitativeData={hasQualitativeData}
          hasValueData={hasValueData}
        />
      </div>
    </div>
  );
}
