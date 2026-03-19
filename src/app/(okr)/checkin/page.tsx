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

interface CheckinRow {
  key_result_id: string;
  checkin_date: string;
  value: number;
  confidence: number;
}

interface CheckinHistoryEntry {
  date: string;
  value: number;
  confidence: number;
}

interface CheckinHistory {
  [keyResultId: string]: CheckinHistoryEntry[];
}

export default async function CheckinPage() {
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

  const { data: keyResultRows, error: keyResultRowsErr } = await supabase
    .from('okr_key_results')
    .select(`
      id, title, current_value, target_value, unit,
      okr_objectives!inner (member_id, status, okr_period_id)
    `)
    .eq('okr_objectives.member_id', member.id)
    .eq('okr_objectives.status', 'active');
  if (keyResultRowsErr) console.error('[DB] okr_key_results 取得エラー:', keyResultRowsErr);

  // snake_case → camelCase変換
  const typedRows = (keyResultRows ?? []) as unknown as OkrKeyResultRow[];
  const keyResults = typedRows.map((row) => ({
    id: row.id,
    title: row.title,
    currentValue: row.current_value,
    targetValue: row.target_value,
    unit: row.unit,
  }));

  // 各KRの直近5件のチェックイン履歴を取得
  const krIds = typedRows.map((row) => row.id);
  const checkinHistory: CheckinHistory = {};

  if (krIds.length > 0) {
    const { data: checkinRows, error: checkinErr } = await supabase
      .from('okr_checkins')
      .select('key_result_id, checkin_date, value, confidence')
      .in('key_result_id', krIds)
      .order('checkin_date', { ascending: false });

    if (checkinErr) {
      console.error('[DB] okr_checkins 取得エラー:', checkinErr);
    }

    // KRごとにグループ化し、直近5件に制限
    for (const row of (checkinRows ?? []) as unknown as CheckinRow[]) {
      if (!checkinHistory[row.key_result_id]) {
        checkinHistory[row.key_result_id] = [];
      }
      if (checkinHistory[row.key_result_id].length < 5) {
        checkinHistory[row.key_result_id].push({
          date: row.checkin_date,
          value: row.value,
          confidence: row.confidence,
        });
      }
    }

    // 日付昇順に並べ替え（推移表示用: 古い順 → 新しい順）
    for (const krId of Object.keys(checkinHistory)) {
      checkinHistory[krId].reverse();
    }
  }

  return (
    <CheckinPageClient
      keyResults={keyResults}
      memberId={member.id}
      checkinHistory={checkinHistory}
    />
  );
}
