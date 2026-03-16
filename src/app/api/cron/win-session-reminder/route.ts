// =============================================================================
// Cron: ウィンセッションリマインダー
// 毎週金曜 UTC 0:00 (JST 9:00) に実行
// 全アクティブ組織に対して通知
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '../_shared/auth';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { notifyWinSessionReminder } from '@/lib/notifications/events';
import type { OrganizationRow } from '../_shared/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    if (!verifyCronAuth(request)) {
      return NextResponse.json(
        { error: '認証に失敗しました' },
        { status: 401 }
      );
    }

    const supabase = createServiceRoleClient();

    // 全組織を取得（organizationsテーブルにはstatus列がないため全件取得）
    const { data: organizations, error } = await supabase
      .from('organizations')
      .select('id, name');

    if (error) {
      console.error('organizations取得エラー:', error.message);
      return NextResponse.json(
        { error: 'データ取得に失敗しました' },
        { status: 500 }
      );
    }

    const orgs = (organizations ?? []) as unknown as OrganizationRow[];
    const results: Array<{ orgId: string; success: boolean }> = [];

    for (const org of orgs) {
      try {
        await notifyWinSessionReminder(org.id, supabase);
        results.push({ orgId: org.id, success: true });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '不明なエラー';
        console.error(
          `win-session-reminder送信失敗 (org: ${org.id}):`,
          message
        );
        results.push({ orgId: org.id, success: false });
      }
    }

    return NextResponse.json({
      ok: true,
      processed: results.length,
      results,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '不明なエラー';
    console.error('win-session-reminder cron エラー:', message);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
