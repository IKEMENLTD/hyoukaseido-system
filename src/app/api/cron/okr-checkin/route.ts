// =============================================================================
// Cron: OKR週次チェックインリマインダー
// 毎週月曜 UTC 0:00 (JST 9:00) に実行
// okr_periods で status='active' のものを対象
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '../_shared/auth';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { notifyOkrCheckinReminder } from '@/lib/notifications/events';
import type { OkrPeriodRow } from '../_shared/types';

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

    // アクティブなOKR期間を取得
    const { data: periods, error } = await supabase
      .from('okr_periods')
      .select('id, org_id, name, end_date, status')
      .eq('status', 'active');

    if (error) {
      console.error('okr_periods取得エラー:', error.message);
      return NextResponse.json(
        { error: 'データ取得に失敗しました' },
        { status: 500 }
      );
    }

    const okrPeriods = (periods ?? []) as unknown as OkrPeriodRow[];

    // org_idの重複を排除（1つの組織に複数のactive periodがある場合）
    const uniqueOrgIds = [...new Set(okrPeriods.map((p) => p.org_id))];
    const results: Array<{ orgId: string; success: boolean }> = [];

    for (const orgId of uniqueOrgIds) {
      try {
        await notifyOkrCheckinReminder(orgId, supabase);
        results.push({ orgId, success: true });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '不明なエラー';
        console.error(
          `okr-checkin送信失敗 (org: ${orgId}):`,
          message
        );
        results.push({ orgId, success: false });
      }
    }

    return NextResponse.json({
      ok: true,
      processed: results.length,
      results,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '不明なエラー';
    console.error('okr-checkin cron エラー:', message);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
