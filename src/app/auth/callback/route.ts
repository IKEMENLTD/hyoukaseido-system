import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

/** リダイレクト先として許可するパスのプレフィックス */
const ALLOWED_REDIRECT_PREFIXES = [
  '/dashboard',
  '/objectives',
  '/checkin',
  '/review',
  '/admin',
  '/self/',
  '/periods/',
  '/profile',
  '/feedback',
  '/calibration',
  '/results',
  '/one-on-one',
  '/improvement-plans',
  '/win-session',
  '/quarterly-bonus',
  '/toss',
  '/bonus',
  '/map',
  '/history',
  '/guide',
];

/**
 * リダイレクト先パスを検証する。
 * - '/' で始まり '//' で始まらない（プロトコル相対URL防止）
 * - 許可リストのプレフィックスに一致する
 */
function sanitizeRedirectPath(path: string): string {
  if (
    path.startsWith('/') &&
    !path.startsWith('//') &&
    ALLOWED_REDIRECT_PREFIXES.some((prefix) => path.startsWith(prefix))
  ) {
    return path;
  }
  return '/dashboard';
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = sanitizeRedirectPath(searchParams.get('next') ?? '/dashboard');

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      // メールアドレスで未紐づけメンバーを自動リンク（メール検証済みの場合のみ）
      // service roleクライアントを使用: 初回ログイン時はRLSのmembers_updateポリシーを
      // 満たせない（auth_user_idがまだnullのため）ので、RLSをバイパスする必要がある
      let isFirstLogin = false;
      if (user?.email && user.email_confirmed_at) {
        try {
          const serviceClient = createServiceRoleClient();
          // email照合はcase-insensitive（Google OAuthの返すemailと登録emailの大小文字差異対応）
          // 同一emailの重複メンバー対策: activeのみ対象 + 1件だけ取得してIDで更新
          const { data: candidate } = await serviceClient
            .from('members')
            .select('id')
            .ilike('email', user.email)
            .is('auth_user_id', null)
            .eq('status', 'active')
            .limit(1)
            .single();

          if (candidate) {
            await serviceClient
              .from('members')
              .update({ auth_user_id: user.id })
              .eq('id', candidate.id);
            isFirstLogin = true;
          }
        } catch (e) {
          // メンバー紐付け失敗してもログイン自体は続行（500エラー防止）
          console.error('Member linking failed:', e);
        }
      }

      // 初回ログイン時はwelcome=1をクエリパラメータに追加
      const redirectUrl = new URL(`${origin}${next}`);
      if (isFirstLogin) {
        redirectUrl.searchParams.set('welcome', '1');
      }
      return NextResponse.redirect(redirectUrl.toString());
    }

    console.error('Auth callback error:', error.message);
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
