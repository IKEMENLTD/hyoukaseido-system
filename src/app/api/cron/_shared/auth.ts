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

  const token = authHeader.replace('Bearer ', '');
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const tokenBuf = Buffer.from(token, 'utf-8');
  const secretBuf = Buffer.from(secret, 'utf-8');

  // timingSafeEqual は同じ長さのBufferが必要
  if (tokenBuf.length !== secretBuf.length) return false;

  return crypto.timingSafeEqual(tokenBuf, secretBuf);
}
