// =============================================================================
// キャリブレーションページ (E-03) - Server Component
// 事業部間のランク分布調整、マネージャー間の評価バイアス是正
// Supabaseからデータ取得 -> CalibrationClientへ渡す
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import { getCurrentMember } from '@/lib/auth/get-member';
import CalibrationClient from './CalibrationClient';

export default async function CalibrationPage() {
  const member = await getCurrentMember();

  // G4/G5アクセス制限
  if (!member || !['G4', 'G5'].includes(member.grade)) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 sm:p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">アクセス権限がありません</h2>
          <p className="text-sm text-[#737373]">キャリブレーション機能はG4/G5等級のメンバーのみ利用可能です。</p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  // 最新の評価期間を取得
  const { data: evalPeriod, error: periodError } = await supabase
    .from('eval_periods')
    .select('id, name, half, fiscal_year, status')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (periodError || !evalPeriod) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 sm:p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">評価期間が見つかりません</h2>
          <p className="text-sm text-[#737373]">
            現在、キャリブレーション対象の評価期間が設定されていません。
          </p>
        </div>
      </div>
    );
  }

  // 評価期間の表示名を構築
  const evalPeriodName = evalPeriod.fiscal_year && evalPeriod.half
    ? `${evalPeriod.fiscal_year}年度 ${evalPeriod.half}`
    : evalPeriod.name;

  // その期間の全evaluationsを取得（member, division, evaluator JOIN）
  const { data: evaluations, error: evalError } = await supabase
    .from('evaluations')
    .select(`
      id, quantitative_score, qualitative_score, value_score,
      total_score, rank, status, grade_at_eval,
      members!evaluations_member_id_fkey (name),
      divisions (name),
      evaluator:members!evaluations_evaluator_id_fkey (name)
    `)
    .eq('eval_period_id', evalPeriod.id)
    .in('status', ['manager_submitted', 'calibrated', 'feedback_done', 'finalized']);

  if (evalError) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 sm:p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">データ取得エラー</h2>
          <p className="text-sm text-[#737373]">
            評価データの取得中にエラーが発生しました。しばらく経ってから再度お試しください。
          </p>
        </div>
      </div>
    );
  }

  if (!evaluations || evaluations.length === 0) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 sm:p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">対象データがありません</h2>
          <p className="text-sm text-[#737373]">
            現在の評価期間にキャリブレーション対象の評価データがありません。
          </p>
        </div>
      </div>
    );
  }

  // Supabaseのリレーション結果をフラットなPropsに変換
  const mappedEvaluations = evaluations.map((e) => {
    // Supabaseのリレーション結果の型を安全に処理
    const memberRelation = e.members as unknown as { name: string } | null;
    const divisionRelation = e.divisions as unknown as { name: string } | null;
    const evaluatorRelation = e.evaluator as unknown as { name: string } | null;

    return {
      id: e.id as string,
      memberName: memberRelation?.name ?? '不明',
      grade: (e.grade_at_eval as string) ?? '',
      divisionName: divisionRelation?.name ?? '不明',
      evaluatorName: evaluatorRelation?.name ?? '不明',
      quantitativeScore: (e.quantitative_score as number) ?? 0,
      qualitativeScore: (e.qualitative_score as number) ?? 0,
      valueScore: (e.value_score as number) ?? 0,
      totalScore: (e.total_score as number) ?? 0,
      proposedRank: (e.rank as string) ?? '',
      currentStatus: e.status as string,
    };
  });

  return (
    <CalibrationClient
      evalPeriodName={evalPeriodName}
      evaluations={mappedEvaluations}
    />
  );
}
