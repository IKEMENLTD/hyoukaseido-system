// =============================================================================
// 個人通知送信の統合ロジック
// OAuth連携済みユーザーに個人DM通知を送信
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { sendSlackDM } from './slack-dm';
import { sendLinePush } from './line-push';
import { sendChatworkDM } from './chatwork-dm';
import type {
  NotificationPayload,
  PersonalNotificationResult,
  OAuthAccountLinkRow,
  NotificationPreferenceRow,
} from './types';

/** プロバイダー名と preference カラムの対応 */
const PROVIDER_PREFERENCE_MAP: Record<
  OAuthAccountLinkRow['provider'],
  keyof Pick<NotificationPreferenceRow, 'slack_enabled' | 'line_enabled' | 'chatwork_enabled'>
> = {
  slack: 'slack_enabled',
  line: 'line_enabled',
  chatwork: 'chatwork_enabled',
};

/**
 * 指定メンバーに個人DM通知を送信する
 *
 * 処理フロー:
 * 1. oauth_account_links からメンバーの連携情報を取得
 * 2. notification_preferences からメンバーの通知設定を取得
 * 3. 各プロバイダーについて、連携済み AND 有効 ならDM送信
 * 4. Promise.allSettled で並列送信
 *
 * @param memberId 対象メンバーID
 * @param payload 通知ペイロード
 * @param supabaseClient 外部から注入するSupabaseクライアント（省略時はservice role）
 */
export async function sendPersonalNotification(
  memberId: string,
  payload: NotificationPayload,
  supabaseClient?: SupabaseClient
): Promise<PersonalNotificationResult[]> {
  try {
    const supabase = supabaseClient ?? createServiceRoleClient();

    // 1. OAuth連携情報を取得
    const { data: links, error: linksError } = await supabase
      .from('oauth_account_links')
      .select(
        'id, member_id, provider, provider_user_id, provider_display_name, provider_team_id, dm_room_id, access_token_encrypted, refresh_token_encrypted, token_expires_at'
      )
      .eq('member_id', memberId);

    if (linksError) {
      console.warn(`個人通知: OAuth連携情報の取得に失敗 (member_id=${memberId}):`, linksError.message);
      return [];
    }

    if (!links || links.length === 0) {
      return [];
    }

    const accountLinks = links as unknown as OAuthAccountLinkRow[];

    // 2. 通知設定を取得
    const { data: prefData } = await supabase
      .from('notification_preferences')
      .select('member_id, slack_enabled, line_enabled, chatwork_enabled')
      .eq('member_id', memberId)
      .single();

    // 設定がない場合はデフォルトで全て有効とみなす
    const preferences: NotificationPreferenceRow = prefData
      ? (prefData as unknown as NotificationPreferenceRow)
      : {
          member_id: memberId,
          slack_enabled: true,
          line_enabled: true,
          chatwork_enabled: true,
        };

    // 3. 有効なプロバイダーのみ送信
    const sendPromises: Promise<PersonalNotificationResult>[] = [];

    for (const link of accountLinks) {
      const prefKey = PROVIDER_PREFERENCE_MAP[link.provider];
      if (!preferences[prefKey]) {
        continue;
      }

      switch (link.provider) {
        case 'slack':
          sendPromises.push(sendSlackDM(link.provider_user_id, payload));
          break;
        case 'line':
          sendPromises.push(sendLinePush(link.provider_user_id, payload));
          break;
        case 'chatwork':
          sendPromises.push(sendChatworkDM(link, payload));
          break;
      }
    }

    if (sendPromises.length === 0) {
      return [];
    }

    // 4. 並列送信
    const settled = await Promise.allSettled(sendPromises);

    return settled.map((result) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        channel_id: 'unknown',
        success: false,
        error: result.reason instanceof Error ? result.reason.message : 'Promise rejected',
      };
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn(`個人通知送信エラー (member_id=${memberId}):`, message);
    return [];
  }
}

/**
 * 複数メンバーに個人DM通知を送信する
 *
 * @param memberIds 対象メンバーIDの配列
 * @param payload 通知ペイロード
 * @param supabaseClient 外部から注入するSupabaseクライアント
 */
export async function sendPersonalNotificationToMembers(
  memberIds: string[],
  payload: NotificationPayload,
  supabaseClient?: SupabaseClient
): Promise<PersonalNotificationResult[]> {
  if (memberIds.length === 0) {
    return [];
  }

  const supabase = supabaseClient ?? createServiceRoleClient();

  const settled = await Promise.allSettled(
    memberIds.map((id) => sendPersonalNotification(id, payload, supabase))
  );

  const allResults: PersonalNotificationResult[] = [];
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      allResults.push(...result.value);
    }
  }

  return allResults;
}
