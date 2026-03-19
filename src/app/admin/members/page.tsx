// =============================================================================
// メンバー管理ページ (管理者) - Server Component
// 初期データをSupabaseから取得し、クライアントコンポーネントに渡す
// =============================================================================

import type { Grade, MemberStatus } from '@/types/evaluation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMember } from '@/lib/auth/get-member';
import MemberManager from './MemberManager';

// ---------------------------------------------------------------------------
// Supabase返却型 (any禁止)
// ---------------------------------------------------------------------------

interface DivisionMemberRow {
  division_id: string;
  role: string;
  is_primary: boolean;
  is_head: boolean;
  divisions: { name: string } | null;
}

interface MemberRow {
  id: string;
  name: string;
  email: string | null;
  auth_user_id: string | null;
  grade: Grade;
  monthly_salary: number;
  status: MemberStatus;
  hire_date: string | null;
  created_at: string;
  division_members: DivisionMemberRow[];
}

interface DivisionOption {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// ページコンポーネント (Server Component)
// ---------------------------------------------------------------------------

export default async function AdminMembersPage() {
  const member = await getCurrentMember();
  if (!member || !['G4', 'G5'].includes(member.grade)) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 sm:p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">アクセス権限がありません</h2>
          <p className="text-sm text-[#737373]">
            管理機能はG4以上の等級のメンバーのみ利用できます。
          </p>
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

  // メンバー一覧取得
  const { data: members, error: membersError } = await supabase
    .from('members')
    .select('*, division_members(division_id, role, is_primary, is_head, divisions(name))')
    .order('name');

  // 事業部一覧取得
  const { data: divisions } = await supabase
    .from('divisions')
    .select('id, name')
    .order('name');

  // org_id取得 (最初の組織)
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id')
    .limit(1)
    .single();

  const memberList: MemberRow[] = (members as MemberRow[] | null) ?? [];
  const divisionList: DivisionOption[] = (divisions as DivisionOption[] | null) ?? [];
  const orgId: string = orgs?.id ?? '';

  // データ取得エラー時のフォールバック
  if (membersError) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider mb-4">
            メンバー管理
          </h1>
          <div className="border border-red-900 bg-red-950/30 px-4 py-3 text-xs text-red-400">
            データの取得に失敗しました: {membersError.message}
          </div>
        </div>
      </div>
    );
  }

  return (
    <MemberManager
      initialMembers={memberList}
      divisions={divisionList}
      orgId={orgId}
    />
  );
}
