// =============================================================================
// 自己評価 - 定性行動評価ページ (Server Component)
// 行動項目と既存スコアを取得し、クライアントフォームに渡す
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import { getCurrentMember } from '@/lib/auth/get-member';
import { getOrCreateEvaluation } from '@/lib/evaluation/get-or-create-evaluation';
import SelfQualitativeForm from './SelfQualitativeForm';
import type { BehaviorScore } from '@/types/evaluation';

interface SelfQualitativePageProps {
  params: Promise<{ periodId: string }>;
}

export default async function SelfQualitativePage(props: SelfQualitativePageProps) {
  const { periodId } = await props.params;

  // 認証チェック
  const member = await getCurrentMember();
  if (!member) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 max-w-md text-center">
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
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">評価データが見つかりません</h2>
          <p className="text-sm text-[#737373]">評価レコードの作成に失敗しました。</p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  // メンバーの事業部での職種を取得
  const { data: divMember } = await supabase
    .from('division_members')
    .select('role')
    .eq('member_id', member.id)
    .eq('division_id', evaluation.division_id)
    .limit(1)
    .single();

  const role = (divMember as { role: string } | null)?.role ?? '';

  // 定性評価テンプレートを取得
  const { data: template } = await supabase
    .from('kpi_templates')
    .select('id')
    .eq('division_id', evaluation.division_id)
    .eq('role', role)
    .eq('eval_type', 'qualitative')
    .eq('is_active', true)
    .limit(1)
    .single();

  // 行動項目を取得
  let behaviorItems: Array<{
    id: string;
    name: string;
    criteria: string;
    max_score: number;
    sort_order: number;
  }> = [];

  if (template) {
    const { data: items } = await supabase
      .from('behavior_items')
      .select('id, name, criteria, max_score, sort_order')
      .eq('template_id', (template as { id: string }).id)
      .order('sort_order', { ascending: true });

    if (items) {
      behaviorItems = items as typeof behaviorItems;
    }
  }

  // 既存の eval_behavior_scores を取得
  const { data: existingScores } = await supabase
    .from('eval_behavior_scores')
    .select('behavior_item_id, self_score, comment')
    .eq('evaluation_id', evaluation.id);

  const scores = (existingScores ?? []) as Array<{
    behavior_item_id: string;
    self_score: BehaviorScore | null;
    comment: string | null;
  }>;

  const isReadonly = evaluation.status !== 'draft';

  return (
    <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
      <div className="max-w-5xl mx-auto">
        {behaviorItems.length === 0 ? (
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 text-center">
            <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">行動評価項目が未設定です</h2>
            <p className="text-sm text-[#737373]">
              この事業部・職種の定性評価テンプレートが設定されていません。管理者にお問い合わせください。
            </p>
            <a
              href={`/self/${periodId}`}
              className="inline-block mt-4 px-4 py-2 border border-[#333333] text-xs text-[#a3a3a3] hover:border-[#555555] transition-colors"
            >
              戻る
            </a>
          </div>
        ) : (
          <SelfQualitativeForm
            evaluationId={evaluation.id}
            periodId={periodId}
            behaviorItems={behaviorItems}
            existingScores={scores}
            isReadonly={isReadonly}
          />
        )}
      </div>
    </div>
  );
}
