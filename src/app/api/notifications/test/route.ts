// =============================================================================
// 通知テスト送信 API Route (Server-side)
// チャンネルIDを受け取り、サーバーサイドからWebhookにテスト送信する
// Webhook URLがブラウザに露出しないようにする
// =============================================================================

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

/** リクエストボディの型 */
interface TestSendBody {
  channelId: string;
}

/** membersテーブルから取得する行の型 */
interface MemberRow {
  grade: string;
}

/** notification_channelsテーブルから取得する行の型 */
interface ChannelRow {
  id: string;
  type: 'slack' | 'line' | 'chatwork';
  webhook_url: string;
  channel_name: string;
  org_id: string;
  is_active: boolean;
}

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

/** テスト送信を許可する等級 (G4/G5 = 管理者) */
const ALLOWED_GRADES: ReadonlySet<string> = new Set(['G4', 'G5']);

/** テスト送信のタイムアウト (ms) */
const TEST_SEND_TIMEOUT_MS = 10000;

/** レートリミット: ユーザーID -> 最終リクエスト時刻 */
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 5000;

// ---------------------------------------------------------------------------
// テスト送信ペイロード構築
// ---------------------------------------------------------------------------

function buildTestPayload(type: 'slack' | 'line' | 'chatwork'): string {
  const testMessage = '[テスト] 評価制度システムからのテスト通知です';

  if (type === 'slack') {
    return JSON.stringify({ text: testMessage });
  }

  if (type === 'chatwork') {
    return JSON.stringify({
      body: `[info][title]テスト通知[/title]${testMessage}[/info]`,
    });
  }

  // LINE
  return JSON.stringify({
    messages: [{ type: 'text', text: testMessage }],
  });
}

// ---------------------------------------------------------------------------
// POSTハンドラ
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    // 認証チェック
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    // レートリミット
    const now = Date.now();
    const lastRequest = rateLimitMap.get(user.id);
    if (lastRequest && now - lastRequest < RATE_LIMIT_WINDOW_MS) {
      return NextResponse.json(
        { error: 'リクエストが多すぎます。しばらく待ってから再試行してください' },
        { status: 429 }
      );
    }
    rateLimitMap.set(user.id, now);

    // 等級チェック (G4/G5のみ)
    const { data: member } = await supabase
      .from('members')
      .select('grade')
      .eq('auth_user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json(
        { error: 'メンバー情報が見つかりません' },
        { status: 404 }
      );
    }

    const memberRow = member as unknown as MemberRow;

    if (!ALLOWED_GRADES.has(memberRow.grade)) {
      return NextResponse.json(
        { error: 'テスト送信の権限がありません' },
        { status: 403 }
      );
    }

    // リクエストボディのバリデーション
    const body = (await request.json()) as TestSendBody;

    if (!body.channelId || typeof body.channelId !== 'string') {
      return NextResponse.json(
        { error: 'channelId が必要です' },
        { status: 400 }
      );
    }

    // DBからチャンネル情報を取得 (webhook_urlはサーバー内でのみ使用)
    const { data: channel } = await supabase
      .from('notification_channels')
      .select('id, type, webhook_url, channel_name, org_id, is_active')
      .eq('id', body.channelId)
      .single();

    if (!channel) {
      return NextResponse.json(
        { error: '指定されたチャンネルが見つかりません' },
        { status: 404 }
      );
    }

    const channelRow = channel as unknown as ChannelRow;

    if (!channelRow.is_active) {
      return NextResponse.json(
        { error: 'このチャンネルは無効化されています' },
        { status: 400 }
      );
    }

    // サーバーサイドからWebhookにテスト送信
    const payloadBody = buildTestPayload(channelRow.type);

    const response = await fetch(channelRow.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payloadBody,
      signal: AbortSignal.timeout(TEST_SEND_TIMEOUT_MS),
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `テスト送信失敗: HTTP ${response.status}`,
          channelName: channelRow.channel_name,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      channelName: channelRow.channel_name,
    });
  } catch (err: unknown) {
    console.error(
      'Notification test send error:',
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(
      { error: 'テスト送信中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
