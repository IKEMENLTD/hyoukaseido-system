// =============================================================================
// ウィンセッションページ (Server Component)
// 週次ウィンセッションのエントリー投稿と閲覧
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import { getCurrentMember } from '@/lib/auth/get-member';
import WinSessionClient from './WinSessionClient';

interface WinSessionEntry {
  id: string;
  member_id: string;
  win_description: string;
  category: string | null;
  members: { name: string } | null;
  divisions: { name: string } | null;
}

interface WinSessionRow {
  id: string;
  session_date: string;
  facilitator: { name: string } | null;
  win_session_entries: WinSessionEntry[];
}

export default async function WinSessionPage() {
  const member = await getCurrentMember();
  if (!member) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 sm:p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">ログインが必要です</h2>
          <p className="text-sm text-[#737373] mb-4">この機能を利用するにはログインしてください。</p>
          <a
            href="/login"
            className="inline-block px-6 py-2 text-sm font-bold text-[#050505] bg-[#3b82f6] hover:bg-[#2563eb] transition-colors"
          >
            ログインページへ
          </a>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  // メンバーのプライマリ部署を取得
  const { data: primaryDiv, error: primaryDivErr } = await supabase
    .from('division_members')
    .select('division_id')
    .eq('member_id', member.id)
    .eq('is_primary', true)
    .single();
  if (primaryDivErr) console.error('[DB] division_members 取得エラー:', primaryDivErr);

  const memberDivisionId = (primaryDiv?.division_id as string) ?? '';

  // 過去のセッションを取得
  const { data: sessionsRaw, error: sessionsRawErr } = await supabase
    .from('win_sessions')
    .select(`
      id, session_date,
      facilitator:members!win_sessions_facilitator_id_fkey (name),
      win_session_entries (
        id, member_id, win_description, category,
        members (name),
        divisions (name)
      )
    `)
    .order('session_date', { ascending: false })
    .limit(10);
  if (sessionsRawErr) console.error('[DB] win_sessions 取得エラー:', sessionsRawErr);

  // camelCaseに変換
  const sessions = ((sessionsRaw as unknown as WinSessionRow[] | null) ?? []).map((session) => ({
    id: session.id,
    sessionDate: session.session_date,
    facilitator: session.facilitator?.name ?? '未設定',
    entries: (session.win_session_entries ?? []).map((entry) => ({
      id: entry.id,
      entryMemberId: entry.member_id,
      memberName: entry.members?.name ?? '不明',
      divisionName: entry.divisions?.name ?? '不明',
      winDescription: entry.win_description,
      category: entry.category,
    })),
  }));

  return (
    <WinSessionClient
      sessions={sessions}
      memberId={member.id}
      memberDivisionId={memberDivisionId}
      orgId={member.org_id}
    />
  );
}
