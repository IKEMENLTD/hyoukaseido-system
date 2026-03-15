// =============================================================================
// 通知設定ページ (管理者)
// LINE/Slack/ChatWork通知チャンネルの設定
// =============================================================================

import { getCurrentMember } from '@/lib/auth/get-member';
import { createClient } from '@/lib/supabase/server';
import NotificationChannelManager from './NotificationChannelManager';

interface NotificationChannelRow {
  id: string;
  type: 'slack' | 'line' | 'chatwork';
  channel_name: string;
  webhook_url: string;
  is_active: boolean;
  events: string[];
  last_sent_at: string | null;
}

interface DisplayChannel {
  id: string;
  type: 'slack' | 'line' | 'chatwork';
  channelName: string;
  webhookUrl: string;
  isActive: boolean;
  events: string[];
  lastSentAt: string | null;
}

export default async function AdminNotificationsPage() {
  const member = await getCurrentMember();
  if (!member || !['G4', 'G5'].includes(member.grade)) {
    return (
      <div className="min-h-screen bg-[#050505] p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">アクセス権限がありません</h2>
          <p className="text-sm text-[#737373]">
            管理機能はG4以上の等級のメンバーのみ利用できます。
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: rawChannels } = await supabase
    .from('notification_channels')
    .select('id, type, channel_name, webhook_url, is_active, events, last_sent_at')
    .eq('org_id', member.org_id)
    .order('created_at', { ascending: false });

  const channels: DisplayChannel[] = ((rawChannels ?? []) as unknown as NotificationChannelRow[]).map(
    (row) => ({
      id: row.id,
      type: row.type,
      channelName: row.channel_name,
      webhookUrl: row.webhook_url,
      isActive: row.is_active,
      events: Array.isArray(row.events) ? row.events : [],
      lastSentAt: row.last_sent_at,
    }),
  );

  return (
    <div className="min-h-screen bg-[#050505] p-6">
      <div className="max-w-5xl mx-auto">
        <NotificationChannelManager channels={channels} orgId={member.org_id} />
      </div>
    </div>
  );
}
