// =============================================================================
// 通知送信コア (Server-side専用)
// fetch APIでwebhookに送信する
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import type {
  NotificationPayload,
  NotificationChannel,
  NotificationChannelRow,
  NotificationResult,
} from './types';

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

/**
 * ChatWork Webhook用のペイロードを構築
 */
function buildChatworkPayload(payload: NotificationPayload): Record<string, unknown> {
  const urlSuffix = payload.url ? `\n${payload.url}` : '';
  return {
    body: `[info][title]${payload.title}[/title]${payload.message}${urlSuffix}[/info]`,
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
    const response = await fetch(channel.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        channelId: channel.id,
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
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
 */
export async function sendNotification(
  orgId: string,
  payload: NotificationPayload
): Promise<NotificationResult[]> {
  const supabase = await createClient();

  // このイベントを購読しているアクティブチャンネルを取得
  const { data: channels } = await supabase
    .from('notification_channels')
    .select('id, type, webhook_url, events')
    .eq('org_id', orgId)
    .eq('is_active', true);

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

  return notificationResults;
}
