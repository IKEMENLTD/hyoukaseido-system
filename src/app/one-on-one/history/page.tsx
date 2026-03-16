// =============================================================================
// 1on1履歴一覧ページ
// 過去の1on1面談記録を一覧表示 (ページネーション付き)
// =============================================================================

import type { MeetingType } from '@/types/evaluation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMember } from '@/lib/auth/get-member';
import Link from 'next/link';
import OneOnOneActions from './OneOnOneActions';

// ---------------------------------------------------------------------------
// Supabase query row types
// ---------------------------------------------------------------------------

interface MemberNameRow {
  name: string;
}

interface OneOnOneRow {
  id: string;
  meeting_date: string;
  meeting_type: MeetingType;
  okr_progress: string | null;
  blockers: string | null;
  action_items: string | null;
  notes: string | null;
  manager: MemberNameRow;
  member: MemberNameRow;
}

interface OneOnOneRecord {
  id: string;
  managerName: string;
  meetingDate: string;
  meetingType: MeetingType;
  okrProgress: string | null;
  blockers: string | null;
  actionItems: string | null;
  notes: string | null;
}

const MEETING_TYPE_LABELS: Record<MeetingType, { label: string; color: string }> = {
  weekly_checkin: { label: '週次', color: 'text-[#a3a3a3] border-[#333333]' },
  monthly_1on1: { label: '月次', color: 'text-[#3b82f6] border-[#3b82f6]' },
  quarterly_review: { label: '四半期', color: 'text-[#a855f7] border-[#a855f7]' },
  semi_annual_feedback: { label: '半期FB', color: 'text-[#22d3ee] border-[#22d3ee]' },
};

const PAGE_SIZE = 20;

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function OneOnOneHistoryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? '1', 10) || 1);

  const member = await getCurrentMember();
  if (!member) {
    return (
      <div className="min-h-screen bg-[#050505] p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">ログインが必要です</h2>
          <p className="text-sm text-[#737373]">この機能を利用するにはログインしてください。</p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  // 総件数を取得
  const { count: totalCount } = await supabase
    .from('one_on_ones')
    .select('id', { count: 'exact', head: true })
    .or(`member_id.eq.${member.id},manager_id.eq.${member.id}`);

  const total = totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const offset = (safePage - 1) * PAGE_SIZE;

  // ページ分のデータを取得
  const { data: rawRecords } = await supabase
    .from('one_on_ones')
    .select(`
      id, meeting_date, meeting_type, okr_progress, blockers, action_items, notes, manager_id,
      manager:members!one_on_ones_manager_id_fkey (name),
      member:members!one_on_ones_member_id_fkey (name)
    `)
    .or(`member_id.eq.${member.id},manager_id.eq.${member.id}`)
    .order('meeting_date', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const records: OneOnOneRecord[] = ((rawRecords ?? []) as unknown as OneOnOneRow[]).map(
    (row) => ({
      id: row.id,
      managerName: row.manager.name,
      meetingDate: row.meeting_date,
      meetingType: row.meeting_type,
      okrProgress: row.okr_progress,
      blockers: row.blockers,
      actionItems: row.action_items,
      notes: row.notes,
    })
  );

  const hasPrev = safePage > 1;
  const hasNext = safePage < totalPages;

  return (
    <div className="min-h-screen bg-[#050505] p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* ページヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
              1on1 履歴
            </h1>
            <p className="text-sm text-[#737373] mt-1">
              過去の1on1面談記録 ({total}件)
            </p>
          </div>
          <a
            href="/one-on-one/new"
            className="px-4 py-2 border border-[#3b82f6] text-xs text-[#3b82f6] font-bold hover:bg-[#3b82f6]/10 transition-colors"
          >
            新規記録
          </a>
        </div>

        {/* 空状態 */}
        {records.length === 0 && (
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-12 text-center">
            <h2 className="text-sm font-bold text-[#e5e5e5] mb-2">
              1on1の記録がありません
            </h2>
            <p className="text-xs text-[#737373]">
              新規記録ボタンから最初の1on1を記録しましょう。
            </p>
          </div>
        )}

        {/* 面談履歴カード */}
        <div className="space-y-4">
          {records.map((record) => {
            const typeConfig = MEETING_TYPE_LABELS[record.meetingType];
            return (
              <div key={record.id} className="border border-[#1a1a1a] bg-[#0a0a0a]">
                {/* ヘッダー */}
                <div className="border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-[#e5e5e5] font-bold">{record.meetingDate}</span>
                    <span className={`px-2 py-0.5 border text-[10px] font-bold ${typeConfig.color}`}>
                      {typeConfig.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[#737373]">{record.managerName}</span>
                    <OneOnOneActions
                      recordId={record.id}
                      canDelete={['G4', 'G5'].includes(member.grade)}
                    />
                  </div>
                </div>

                {/* 内容 */}
                <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {record.okrProgress && (
                    <div>
                      <div className="text-[10px] text-[#737373] uppercase tracking-wider mb-1">
                        OKR進捗
                      </div>
                      <p className="text-sm text-[#a3a3a3]">{record.okrProgress}</p>
                    </div>
                  )}
                  {record.blockers && (
                    <div>
                      <div className="text-[10px] text-[#737373] uppercase tracking-wider mb-1">
                        ブロッカー
                      </div>
                      <p className="text-sm text-[#f59e0b]">{record.blockers}</p>
                    </div>
                  )}
                  {record.actionItems && (
                    <div>
                      <div className="text-[10px] text-[#737373] uppercase tracking-wider mb-1">
                        アクションアイテム
                      </div>
                      <p className="text-sm text-[#22d3ee]">{record.actionItems}</p>
                    </div>
                  )}
                  {record.notes && (
                    <div>
                      <div className="text-[10px] text-[#737373] uppercase tracking-wider mb-1">
                        メモ
                      </div>
                      <p className="text-sm text-[#a3a3a3]">{record.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ページネーション */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            {hasPrev ? (
              <Link
                href={`/one-on-one/history?page=${safePage - 1}`}
                className="px-3 py-1 border border-[#333333] text-xs text-[#a3a3a3] hover:border-[#3b82f6] hover:text-[#3b82f6]"
              >
                前へ
              </Link>
            ) : (
              <span className="px-3 py-1 border border-[#1a1a1a] text-xs text-[#404040]">
                前へ
              </span>
            )}
            <span className="px-3 py-1 border border-[#3b82f6] text-xs text-[#3b82f6] font-bold">
              {safePage} / {totalPages}
            </span>
            {hasNext ? (
              <Link
                href={`/one-on-one/history?page=${safePage + 1}`}
                className="px-3 py-1 border border-[#333333] text-xs text-[#a3a3a3] hover:border-[#3b82f6] hover:text-[#3b82f6]"
              >
                次へ
              </Link>
            ) : (
              <span className="px-3 py-1 border border-[#1a1a1a] text-xs text-[#404040]">
                次へ
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
