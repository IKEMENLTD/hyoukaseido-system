// =============================================================================
// Cron認証ヘルパー
// Vercel Cronから呼ばれるAPIルートの認証チェック
// =============================================================================

import crypto from 'crypto';
import { NextRequest } from 'next/server';

/**
 * Cronリクエストの認証を検証する
 * Vercel CronはAuthorizationヘッダーにCRON_SECRETを付与して呼び出す
 * タイミング攻撃を防ぐため crypto.timingSafeEqual() を使用
 *
 * @returns true: 認証OK, false: 認証NG
 */
export function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;

  const bearerMatch = authHeader.trim().match(/^Bearer\s+(.+)$/i);
  if (!bearerMatch) return false;
  const token = bearerMatch[1].trim();
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  // 長さが異なる場合も一定時間で比較（タイミング攻撃による長さリーク防止）
  // 短い方をパディングしてからtimingSafeEqualで比較
  const tokenBuf = Buffer.from(token, 'utf-8');
  const secretBuf = Buffer.from(secret, 'utf-8');
  const maxLen = Math.max(tokenBuf.length, secretBuf.length);
  const paddedToken = Buffer.alloc(maxLen);
  const paddedSecret = Buffer.alloc(maxLen);
  tokenBuf.copy(paddedToken);
  secretBuf.copy(paddedSecret);

  return tokenBuf.length === secretBuf.length && crypto.timingSafeEqual(paddedToken, paddedSecret);
}
