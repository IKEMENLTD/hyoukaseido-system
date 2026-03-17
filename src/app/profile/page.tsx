// =============================================================================
// A-07 プロフィール設定ページ
// ユーザー自身の情報閲覧・通知設定
// 全ユーザーアクセス可能
// =============================================================================

import type { Grade } from '@/types/evaluation';
import { getCurrentMember } from '@/lib/auth/get-member';
import { createClient } from '@/lib/supabase/server';
import ProfileClient from './ProfileClient';

interface DivisionJoinRow {
  divisions: { name: string } | null;
}

interface OAuthLinkRow {
  provider: 'slack' | 'line' | 'chatwork';
  provider_display_name: string | null;
  linked_at: string;
}

export default async function ProfilePage() {
  const member = await getCurrentMember();
  if (!member) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 sm:p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">ログインが必要です</h2>
          <p className="text-sm text-[#737373]">この機能を利用するにはログインしてください。</p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  const [authResult, divResult, notifResult, oauthResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('division_members')
      .select('divisions (name)')
      .eq('member_id', member.id)
      .eq('is_primary', true)
      .single(),
    supabase
      .from('notification_preferences')
      .select('line_enabled, slack_enabled, chatwork_enabled')
      .eq('member_id', member.id)
      .maybeSingle(),
    supabase
      .from('oauth_account_links')
      .select('provider, provider_display_name, linked_at')
      .eq('member_id', member.id),
  ]);

  const divRow = divResult.data as unknown as DivisionJoinRow | null;
  const oauthRows = (oauthResult.data ?? []) as OAuthLinkRow[];

  const linkedAccounts = oauthRows.map((row) => ({
    provider: row.provider,
    providerDisplayName: row.provider_display_name,
    linkedAt: row.linked_at,
  }));

  const profile = {
    name: member.name,
    email: authResult.data.user?.email ?? '',
    division: divRow?.divisions?.name ?? '未設定',
    grade: member.grade as Grade,
  };

  return (
    <ProfileClient
      profile={profile}
      memberId={member.id}
      notificationSettings={{
        lineEnabled: notifResult.data?.line_enabled ?? false,
        slackEnabled: notifResult.data?.slack_enabled ?? true,
        chatworkEnabled: notifResult.data?.chatwork_enabled ?? false,
      }}
      linkedAccounts={linkedAccounts}
    />
  );
}
