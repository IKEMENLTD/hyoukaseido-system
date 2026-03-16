// =============================================================================
// 四半期レビューページ - Server Component
// Supabaseからデータ取得し、ReviewClientに渡す
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import { getCurrentMember } from '@/lib/auth/get-member';
import ReviewClient from './ReviewClient';

// ---------------------------------------------------------------------------
// Supabase query row types
// ---------------------------------------------------------------------------

interface OkrPeriodRow {
  id: string;
  name: string;
  quarter: number;
  fiscal_year: number;
  status: string;
}

interface KeyResultRow {
  id: string;
  title: string;
  target_value: number;
  current_value: number;
  unit: string;
  confidence: number;
  final_score: number | null;
  sort_order: number;
}

interface ObjectiveRow {
  id: string;
  title: string;
  level: string;
  okr_key_results: KeyResultRow[];
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default async function ReviewPage() {
  const member = await getCurrentMember();
  if (!member) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 sm:p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">メンバー未登録</h2>
          <p className="text-sm text-[#737373]">ログインユーザーにメンバー情報が紐付けられていません。</p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  // レビュー対象のOKR期間を取得（最新の期間）
  const { data: okrPeriod, error: periodError } = await supabase
    .from('okr_periods')
    .select('id, name, quarter, fiscal_year, status')
    .order('start_date', { ascending: false })
    .limit(1)
    .single();

  if (periodError || !okrPeriod) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 sm:p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">OKR期間が未設定です</h2>
          <p className="text-sm text-[#737373]">レビュー対象のOKR期間が見つかりません。管理者に連絡してください。</p>
        </div>
      </div>
    );
  }

  const period = okrPeriod as OkrPeriodRow;

  // 自分のObjectives + Key Resultsを取得
  const { data: objectivesData } = await supabase
    .from('okr_objectives')
    .select(`
      id, title, level,
      okr_key_results (id, title, target_value, current_value, unit, confidence, final_score, sort_order)
    `)
    .eq('okr_period_id', period.id)
    .eq('member_id', member.id);

  const objectives = ((objectivesData ?? []) as ObjectiveRow[]).map((obj) => ({
    id: obj.id,
    title: obj.title,
    level: obj.level,
    keyResults: (obj.okr_key_results ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((kr) => ({
        id: kr.id,
        title: kr.title,
        targetValue: kr.target_value,
        currentValue: kr.current_value,
        unit: kr.unit,
        confidence: kr.confidence,
        finalScore: kr.final_score,
        sortOrder: kr.sort_order,
      })),
  }));

  return (
    <ReviewClient
      periodName={period.name}
      periodStatus={period.status}
      objectives={objectives}
    />
  );
}
