// =============================================================================
// ChatWork DM送信 (個人通知用)
// ChatWork APIを使用してユーザーにダイレクトメッセージを送信
// =============================================================================

import type { NotificationPayload, PersonalNotificationResult, OAuthAccountLinkRow } from './types';
import { decryptToken } from '@/lib/crypto/token-encryption';
import { refreshChatworkToken } from '@/lib/oauth/token-refresh';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

/** 送信タイムアウト (ms) */
const CHATWORK_DM_TIMEOUT_MS = 10000;

/** トークン期限切れ判定の余裕 (ms) - 5分前にリフレッシュ */
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

/** ChatWork DM用ルーム作成レスポンス */
interface ChatworkCreateRoomResponse {
  room_id: number;
}

/**
 * ChatWork APIでDMルームを作成/取得する
 * dm_room_idがDBに保存されていない場合に使用
 */
async function getOrCreateDmRoom(
  link: OAuthAccountLinkRow,
  accessToken: string
): Promise<{ roomId: string; error?: string }> {
  // dm_room_idがキャッシュ済みならそれを使用
  if (link.dm_room_id) {
    return { roomId: link.dm_room_id };
  }

  try {
    // ChatWork API: ダイレクトメッセージルームを作成
    const response = await fetch('https://api.chatwork.com/v2/rooms', {
      method: 'POST',
      headers: {
        'X-ChatWorkToken': accessToken,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        description: '',
        icon_preset: 'meeting',
        members_admin_ids: link.provider_user_id,
        name: 'DM',
      }).toString(),
      signal: AbortSignal.timeout(CHATWORK_DM_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { roomId: '', error: `Room creation failed: HTTP ${response.status}: ${errorText}` };
    }

    const data = (await response.json()) as ChatworkCreateRoomResponse;
    const roomId = String(data.room_id);

    // dm_room_idをDBにキャッシュ
    const supabase = createServiceRoleClient();
    await supabase
      .from('oauth_account_links')
      .update({ dm_room_id: roomId })
      .eq('id', link.id);

    return { roomId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { roomId: '', error: `Room creation error: ${message}` };
  }
}

/**
 * トークンが期限切れか判定し、必要ならリフレッシュする
 */
async function ensureValidToken(
  link: OAuthAccountLinkRow
): Promise<{ accessToken: string | null; error?: string }> {
  if (!link.access_token_encrypted) {
    return { accessToken: null, error: 'No access token stored' };
  }

  // トークン期限チェック
  const isExpired =
    link.token_expires_at &&
    new Date(link.token_expires_at).getTime() < Date.now() + TOKEN_EXPIRY_BUFFER_MS;

  if (isExpired) {
    if (!link.refresh_token_encrypted) {
      return { accessToken: null, error: 'Token expired and no refresh token available' };
    }

    const refreshResult = await refreshChatworkToken(link.id, link.refresh_token_encrypted);
    if (!refreshResult.success || !refreshResult.accessToken) {
      return { accessToken: null, error: refreshResult.error ?? 'Token refresh failed' };
    }

    return { accessToken: refreshResult.accessToken };
  }

  // トークンが有効ならば復号して返す
  try {
    const accessToken = decryptToken(link.access_token_encrypted);
    return { accessToken };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { accessToken: null, error: `Token decryption failed: ${message}` };
  }
}

/**
 * ChatWork APIでユーザーにDMを送信
 *
 * @param link OAuthアカウント連携情報（トークン情報含む）
 * @param payload 通知ペイロード
 */
export async function sendChatworkDM(
  link: OAuthAccountLinkRow,
  payload: NotificationPayload
): Promise<PersonalNotificationResult> {
  const channelId = `chatwork_dm:${link.provider_user_id}`;

  try {
    // トークン取得（必要ならリフレッシュ）
    const { accessToken, error: tokenError } = await ensureValidToken(link);
    if (!accessToken) {
      return { channel_id: channelId, success: false, error: tokenError };
    }

    // DMルーム取得/作成
    const { roomId, error: roomError } = await getOrCreateDmRoom(link, accessToken);
    if (!roomId) {
      return { channel_id: channelId, success: false, error: roomError };
    }

    // メッセージ送信
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const resolvedUrl = payload.url
      ? (payload.url.startsWith('http') ? payload.url : `${appUrl}${payload.url}`)
      : '';
    const urlSuffix = resolvedUrl ? `\n${resolvedUrl}` : '';
    // ChatWorkタグインジェクション対策
    const escCw = (t: string) => t.replace(/\[/g, '［').replace(/\]/g, '］');
    const body = `[info][title]${escCw(payload.title)}[/title]${escCw(payload.message)}${urlSuffix}[/info]`;

    const response = await fetch(
      `https://api.chatwork.com/v2/rooms/${roomId}/messages`,
      {
        method: 'POST',
        headers: {
          'X-ChatWorkToken': accessToken,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ body }).toString(),
        signal: AbortSignal.timeout(CHATWORK_DM_TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        channel_id: channelId,
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    return { channel_id: channelId, success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { channel_id: channelId, success: false, error: message };
  }
}
