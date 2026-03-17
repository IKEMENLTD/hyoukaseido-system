// =============================================================================
// Slack DM送信 (個人通知用)
// Bot Tokenを使用してユーザーに直接DMを送信
// =============================================================================

import type { NotificationPayload, PersonalNotificationResult } from './types';

/** Slack API chat.postMessage のレスポンス型 */
interface SlackPostMessageResponse {
  ok: boolean;
  error?: string;
}

/** 送信タイムアウト (ms) */
const SLACK_DM_TIMEOUT_MS = 10000;

/**
 * Slack Bot Token を使用してユーザーにDMを送信
 *
 * @param slackUserId SlackのユーザーID (provider_user_id)
 * @param payload 通知ペイロード
 */
export async function sendSlackDM(
  slackUserId: string,
  payload: NotificationPayload
): Promise<PersonalNotificationResult> {
  const botToken = process.env.SLACK_BOT_TOKEN;
  if (!botToken) {
    return {
      channel_id: `slack_dm:${slackUserId}`,
      success: false,
      error: 'SLACK_BOT_TOKEN not configured',
    };
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
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
      const url = payload.url.startsWith('http') ? payload.url : `${appUrl}${payload.url}`;
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '詳細を見る' },
            url,
          },
        ],
      });
    }

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: slackUserId,
        text: `${payload.title}\n${payload.message}`,
        blocks,
      }),
      signal: AbortSignal.timeout(SLACK_DM_TIMEOUT_MS),
    });

    const data = (await response.json()) as SlackPostMessageResponse;

    return {
      channel_id: `slack_dm:${slackUserId}`,
      success: data.ok,
      error: data.ok ? undefined : (data.error ?? 'Unknown Slack error'),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      channel_id: `slack_dm:${slackUserId}`,
      success: false,
      error: message,
    };
  }
}
