// =============================================================================
// LINE Push送信 (個人通知用)
// LINE Messaging API を使用してユーザーにPushメッセージを送信
// =============================================================================

import type { NotificationPayload, PersonalNotificationResult } from './types';

/** 送信タイムアウト (ms) */
const LINE_PUSH_TIMEOUT_MS = 10000;

/**
 * LINE Messaging API でユーザーにPushメッセージを送信
 *
 * @param lineUserId LINEのユーザーID (provider_user_id)
 * @param payload 通知ペイロード
 */
export async function sendLinePush(
  lineUserId: string,
  payload: NotificationPayload
): Promise<PersonalNotificationResult> {
  const channelAccessToken = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
  if (!channelAccessToken) {
    return {
      channel_id: `line_dm:${lineUserId}`,
      success: false,
      error: 'LINE_MESSAGING_CHANNEL_ACCESS_TOKEN not configured',
    };
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const resolvedUrl = payload.url
      ? (payload.url.startsWith('http') ? payload.url : `${appUrl}${payload.url}`)
      : '';
    const urlSuffix = resolvedUrl ? `\n\n${resolvedUrl}` : '';
    const textContent = `${payload.title}\n\n${payload.message}${urlSuffix}`;

    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${channelAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [
          {
            type: 'text',
            text: textContent,
          },
        ],
      }),
      signal: AbortSignal.timeout(LINE_PUSH_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        channel_id: `line_dm:${lineUserId}`,
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    return {
      channel_id: `line_dm:${lineUserId}`,
      success: true,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      channel_id: `line_dm:${lineUserId}`,
      success: false,
      error: message,
    };
  }
}
