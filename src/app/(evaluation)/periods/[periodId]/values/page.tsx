// =============================================================================
// 上長評価 - バリュー評価ページ (Server Component)
// 対象メンバーのバリュー項目と自己評価スコアを取得し、
// 上長がマネージャースコアを入力するフォームに渡す
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import { getCurrentMember } from '@/lib/auth/get-member';
import { redirect } from 'next/navigation';
import ManagerValuesForm from './ManagerValuesForm';

interface ValuesPageProps {
  params: Promise<{ periodId: string }>;
  searchParams: Promise<{ memberId?: string }>;
}

export default async function ValuesPage(props: ValuesPageProps) {
  const { periodId } = await props.params;
  const { memberId } = await props.searchParams;

  // 認証チェック
  const currentMember = await getCurrentMember();
  if (!currentMember) {
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

  // マネージャー等級チェック (G3以上)
  const managerGrades = ['G3', 'G4', 'G5'];
  if (!managerGrades.includes(currentMember.grade)) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
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

  // 対象メンバー情報を取得
  const { data: targetMember } = await supabase
    .from('members')
    .select('id, name, grade')
    .eq('id', memberId)
    .single();

  if (!targetMember) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
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
    .select('id, status')
    .eq('member_id', memberId)
    .eq('eval_period_id', periodId)
    .limit(1)
    .single();

  if (!evaluation) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">評価データが見つかりません</h2>
          <p className="text-sm text-[#737373]">
            対象メンバーの評価レコードが存在しません。自己評価が完了していない可能性があります。
          </p>
        </div>
      </div>
    );
  }

  const evalRecord = evaluation as { id: string; status: string };

  // バリュー項目を取得 (org単位で共通)
  const { data: items } = await supabase
    .from('value_items')
    .select('id, name, definition, axis, max_score, sort_order')
    .eq('org_id', currentMember.org_id)
    .order('sort_order', { ascending: true });

  const valueItems = (items ?? []) as Array<{
    id: string;
    name: string;
    definition: string;
    axis: string | null;
    max_score: number;
    sort_order: number;
  }>;

  // 既存の eval_value_scores を取得 (自己評価 + 上長評価両方)
  const { data: existingScores } = await supabase
    .from('eval_value_scores')
    .select('value_item_id, self_score, manager_score, evidence')
    .eq('evaluation_id', evalRecord.id);

  const scores = (existingScores ?? []) as Array<{
    value_item_id: string;
    self_score: number | null;
    manager_score: number | null;
    evidence: string | null;
  }>;

  // 上長評価提出済みかどうか
  const readonlyStatuses = ['manager_submitted', 'calibrated', 'feedback_done', 'finalized'];
  const isReadonly = readonlyStatuses.includes(evalRecord.status);

  return (
    <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
      <div className="max-w-5xl mx-auto">
        {valueItems.length === 0 ? (
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 text-center">
            <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">バリュー項目が未設定です</h2>
            <p className="text-sm text-[#737373]">
              組織のバリュー評価項目が設定されていません。管理者にお問い合わせください。
            </p>
            <a
              href={`/periods/${periodId}`}
              className="inline-block mt-4 px-4 py-2 border border-[#333333] text-xs text-[#a3a3a3] hover:border-[#555555] transition-colors"
            >
              戻る
            </a>
          </div>
        ) : (
          <ManagerValuesForm
            evaluationId={evalRecord.id}
            periodId={periodId}
            memberName={member.name}
            memberGrade={member.grade}
            valueItems={valueItems}
            existingScores={scores}
            isReadonly={isReadonly}
          />
        )}
      </div>
    </div>
  );
}
