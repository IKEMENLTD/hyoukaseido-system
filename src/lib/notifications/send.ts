// =============================================================================
// 通知送信コア (Server-side専用)
// fetch APIでwebhookに送信する
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  NotificationPayload,
  NotificationChannel,
  NotificationChannelRow,
  NotificationResult,
} from './types';
import { sendPersonalNotificationToMembers } from './personal-send';

/** 通知送信のタイムアウト (ms) */
const SEND_TIMEOUT_MS = 10000;

/**
 * Slack Webhook用のペイロードを構築
 */
function buildSlackPayload(payload: NotificationPayload): Record<string, unknown> {
  const blocks: Record<string, unknown>[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${payload.title}*\n${payload.message}`,
      },
    },
  ];

  if (payload.url) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '詳細を確認' },
          url: payload.url,
        },
      ],
    });
  }

  return {
    text: `*${payload.title}*\n${payload.message}`,
    blocks,
  };
}

/**
 * LINE Webhook用のペイロードを構築
 */
function buildLinePayload(payload: NotificationPayload): Record<string, unknown> {
  const urlSuffix = payload.url ? `\n\n${payload.url}` : '';
  return {
    messages: [
      {
        type: 'text',
        text: `${payload.title}\n\n${payload.message}${urlSuffix}`,
      },
    ],
  };
}

/** ChatWorkタグインジェクション対策: [ ] をエスケープ */
function escapeChatwork(text: string): string {
  return text.replace(/\[/g, '［').replace(/\]/g, '］');
}

/**
 * ChatWork Webhook用のペイロードを構築
 */
function buildChatworkPayload(payload: NotificationPayload): Record<string, unknown> {
  const urlSuffix = payload.url ? `\n${payload.url}` : '';
  return {
    body: `[info][title]${escapeChatwork(payload.title)}[/title]${escapeChatwork(payload.message)}${urlSuffix}[/info]`,
  };
}

/**
 * 単一チャンネルに通知送信
 */
async function sendToChannel(
  channel: NotificationChannel,
  payload: NotificationPayload
): Promise<NotificationResult> {
  const body =
    channel.type === 'slack'
      ? buildSlackPayload(payload)
      : channel.type === 'chatwork'
        ? buildChatworkPayload(payload)
        : buildLinePayload(payload);

  try {
    // ChatWork/LINEはAPIトークンが必要
    if (channel.type === 'chatwork' && !channel.apiToken) {
      return { channelId: channel.id, success: false, error: 'ChatWork APIトークンが未設定です' };
    }
    if (channel.type === 'line' && !channel.apiToken) {
      return { channelId: channel.id, success: false, error: 'LINE チャネルアクセストークンが未設定です' };
    }

    const headers: Record<string, string> =
      channel.type === 'chatwork'
        ? {
            'X-ChatWorkToken': channel.apiToken ?? '',
            'Content-Type': 'application/x-www-form-urlencoded',
          }
        : channel.type === 'line'
          ? {
              'Authorization': `Bearer ${channel.apiToken ?? ''}`,
              'Content-Type': 'application/json',
            }
          : { 'Content-Type': 'application/json' };

    const requestBody =
      channel.type === 'chatwork'
        ? new URLSearchParams({ body: (body as { body: string }).body }).toString()
        : JSON.stringify(body);

    const response = await fetch(channel.webhookUrl, {
      method: 'POST',
      headers,
      body: requestBody,
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(`[通知] Webhook送信エラー: HTTP ${response.status}: ${response.statusText}`);
      return {
        channelId: channel.id,
        success: false,
        error: '送信に失敗しました',
      };
    }

    return { channelId: channel.id, success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { channelId: channel.id, success: false, error: message };
  }
}

/**
 * 通知送信メイン関数
 * 指定イベントに登録されたアクティブな全チャンネルに送信
 * targetMemberIdsが指定された場合は、個人DM通知も送信（fire-and-forget ではなく結果を返す）
 *
 * @param orgId 組織ID
 * @param payload 通知ペイロード
 * @param externalClient 外部から注入するSupabaseクライアント（Cronジョブ等でcookies不要な場合）
 * @param targetMemberIds 個人通知の対象メンバーID（省略時は個人通知なし）
 */
export async function sendNotification(
  orgId: string,
  payload: NotificationPayload,
  externalClient?: SupabaseClient,
  targetMemberIds?: string[]
): Promise<NotificationResult[]> {
  const supabase = externalClient ?? await createClient();

  // このイベントを購読しているアクティブチャンネルを取得
  const { data: channels, error: channelsErr } = await supabase
    .from('notification_channels')
    .select('id, type, webhook_url, api_token, events')
    .eq('org_id', orgId)
    .eq('is_active', true);
  if (channelsErr) console.error('[DB] notification_channels 取得エラー:', channelsErr);

  if (!channels || channels.length === 0) return [];

  // eventsにpayload.eventが含まれるチャンネルをフィルタ
  const rows = channels as unknown as NotificationChannelRow[];

  // 通知個人設定: 組織全体で各チャンネルタイプが有効かチェック
  // (notification_preferencesでslack/lineを無効にしているメンバーが多数の場合、
  //  チャンネルタイプ自体をスキップすることは現時点では行わない。
  //  個人設定は将来的にメンバー単位通知で活用する想定)
  const targetChannels: NotificationChannel[] = rows
    .filter((ch) => Array.isArray(ch.events) && ch.events.includes(payload.event))
    .map((ch) => ({
      id: ch.id,
      type: ch.type,
      webhookUrl: ch.webhook_url,
      apiToken: ch.api_token,
      events: ch.events,
    }));

  if (targetChannels.length === 0) return [];

  // 全チャンネルに並列送信
  const results = await Promise.allSettled(
    targetChannels.map((ch) => sendToChannel(ch, payload))
  );

  const notificationResults: NotificationResult[] = results.map((r) =>
    r.status === 'fulfilled'
      ? r.value
      : { channelId: 'unknown', success: false, error: 'Promise rejected' }
  );

  // 送信成功したチャンネルのlast_sent_atを更新
  const successIds = notificationResults
    .filter((r) => r.success)
    .map((r) => r.channelId);

  if (successIds.length > 0) {
    await supabase
      .from('notification_channels')
      .update({ last_sent_at: new Date().toISOString() })
      .in('id', successIds);
  }

  // 個人DM通知: targetMemberIdsが指定された場合のみ送信
  // fire-and-forget: 個人通知の失敗がメイン処理をブロックしない
  if (targetMemberIds && targetMemberIds.length > 0) {
    sendPersonalNotificationToMembers(targetMemberIds, payload, supabase).catch(
      (err: unknown) => {
        console.warn(
          '個人DM通知の送信中にエラー:',
          err instanceof Error ? err.message : err
        );
      }
    );
  }

  return notificationResults;
}
