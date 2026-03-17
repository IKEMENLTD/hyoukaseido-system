// =============================================================================
// OAuth Initiate Route
// GET /api/oauth/[provider]/initiate
// PKCE + CSRF state 生成 -> プロバイダーの認証URLにリダイレクト
// =============================================================================

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isValidProvider, getAuthorizationUrl } from '@/lib/oauth/providers';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateOAuthState,
} from '@/lib/oauth/state';

/** members テーブルから取得する行の型 */
interface MemberIdRow {
  id: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;

    // プロバイダーのバリデーション
    if (!isValidProvider(provider)) {
      return NextResponse.json(
        { error: '無効なプロバイダーです。slack, line, chatwork のいずれかを指定してください' },
        { status: 400 }
      );
    }

    // 認証チェック
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // member.id を取得
    const { data: member } = await supabase
      .from('members')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json(
        { error: 'メンバー情報が見つかりません' },
        { status: 404 }
      );
    }

    const memberRow = member as unknown as MemberIdRow;

    // PKCE code_verifier / code_challenge 生成
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    // CSRF state 生成 (memberId + provider + codeVerifier を HMAC 署名)
    const state = generateOAuthState(memberRow.id, provider, codeVerifier);

    // プロバイダーの認証URLにリダイレクト
    const authUrl = getAuthorizationUrl(provider, state, codeChallenge);

    return NextResponse.redirect(authUrl);
  } catch (err: unknown) {
    console.error(
      'OAuth initiate error:',
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(
      { error: 'OAuth開始処理でエラーが発生しました' },
      { status: 500 }
    );
  }
}
