// =============================================================================
// 自己評価 - バリュー評価ページ (Server Component)
// バリュー項目と既存スコアを取得し、クライアントフォームに渡す
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import { getCurrentMember } from '@/lib/auth/get-member';
import { getOrCreateEvaluation } from '@/lib/evaluation/get-or-create-evaluation';
import SelfValuesForm from './SelfValuesForm';

interface SelfValuesPageProps {
  params: Promise<{ periodId: string }>;
}

export default async function SelfValuesPage(props: SelfValuesPageProps) {
  const { periodId } = await props.params;

  // 認証チェック
  const member = await getCurrentMember();
  if (!member) {
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

  // 評価レコード取得
  const evaluation = await getOrCreateEvaluation(member.id, periodId);
  if (!evaluation) {
    return (
      <div className="min-h-screen bg-[#050505] p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">評価データが見つかりません</h2>
          <p className="text-sm text-[#737373]">評価レコードの作成に失敗しました。</p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  // バリュー項目はorg単位で共通
  const { data: items } = await supabase
    .from('value_items')
    .select('id, name, definition, axis, max_score, sort_order')
    .eq('org_id', member.org_id)
    .order('sort_order', { ascending: true });

  const valueItems = (items ?? []) as Array<{
    id: string;
    name: string;
    definition: string;
    axis: string | null;
    max_score: number;
    sort_order: number;
  }>;

  // 既存の eval_value_scores を取得
  const { data: existingScores } = await supabase
    .from('eval_value_scores')
    .select('value_item_id, self_score, evidence')
    .eq('evaluation_id', evaluation.id);

  const scores = (existingScores ?? []) as Array<{
    value_item_id: string;
    self_score: number | null;
    evidence: string | null;
  }>;

  const isReadonly = evaluation.status !== 'draft';

  return (
    <div className="min-h-screen bg-[#050505] p-6">
      <div className="max-w-5xl mx-auto">
        {valueItems.length === 0 ? (
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 text-center">
            <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">バリュー項目が未設定です</h2>
            <p className="text-sm text-[#737373]">
              組織のバリュー評価項目が設定されていません。管理者にお問い合わせください。
            </p>
            <a
              href={`/self/${periodId}`}
              className="inline-block mt-4 px-4 py-2 border border-[#333333] text-xs text-[#a3a3a3] hover:border-[#555555] transition-colors"
            >
              戻る
            </a>
          </div>
        ) : (
          <SelfValuesForm
            evaluationId={evaluation.id}
            periodId={periodId}
            valueItems={valueItems}
            existingScores={scores}
            isReadonly={isReadonly}
          />
        )}
      </div>
    </div>
  );
}
