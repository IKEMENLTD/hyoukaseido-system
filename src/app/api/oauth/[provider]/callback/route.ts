// =============================================================================
// OAuth Callback Route
// GET /api/oauth/[provider]/callback
// 認可コード -> トークン交換 -> プロフィール取得 -> DB保存 -> リダイレクト
// =============================================================================

import { NextResponse } from 'next/server';
import { isValidProvider, exchangeCode, getProviderProfile } from '@/lib/oauth/providers';
import type { OAuthProvider } from '@/lib/oauth/providers';
import { verifyOAuthState } from '@/lib/oauth/state';
import { encryptToken } from '@/lib/crypto/token-encryption';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/** oauth_account_links upsert 用の型 */
interface OAuthLinkUpsertData {
  member_id: string;
  provider: string;
  provider_user_id: string;
  provider_display_name: string;
  provider_team_id: string | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  updated_at: string;
}

/**
 * プロバイダーごとに保存するデータを構築する。
 * - Slack: provider_user_id, provider_display_name, provider_team_id
 * - LINE: provider_user_id, provider_display_name
 * - ChatWork: provider_user_id, provider_display_name + 暗号化トークン
 */
function buildUpsertData(
  memberId: string,
  provider: OAuthProvider,
  profile: { userId: string; displayName: string; teamId?: string },
  tokens: { accessToken: string; refreshToken: string | null; expiresIn: number | null }
): OAuthLinkUpsertData {
  const base: OAuthLinkUpsertData = {
    member_id: memberId,
    provider,
    provider_user_id: profile.userId,
    provider_display_name: profile.displayName,
    provider_team_id: profile.teamId ?? null,
    access_token_encrypted: null,
    refresh_token_encrypted: null,
    token_expires_at: null,
    updated_at: new Date().toISOString(),
  };

  // ChatWorkのみトークンを暗号化して保存 (API呼び出しに必要)
  if (provider === 'chatwork') {
    base.access_token_encrypted = encryptToken(tokens.accessToken);
    if (tokens.refreshToken) {
      base.refresh_token_encrypted = encryptToken(tokens.refreshToken);
    }
    if (tokens.expiresIn) {
      base.token_expires_at = new Date(
        Date.now() + tokens.expiresIn * 1000
      ).toISOString();
    }
  }

  return base;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    const { searchParams } = new URL(request.url);

    // プロバイダーバリデーション
    if (!isValidProvider(provider)) {
      return NextResponse.redirect(
        `${APP_URL}/profile?error=invalid_provider`
      );
    }

    // エラーレスポンスチェック (ユーザーが認可を拒否した場合など)
    const errorParam = searchParams.get('error');
    if (errorParam) {
      console.error(`OAuth callback error from ${provider}:`, errorParam);
      return NextResponse.redirect(
        `${APP_URL}/profile?error=oauth_denied`
      );
    }

    // code と state を取得
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      return NextResponse.redirect(
        `${APP_URL}/profile?error=missing_params`
      );
    }

    // state を検証 (CSRF + 有効期限 + HMAC)
    const verified = verifyOAuthState(state);
    if (!verified) {
      return NextResponse.redirect(
        `${APP_URL}/profile?error=invalid_state`
      );
    }

    // provider の一致チェック
    if (verified.provider !== provider) {
      return NextResponse.redirect(
        `${APP_URL}/profile?error=provider_mismatch`
      );
    }

    // 認可コードをトークンに交換 (PKCE code_verifier 付き)
    const tokens = await exchangeCode(provider, code, verified.codeVerifier);

    // プロバイダーからユーザープロフィールを取得
    const profile = await getProviderProfile(provider, tokens.accessToken);

    // oauth_account_links に upsert (service role で RLS バイパス)
    const serviceClient = createServiceRoleClient();
    const upsertData = buildUpsertData(
      verified.memberId,
      provider,
      profile,
      tokens
    );

    const { error: upsertError } = await serviceClient
      .from('oauth_account_links')
      .upsert(upsertData, { onConflict: 'member_id,provider' });

    if (upsertError) {
      console.error('OAuth link upsert error:', upsertError.message);
      return NextResponse.redirect(
        `${APP_URL}/profile?error=link_failed`
      );
    }

    // 成功 -> プロフィールページにリダイレクト
    return NextResponse.redirect(
      `${APP_URL}/profile?linked=${provider}`
    );
  } catch (err: unknown) {
    console.error(
      'OAuth callback error:',
      err instanceof Error ? err.message : err
    );
    return NextResponse.redirect(
      `${APP_URL}/profile?error=callback_failed`
    );
  }
}
