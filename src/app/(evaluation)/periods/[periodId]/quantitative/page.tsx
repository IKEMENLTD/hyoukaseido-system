// =============================================================================
// 上長評価 - 定量KPI評価ページ (Server Component)
// メンバーの自己評価KPIデータを取得し、上長が確認するためのビュー
// =============================================================================

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMember } from '@/lib/auth/get-member';
import ManagerQuantitativeForm from './ManagerQuantitativeForm';
import type { Grade } from '@/types/evaluation';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface QuantitativePageProps {
  params: Promise<{ periodId: string }>;
  searchParams: Promise<{ memberId?: string }>;
}

/** 等級の数値レベル (G3以上 = 管理職) */
const GRADE_LEVEL: Record<Grade, number> = {
  G1: 1,
  G2: 2,
  G3: 3,
  G4: 4,
  G5: 5,
};

// ---------------------------------------------------------------------------
// ページコンポーネント
// ---------------------------------------------------------------------------

export default async function QuantitativePage(props: QuantitativePageProps) {
  const { periodId } = await props.params;
  const { memberId } = await props.searchParams;

  // memberId が未指定の場合はリダイレクト
  if (!memberId) {
    redirect(`/periods/${periodId}`);
  }

  // 認証チェック
  const currentMember = await getCurrentMember();
  if (!currentMember) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">
            メンバー未登録
          </h2>
          <p className="text-sm text-[#737373]">
            ログインユーザーにメンバー情報が紐付けられていません。
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  // 権限チェック: G3以上 または 対象メンバーの事業部長
  const isGrade3Plus = GRADE_LEVEL[currentMember.grade] >= 3;

  // 対象メンバーの事業部における is_head チェック
  const { data: headCheck } = await supabase
    .from('division_members')
    .select('is_head, division_id')
    .eq('member_id', currentMember.id)
    .eq('is_head', true);

  const headDivisionIds = (headCheck ?? []).map(
    (row) => (row as { is_head: boolean; division_id: string }).division_id
  );

  // 対象メンバーの所属事業部を確認
  const { data: targetDivisions } = await supabase
    .from('division_members')
    .select('division_id')
    .eq('member_id', memberId);

  const targetDivisionIds = (targetDivisions ?? []).map(
    (row) => (row as { division_id: string }).division_id
  );

  const isHeadOfTargetDivision = headDivisionIds.some((divId) =>
    targetDivisionIds.includes(divId)
  );

  if (!isGrade3Plus && !isHeadOfTargetDivision) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">
            アクセス権限がありません
          </h2>
          <p className="text-sm text-[#737373]">
            このページはG3以上の等級、または事業部長のみアクセスできます。
          </p>
          <a
            href={`/periods/${periodId}`}
            className="inline-block mt-4 px-4 py-2 border border-[#333333] text-xs text-[#a3a3a3] hover:border-[#555555] transition-colors"
          >
            戻る
          </a>
        </div>
      </div>
    );
  }

  // 対象メンバーの情報を取得
  const { data: targetMember } = await supabase
    .from('members')
    .select('id, name, grade')
    .eq('id', memberId)
    .single();

  if (!targetMember) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">
            メンバーが見つかりません
          </h2>
          <p className="text-sm text-[#737373]">
            指定されたメンバーIDに該当するメンバーが存在しません。
          </p>
          <a
            href={`/periods/${periodId}`}
            className="inline-block mt-4 px-4 py-2 border border-[#333333] text-xs text-[#a3a3a3] hover:border-[#555555] transition-colors"
          >
            戻る
          </a>
        </div>
      </div>
    );
  }

  const member = targetMember as { id: string; name: string; grade: Grade };

  // 対象メンバーの評価レコードを取得
  const { data: evaluation } = await supabase
    .from('evaluations')
    .select('id, division_id, status')
    .eq('member_id', memberId)
    .eq('eval_period_id', periodId)
    .limit(1)
    .single();

  if (!evaluation) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">
            評価データが見つかりません
          </h2>
          <p className="text-sm text-[#737373]">
            この評価期間における評価レコードが存在しません。
          </p>
          <a
            href={`/periods/${periodId}?memberId=${memberId}`}
            className="inline-block mt-4 px-4 py-2 border border-[#333333] text-xs text-[#a3a3a3] hover:border-[#555555] transition-colors"
          >
            戻る
          </a>
        </div>
      </div>
    );
  }

  const evalData = evaluation as {
    id: string;
    division_id: string;
    status: string;
  };

  // メンバーの事業部での職種 (role) を取得
  const { data: divMember } = await supabase
    .from('division_members')
    .select('role')
    .eq('member_id', memberId)
    .eq('division_id', evalData.division_id)
    .limit(1)
    .single();

  const role = (divMember as { role: string } | null)?.role ?? '';

  // 定量KPIテンプレートを取得
  const { data: template } = await supabase
    .from('kpi_templates')
    .select('id')
    .eq('division_id', evalData.division_id)
    .eq('role', role)
    .eq('eval_type', 'quantitative')
    .eq('is_active', true)
    .limit(1)
    .single();

  // KPI項目を取得
  let kpiItems: Array<{
    id: string;
    name: string;
    description: string | null;
    weight: number;
    measurement_unit: string | null;
    threshold_s: number | null;
    threshold_a: number | null;
    threshold_b: number | null;
    threshold_c: number | null;
    sort_order: number;
  }> = [];

  if (template) {
    const { data: items } = await supabase
      .from('kpi_items')
      .select(
        'id, name, description, weight, measurement_unit, threshold_s, threshold_a, threshold_b, threshold_c, sort_order'
      )
      .eq('template_id', (template as { id: string }).id)
      .order('sort_order', { ascending: true });

    if (items) {
      kpiItems = items as typeof kpiItems;
    }
  }

  // 既存の eval_kpi_scores を取得
  const { data: existingScores } = await supabase
    .from('eval_kpi_scores')
    .select(
      'kpi_item_id, target_value, actual_value, achievement_rate, rank, note'
    )
    .eq('evaluation_id', evalData.id);

  const scores = (existingScores ?? []) as Array<{
    kpi_item_id: string;
    target_value: number | null;
    actual_value: number | null;
    achievement_rate: number | null;
    rank: string | null;
    note: string | null;
  }>;

  return (
    <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
      <div className="max-w-5xl mx-auto">
        {kpiItems.length === 0 ? (
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 text-center">
            <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">
              KPI項目が未設定です
            </h2>
            <p className="text-sm text-[#737373]">
              この事業部・職種の定量KPIテンプレートが設定されていません。管理者にお問い合わせください。
            </p>
            <a
              href={`/periods/${periodId}?memberId=${memberId}`}
              className="inline-block mt-4 px-4 py-2 border border-[#333333] text-xs text-[#a3a3a3] hover:border-[#555555] transition-colors"
            >
              戻る
            </a>
          </div>
        ) : (
          <ManagerQuantitativeForm
            periodId={periodId}
            memberId={memberId}
            memberName={member.name}
            memberGrade={member.grade}
            kpiItems={kpiItems}
            existingScores={scores}
          />
        )}
      </div>
    </div>
  );
}
