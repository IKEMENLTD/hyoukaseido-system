// =============================================================================
// 週次チェックインページ - Server Component
// OKR Key Resultsの取得 + クライアントコンポーネントへの受け渡し
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import { getCurrentMember } from '@/lib/auth/get-member';
import CheckinPageClient from './CheckinPageClient';

interface OkrKeyResultRow {
  id: string;
  title: string;
  current_value: number;
  target_value: number;
  unit: string;
  okr_objectives: {
    member_id: string;
    status: string;
    okr_period_id: string;
  };
}

export default async function CheckinPage() {
  const member = await getCurrentMember();
  if (!member) {
    return (
      <div className="min-h-screen bg-[#050505] p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">メンバー未登録</h2>
          <p className="text-sm text-[#737373]">ログインユーザーにメンバー情報が紐付けられていません。</p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  const { data: keyResultRows } = await supabase
    .from('okr_key_results')
    .select(`
      id, title, current_value, target_value, unit,
      okr_objectives!inner (member_id, status, okr_period_id)
    `)
    .eq('okr_objectives.member_id', member.id)
    .eq('okr_objectives.status', 'active');

  // snake_case → camelCase変換
  const keyResults = ((keyResultRows ?? []) as unknown as OkrKeyResultRow[]).map(
    (row) => ({
      id: row.id,
      title: row.title,
      currentValue: row.current_value,
      targetValue: row.target_value,
      unit: row.unit,
    })
  );

  return <CheckinPageClient keyResults={keyResults} memberId={member.id} />;
}
