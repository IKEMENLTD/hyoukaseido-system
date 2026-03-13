// =============================================================================
// クライアントサイド通知発火ヘルパー
// Client Componentから通知APIを呼び出す (fire-and-forget)
// =============================================================================

import type { NotificationEvent } from './types';

interface FireNotificationParams {
  event: NotificationEvent;
  title: string;
  message: string;
  url?: string;
}

/**
 * クライアントサイドから通知APIを呼び出す (fire-and-forget)
 * 送信失敗してもユーザー操作をブロックしない
 */
export function fireNotification(params: FireNotificationParams): void {
  fetch('/api/notifications/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  }).catch(() => {
    // 通知送信失敗はサイレントに無視
  });
}
