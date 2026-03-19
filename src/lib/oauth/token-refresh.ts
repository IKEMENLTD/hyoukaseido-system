// =============================================================================
// OAuthトークンリフレッシュ
// ChatWork等のOAuth 2.0トークンをリフレッシュする
// =============================================================================

import { encryptToken, decryptToken } from '@/lib/crypto/token-encryption';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

/** リフレッシュリクエストのタイムアウト (ms) */
const REFRESH_TIMEOUT_MS = 10000;

/** ChatWorkトークンレスポンスの型 */
interface ChatWorkTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

/** リフレッシュ結果 */
export interface TokenRefreshResult {
  success: boolean;
  accessToken?: string;
  error?: string;
}

/**
 * ChatWorkのOAuthトークンをリフレッシュする
 *
 * @param linkId oauth_account_linksテーブルのレコードID
 * @param encryptedRefreshToken 暗号化されたリフレッシュトークン
 * @returns リフレッシュ結果（新しいアクセストークンを含む）
 */
export async function refreshChatworkToken(
  linkId: string,
  encryptedRefreshToken: string
): Promise<TokenRefreshResult> {
  const clientId = process.env.CHATWORK_CLIENT_ID;
  const clientSecret = process.env.CHATWORK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return {
      success: false,
      error: 'CHATWORK_CLIENT_ID or CHATWORK_CLIENT_SECRET not configured',
    };
  }

  try {
    const refreshToken = decryptToken(encryptedRefreshToken);

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch('https://oauth.chatwork.com/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[OAuth] Token refresh error: HTTP ${response.status}: ${errorText}`);
      return {
        success: false,
        error: 'トークンの更新に失敗しました',
      };
    }

    const tokenData = (await response.json()) as ChatWorkTokenResponse;

    // 新しいトークンを暗号化してDB更新
    const newAccessTokenEncrypted = encryptToken(tokenData.access_token);
    const newRefreshTokenEncrypted = encryptToken(tokenData.refresh_token);
    const newExpiresAt = new Date(
      Date.now() + tokenData.expires_in * 1000
    ).toISOString();

    const supabase = createServiceRoleClient();
    const { error: updateError } = await supabase
      .from('oauth_account_links')
      .update({
        access_token_encrypted: newAccessTokenEncrypted,
        refresh_token_encrypted: newRefreshTokenEncrypted,
        token_expires_at: newExpiresAt,
      })
      .eq('id', linkId);

    if (updateError) {
      return {
        success: false,
        error: `DB update failed: ${updateError.message}`,
      };
    }

    return {
      success: true,
      accessToken: tokenData.access_token,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      success: false,
      error: `Token refresh error: ${message}`,
    };
  }
}
