// =============================================================================
// OAuth Disconnect Route
// POST /api/oauth/[provider]/disconnect
// アカウント連携を解除する
// =============================================================================

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { isValidProvider } from '@/lib/oauth/providers';

/** members テーブルから取得する行の型 */
interface MemberIdRow {
  id: string;
}

export async function POST(
  _request: Request,
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

    // oauth_account_links から該当行を削除 (service role で RLS バイパス)
    const serviceClient = createServiceRoleClient();
    const { error: deleteError } = await serviceClient
      .from('oauth_account_links')
      .delete()
      .eq('member_id', memberRow.id)
      .eq('provider', provider);

    if (deleteError) {
      console.error('OAuth disconnect error:', deleteError.message);
      return NextResponse.json(
        { error: '連携解除中にエラーが発生しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error(
      'OAuth disconnect error:',
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(
      { error: '連携解除処理でエラーが発生しました' },
      { status: 500 }
    );
  }
}
