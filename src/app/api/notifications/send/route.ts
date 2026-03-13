// =============================================================================
// 通知送信 API Route (Server-side)
// Client Componentから呼び出して通知を発火させる
// =============================================================================

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendNotification } from '@/lib/notifications/send';
import type { NotificationEvent } from '@/lib/notifications/types';

/** リクエストボディの型 */
interface SendNotificationBody {
  event: NotificationEvent;
  title: string;
  message: string;
  url?: string;
}

/** membersテーブルから取得する行の型 */
interface MemberRow {
  org_id: string;
}

/** 有効な通知イベント一覧 */
const VALID_EVENTS: ReadonlySet<string> = new Set<string>([
  'eval_period_start',
  'eval_submitted',
  'eval_submission_reminder',
  'manager_eval_request',
  'calibration_start',
  'calibration_complete',
  'feedback_ready',
  'okr_period_start',
  'okr_checkin_reminder',
  'okr_review_deadline',
  'crosssell_toss',
  'crosssell_contracted',
  'bonus_confirmed',
  'one_on_one_reminder',
  'win_session_reminder',
]);

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

    // org_id取得
    const { data: member } = await supabase
      .from('members')
      .select('org_id')
      .eq('auth_user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json(
        { error: 'メンバー情報が見つかりません' },
        { status: 404 }
      );
    }

    const body = (await request.json()) as SendNotificationBody;

    // バリデーション
    if (!body.event || !body.title || !body.message) {
      return NextResponse.json(
        { error: '必須フィールドが不足しています (event, title, message)' },
        { status: 400 }
      );
    }

    if (!VALID_EVENTS.has(body.event)) {
      return NextResponse.json(
        { error: `無効なイベントタイプです: ${body.event}` },
        { status: 400 }
      );
    }

    const memberRow = member as unknown as MemberRow;

    const results = await sendNotification(memberRow.org_id, {
      event: body.event,
      title: body.title,
      message: body.message,
      url: body.url,
    });

    return NextResponse.json({ results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
