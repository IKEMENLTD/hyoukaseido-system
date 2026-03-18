// =============================================================================
// OAuth State Management (PKCE + CSRF)
// state パラメータに PKCE codeVerifier を埋め込み、DB保存不要にする
// =============================================================================

import crypto from 'crypto';

/**
 * OAuth State 署名用の秘密鍵を取得する。
 * モジュールレベルではthrowしない（OAuth機能を使わないユーザーへの配慮）。
 */
function getStateSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET || process.env.CRON_SECRET;
  if (!secret) {
    throw new Error('OAUTH_STATE_SECRET or CRON_SECRET must be set for OAuth security');
  }
  return secret;
}

/**
 * PKCE code_verifier を生成する (43-128文字のbase64url)
 */
export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * code_verifier から code_challenge (S256) を生成する
 */
export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

/**
 * OAuth state パラメータを生成する。
 * フォーマット: base64url( memberId:provider:timestamp:codeVerifier:hmacSignature )
 */
export function generateOAuthState(
  memberId: string,
  provider: string,
  codeVerifier: string
): string {
  const timestamp = Date.now();
  const payload = `${memberId}:${provider}:${timestamp}:${codeVerifier}`;
  const signature = crypto
    .createHmac('sha256', getStateSecret())
    .update(payload)
    .digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64url');
}

/** state 検証結果 */
interface VerifiedState {
  memberId: string;
  provider: string;
  codeVerifier: string;
}

/**
 * OAuth state パラメータを検証する。
 * - HMAC署名チェック (CSRF防止)
 * - 5分以内の有効期限チェック
 * - タイミングセーフ比較
 */
export function verifyOAuthState(state: string): VerifiedState | null {
  try {
    const decoded = Buffer.from(state, 'base64url').toString();
    const parts = decoded.split(':');
    if (parts.length < 5) return null;

    const signature = parts.pop()!;
    const payload = parts.join(':');
    // parts: [memberId, provider, timestamp, codeVerifier]
    const [memberId, provider, timestampStr, codeVerifier] = parts;

    if (!memberId || !provider || !timestampStr || !codeVerifier) {
      return null;
    }

    // 5分以内チェック
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp) || Date.now() - timestamp > 5 * 60 * 1000) {
      return null;
    }

    const expected = crypto
      .createHmac('sha256', getStateSecret())
      .update(payload)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return null;
    }

    return { memberId, provider, codeVerifier };
  } catch {
    return null;
  }
}
