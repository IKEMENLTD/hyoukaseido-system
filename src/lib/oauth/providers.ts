// =============================================================================
// OAuth Provider Configuration
// Slack / LINE / ChatWork の OAuth設定・トークン交換・プロフィール取得
// =============================================================================

/** サポートするOAuthプロバイダー */
export type OAuthProvider = 'slack' | 'line' | 'chatwork';

/** トークン交換レスポンス */
export interface TokenResponse {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
}

/** プロバイダーから取得するプロフィール */
export interface ProviderProfile {
  userId: string;
  displayName: string;
  teamId?: string;
}

/** プロバイダー設定 */
interface ProviderConfig {
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  supportsPkce: boolean;
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

function getProviderConfig(provider: OAuthProvider): ProviderConfig {
  switch (provider) {
    case 'slack':
      return {
        authorizationUrl: 'https://slack.com/oauth/v2/authorize',
        tokenUrl: 'https://slack.com/api/oauth.v2.access',
        scopes: 'identity.basic,identity.email',
        clientId: process.env.SLACK_CLIENT_ID || '',
        clientSecret: process.env.SLACK_CLIENT_SECRET || '',
        redirectUri: `${BASE_URL}/api/oauth/slack/callback`,
        supportsPkce: false,
      };
    case 'line':
      return {
        authorizationUrl: 'https://access.line.me/oauth2/v2.1/authorize',
        tokenUrl: 'https://api.line.me/oauth2/v2.1/token',
        scopes: 'profile openid',
        clientId: process.env.LINE_CLIENT_ID || '',
        clientSecret: process.env.LINE_CLIENT_SECRET || '',
        redirectUri: `${BASE_URL}/api/oauth/line/callback`,
        supportsPkce: true,
      };
    case 'chatwork':
      return {
        authorizationUrl: 'https://www.chatwork.com/packages/oauth2/login.php',
        tokenUrl: 'https://oauth.chatwork.com/token',
        scopes: 'users.all:read rooms.all:read_write',
        clientId: process.env.CHATWORK_CLIENT_ID || '',
        clientSecret: process.env.CHATWORK_CLIENT_SECRET || '',
        redirectUri: `${BASE_URL}/api/oauth/chatwork/callback`,
        supportsPkce: true,
      };
  }
}

/**
 * OAuthプロバイダーの認証URLを構築する
 */
export function getAuthorizationUrl(
  provider: OAuthProvider,
  state: string,
  codeChallenge: string
): string {
  const config = getProviderConfig(provider);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes,
    state,
  });

  if (config.supportsPkce) {
    params.set('code_challenge', codeChallenge);
    params.set('code_challenge_method', 'S256');
  }

  // Slack Sign in with Slack は user_scope を使う
  if (provider === 'slack') {
    params.set('user_scope', config.scopes);
    params.delete('scope');
  }

  return `${config.authorizationUrl}?${params.toString()}`;
}

/** fetch レスポンスの JSON 型 */
interface SlackTokenPayload {
  ok: boolean;
  authed_user?: { access_token?: string };
  error?: string;
}

interface StandardTokenPayload {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

/**
 * 認可コードをアクセストークンに交換する
 */
export async function exchangeCode(
  provider: OAuthProvider,
  code: string,
  codeVerifier: string
): Promise<TokenResponse> {
  const config = getProviderConfig(provider);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  if (config.supportsPkce) {
    body.set('code_verifier', codeVerifier);
  }

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
  }

  if (provider === 'slack') {
    const data = (await response.json()) as SlackTokenPayload;
    if (!data.ok || !data.authed_user?.access_token) {
      throw new Error(`Slack token exchange failed: ${data.error || 'unknown error'}`);
    }
    return {
      accessToken: data.authed_user.access_token,
      refreshToken: null,
      expiresIn: null,
    };
  }

  const data = (await response.json()) as StandardTokenPayload;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresIn: data.expires_in ?? null,
  };
}

/** Slack identity API レスポンス */
interface SlackIdentityResponse {
  ok: boolean;
  user?: { id?: string; name?: string };
  team?: { id?: string };
}

/** LINE profile API レスポンス */
interface LineProfileResponse {
  userId: string;
  displayName: string;
}

/** ChatWork me API レスポンス */
interface ChatWorkMeResponse {
  account_id: number;
  name: string;
}

/**
 * アクセストークンを使ってプロバイダーからユーザープロフィールを取得する
 */
export async function getProviderProfile(
  provider: OAuthProvider,
  accessToken: string
): Promise<ProviderProfile> {
  switch (provider) {
    case 'slack': {
      const res = await fetch('https://slack.com/api/users.identity', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = (await res.json()) as SlackIdentityResponse;
      if (!data.ok || !data.user?.id) {
        throw new Error('Failed to fetch Slack profile');
      }
      return {
        userId: data.user.id,
        displayName: data.user.name || '',
        teamId: data.team?.id,
      };
    }
    case 'line': {
      const res = await fetch('https://api.line.me/v2/profile', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Failed to fetch LINE profile');
      const data = (await res.json()) as LineProfileResponse;
      return {
        userId: data.userId,
        displayName: data.displayName,
      };
    }
    case 'chatwork': {
      const res = await fetch('https://api.chatwork.com/v2/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Failed to fetch ChatWork profile');
      const data = (await res.json()) as ChatWorkMeResponse;
      return {
        userId: String(data.account_id),
        displayName: data.name,
      };
    }
  }
}

/**
 * プロバイダー名のバリデーション
 */
export function isValidProvider(value: string): value is OAuthProvider {
  return value === 'slack' || value === 'line' || value === 'chatwork';
}
