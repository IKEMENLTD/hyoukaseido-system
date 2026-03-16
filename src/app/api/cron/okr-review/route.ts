// =============================================================================
// Cron: OKR振り返り期限リマインダー
// 毎日 UTC 0:00 (JST 9:00) に実行
// okr_periods で status='reviewing' かつ end_date が7日以内のものを対象
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '../_shared/auth';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { notifyOkrReviewDeadline } from '@/lib/notifications/events';
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

    // 今日の日付と7日後の日付を計算
    const today = new Date();
    const todayDate = today.toISOString().split('T')[0];
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const deadlineDate = sevenDaysFromNow.toISOString().split('T')[0];

    // reviewing状態かつ終了日が今日以降〜7日以内のOKR期間を取得
    // (過去の期限切れ期間を除外するため .gte('end_date', todayDate) を追加)
    const { data: periods, error } = await supabase
      .from('okr_periods')
      .select('id, org_id, name, end_date, status')
      .eq('status', 'reviewing')
      .gte('end_date', todayDate)
      .lte('end_date', deadlineDate);

    if (error) {
      console.error('okr_periods取得エラー:', error.message);
      return NextResponse.json(
        { error: 'データ取得に失敗しました' },
        { status: 500 }
      );
    }

    const okrPeriods = (periods ?? []) as unknown as OkrPeriodRow[];
    const results: Array<{ periodId: string; success: boolean }> = [];

    for (const period of okrPeriods) {
      try {
        await notifyOkrReviewDeadline(
          period.org_id,
          period.name,
          supabase
        );
        results.push({ periodId: period.id, success: true });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '不明なエラー';
        console.error(
          `okr-review送信失敗 (period: ${period.id}):`,
          message
        );
        results.push({ periodId: period.id, success: false });
      }
    }

    return NextResponse.json({
      ok: true,
      processed: results.length,
      results,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '不明なエラー';
    console.error('okr-review cron エラー:', message);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
