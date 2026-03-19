// =============================================================================
// 新規1on1記録ページ (Server Component)
// 面談対象メンバー一覧をSupabaseから取得し、Client Componentに渡す
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import { getCurrentMember } from '@/lib/auth/get-member';
import OneOnOneNewClient from './OneOnOneNewClient';

interface DivisionMemberRow {
  division_id: string;
}

interface MemberNestedRow {
  members: { id: string; name: string } | null;
}

export default async function NewOneOnOnePage() {
  const member = await getCurrentMember();
  if (!member || !['G3', 'G4', 'G5'].includes(member.grade)) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 sm:p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">アクセス権限がありません</h2>
          <p className="text-sm text-[#737373]">1on1記録の登録はG3以上の等級のメンバーのみ利用可能です。</p>
          <a
            href="/dashboard"
            className="mt-4 inline-block px-4 py-2 border border-[#333333] text-xs text-[#a3a3a3] hover:border-[#e5e5e5] hover:text-[#e5e5e5]"
          >
            ダッシュボードへ戻る
          </a>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  // 自分の所属部門を取得
  const { data: myDivisions } = await supabase
    .from('division_members')
    .select('division_id')
    .eq('member_id', member.id);

  const divisionIds = (myDivisions as DivisionMemberRow[] | null ?? []).map(
    (d) => d.division_id,
  );

  // 自分の部門のメンバーを取得（自分自身を除く）
  let teamMembers: Array<{ id: string; name: string }> = [];

  if (divisionIds.length > 0) {
    const { data: divMembers } = await supabase
      .from('division_members')
      .select('members (id, name)')
      .in('division_id', divisionIds)
      .neq('member_id', member.id);

    const rows = divMembers as MemberNestedRow[] | null;
    const seen = new Set<string>();
    teamMembers = (rows ?? []).reduce<Array<{ id: string; name: string }>>(
      (acc, row) => {
        if (row.members && !seen.has(row.members.id)) {
          seen.add(row.members.id);
          acc.push({ id: row.members.id, name: row.members.name });
        }
        return acc;
      },
      [],
    );
  }

  return (
    <OneOnOneNewClient
      managerId={member.id}
      teamMembers={teamMembers}
    />
  );
}
