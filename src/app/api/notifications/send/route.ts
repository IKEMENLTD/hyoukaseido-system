// =============================================================================
// 通知送信 API Route (Server-side)
// Client Componentから呼び出して通知を発火させる
// =============================================================================

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
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
  grade: string;
}

/** 管理者（G3以上）のみが発火できるイベント */
const ADMIN_ONLY_EVENTS: ReadonlySet<string> = new Set<string>([
  'eval_period_start',
  'calibration_start',
  'calibration_complete',
  'feedback_ready',
  'okr_period_start',
  'bonus_confirmed',
]);

/** 管理者等級 */
const MANAGER_GRADES: ReadonlySet<string> = new Set(['G3', 'G4', 'G5']);

// NOTE: サーバーレス環境ではメモリ内レートリミットは機能しない（各リクエストが
// 別インスタンスで実行されMapが共有されないため）。必要な場合はRedis/Supabaseで実装する。
// 本APIは認証済みユーザー限定かつ冪等な通知送信のため、レートリミットは省略。

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

    // org_id・grade取得
    const { data: member } = await supabase
      .from('members')
      .select('org_id, grade')
      .eq('auth_user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json(
        { error: 'メンバー情報が見つかりません' },
        { status: 404 }
      );
    }

    const memberRow = member as unknown as MemberRow;

    // 簡易レートリミット: 同一組織で5秒以内の連続通知送信を拒否
    const serviceClientForRateLimit = createServiceRoleClient();
    const { data: recentChannel } = await serviceClientForRateLimit
      .from('notification_channels')
      .select('last_sent_at')
      .eq('org_id', memberRow.org_id)
      .eq('is_active', true)
      .not('last_sent_at', 'is', null)
      .order('last_sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentChannel) {
      const row = recentChannel as { last_sent_at: string };
      const lastSentTime = new Date(row.last_sent_at).getTime();
      if (Date.now() - lastSentTime < 5000) {
        return NextResponse.json(
          { error: 'リクエストが多すぎます。しばらく待ってから再試行してください' },
          { status: 429 }
        );
      }
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
        { error: '無効なイベントタイプです' },
        { status: 400 }
      );
    }

    // 権限チェック: 管理者限定イベントはG3以上のみ
    if (ADMIN_ONLY_EVENTS.has(body.event) && !MANAGER_GRADES.has(memberRow.grade)) {
      return NextResponse.json(
        { error: 'この通知を送信する権限がありません' },
        { status: 403 }
      );
    }

    // title/messageの長さ制限（フィッシング対策）
    if (body.title.length > 200 || body.message.length > 1000) {
      return NextResponse.json(
        { error: '通知の件名または本文が長すぎます' },
        { status: 400 }
      );
    }

    // URLが指定されている場合、相対パスのみ許可（外部URLフィッシング防止）
    if (body.url && (!/^\/[a-zA-Z0-9]/.test(body.url) || body.url.includes('..'))) {
      return NextResponse.json(
        { error: '通知URLは相対パスのみ指定可能です' },
        { status: 400 }
      );
    }

    // service roleクライアントを使用してRLSをバイパス
    // (notification_channelsのSELECTはG4/G5のみ許可されているため、
    //  G1/G2/G3ユーザーが通知を発火する場合にservice roleが必要)
    const serviceClient = createServiceRoleClient();

    const results = await sendNotification(memberRow.org_id, {
      event: body.event,
      title: body.title,
      message: body.message,
      url: body.url,
    }, serviceClient);

    return NextResponse.json({ results });
  } catch (err: unknown) {
    console.error('Notification send error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: '通知の送信中にエラーが発生しました' }, { status: 500 });
  }
}
