// =============================================================================
// Cron認証ヘルパー
// Vercel Cronから呼ばれるAPIルートの認証チェック
// =============================================================================

import { NextRequest } from 'next/server';

/**
 * Cronリクエストの認証を検証する
 * Vercel CronはAuthorizationヘッダーにCRON_SECRETを付与して呼び出す
 *
 * @returns true: 認証OK, false: 認証NG
 */
export function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;

  const token = authHeader.replace('Bearer ', '');
  return token === process.env.CRON_SECRET;
}
