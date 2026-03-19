// =============================================================================
// 上長評価 - 定性行動評価ページ (Server Component)
// メンバーの自己評価を参照しながら、上長が行動評価スコアを入力する
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import { getCurrentMember } from '@/lib/auth/get-member';
import ManagerQualitativeForm from './ManagerQualitativeForm';
import type { BehaviorScore, Grade } from '@/types/evaluation';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface QualitativePageProps {
  params: Promise<{ periodId: string }>;
  searchParams: Promise<{ memberId?: string }>;
}

// 上長等級 (G3以上)
const MANAGER_GRADES: ReadonlySet<string> = new Set(['G3', 'G4', 'G5']);

// ---------------------------------------------------------------------------
// エラー表示用ヘルパー
// ---------------------------------------------------------------------------

function ErrorCard({ title, description, backHref }: {
  title: string;
  description: string;
  backHref?: string;
}) {
  return (
    <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
      <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 sm:p-8 max-w-md text-center">
        <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">{title}</h2>
        <p className="text-sm text-[#737373]">{description}</p>
        {backHref && (
          <a
            href={backHref}
            className="inline-block mt-4 px-4 py-2 border border-[#333333] text-xs text-[#a3a3a3] hover:border-[#555555] transition-colors"
          >
            戻る
          </a>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ページコンポーネント
// ---------------------------------------------------------------------------

export default async function ManagerQualitativePage(props: QualitativePageProps) {
  const { periodId } = await props.params;
  const { memberId } = await props.searchParams;

  // 認証チェック
  const currentMember = await getCurrentMember();
  if (!currentMember) {
    return (
      <ErrorCard
        title="メンバー未登録"
        description="ログインユーザーにメンバー情報が紐付けられていません。"
      />
    );
  }

  // 上長等級チェック
  if (!MANAGER_GRADES.has(currentMember.grade)) {
    return (
      <ErrorCard
        title="権限エラー"
        description="上長評価は G3 以上の等級が必要です。"
        backHref={`/periods/${periodId}`}
      />
    );
  }

  // memberId パラメータチェック
  if (!memberId) {
    return (
      <ErrorCard
        title="対象メンバー未指定"
        description="評価対象のメンバーIDが指定されていません。"
        backHref={`/periods/${periodId}`}
      />
    );
  }

  const supabase = await createClient();

  // 対象メンバーの評価レコードを取得
  const { data: evaluation, error: evaluationErr } = await supabase
    .from('evaluations')
    .select('id, division_id, status, grade_at_eval')
    .eq('member_id', memberId)
    .eq('eval_period_id', periodId)
    .limit(1)
    .single();
  if (evaluationErr) console.error('[DB] evaluations 取得エラー:', evaluationErr);

  if (!evaluation) {
    return (
      <ErrorCard
        title="評価データが見つかりません"
        description="対象メンバーの評価レコードが存在しません。自己評価が完了しているか確認してください。"
        backHref={`/periods/${periodId}`}
      />
    );
  }

  const evalRecord = evaluation as {
    id: string;
    division_id: string;
    status: string;
    grade_at_eval: Grade;
  };

  // 対象メンバー情報を取得
  const { data: targetMember, error: targetMemberErr } = await supabase
    .from('members')
    .select('id, name, grade')
    .eq('id', memberId)
    .single();
  if (targetMemberErr) console.error('[DB] members 取得エラー:', targetMemberErr);

  if (!targetMember) {
    return (
      <ErrorCard
        title="メンバーが見つかりません"
        description="指定されたメンバーIDに対応するメンバーが存在しません。"
        backHref={`/periods/${periodId}`}
      />
    );
  }

  const member = targetMember as { id: string; name: string; grade: Grade };

  // メンバーの事業部での職種を取得
  const { data: divMember, error: divMemberErr } = await supabase
    .from('division_members')
    .select('role')
    .eq('member_id', memberId)
    .eq('division_id', evalRecord.division_id)
    .limit(1)
    .single();
  if (divMemberErr) console.error('[DB] division_members 取得エラー:', divMemberErr);

  const role = (divMember as { role: string } | null)?.role ?? '';

  // 定性評価テンプレートを取得
  const { data: template, error: templateErr } = await supabase
    .from('kpi_templates')
    .select('id')
    .eq('division_id', evalRecord.division_id)
    .eq('role', role)
    .eq('eval_type', 'qualitative')
    .eq('is_active', true)
    .limit(1)
    .single();
  if (templateErr) console.error('[DB] kpi_templates 取得エラー:', templateErr);

  // 行動項目を取得
  let behaviorItems: Array<{
    id: string;
    name: string;
    criteria: string;
    max_score: number;
    sort_order: number;
  }> = [];

  if (template) {
    const { data: items, error: itemsErr } = await supabase
      .from('behavior_items')
      .select('id, name, criteria, max_score, sort_order')
      .eq('template_id', (template as { id: string }).id)
      .order('sort_order', { ascending: true });
    if (itemsErr) console.error('[DB] behavior_items 取得エラー:', itemsErr);

    if (items) {
      behaviorItems = items as typeof behaviorItems;
    }
  }

  // 既存の eval_behavior_scores を取得 (自己評価 + 上長評価)
  const { data: existingScores, error: existingScoresErr } = await supabase
    .from('eval_behavior_scores')
    .select('behavior_item_id, self_score, manager_score, comment, is_upper_grade_behavior')
    .eq('evaluation_id', evalRecord.id);
  if (existingScoresErr) console.error('[DB] eval_behavior_scores 取得エラー:', existingScoresErr);

  const scores = (existingScores ?? []) as Array<{
    behavior_item_id: string;
    self_score: BehaviorScore | null;
    manager_score: BehaviorScore | null;
    comment: string | null;
    is_upper_grade_behavior: boolean;
  }>;

  return (
    <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
      <div className="max-w-5xl mx-auto">
        {behaviorItems.length === 0 ? (
          <ErrorCard
            title="行動評価項目が未設定です"
            description="この事業部・職種の定性評価テンプレートが設定されていません。管理者にお問い合わせください。"
            backHref={`/periods/${periodId}`}
          />
        ) : (
          <ManagerQualitativeForm
            evaluationId={evalRecord.id}
            periodId={periodId}
            memberId={memberId}
            memberName={member.name}
            memberGrade={member.grade}
            behaviorItems={behaviorItems}
            existingScores={scores}
          />
        )}
      </div>
    </div>
  );
}
