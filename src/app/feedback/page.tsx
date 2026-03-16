// =============================================================================
// 評価フィードバックページ (E-04)
// 上長から部下への評価結果フィードバック面談管理
// =============================================================================

import type { Rank, Grade, EvaluationStatus } from '@/types/evaluation';
import { getCurrentMember } from '@/lib/auth/get-member';
import { createClient } from '@/lib/supabase/server';
import FeedbackClient from './FeedbackClient';
import type { FeedbackTarget } from './FeedbackClient';

interface FeedbackRow {
  id: string;
  total_score: number | null;
  rank: Rank | null;
  status: EvaluationStatus;
  evaluator_comment: string | null;
  next_actions: string | null;
  updated_at: string;
  members: { name: string; grade: Grade } | null;
  divisions: { name: string } | null;
}


export default async function FeedbackPage() {
  const member = await getCurrentMember();
  if (!member || !['G3', 'G4', 'G5'].includes(member.grade)) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">アクセス権限がありません</h2>
          <p className="text-sm text-[#737373]">フィードバック機能はG3以上の等級のメンバーのみ利用可能です。</p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  const { data: rawTargets } = await supabase
    .from('evaluations')
    .select(`
      id, total_score, rank, status, evaluator_comment, next_actions, updated_at,
      members!evaluations_member_id_fkey (name, grade),
      divisions!evaluations_division_id_fkey (name)
    `)
    .eq('evaluator_id', member.id)
    .in('status', ['calibrated', 'feedback_done'])
    .order('updated_at', { ascending: false });

  const targets: FeedbackTarget[] = ((rawTargets ?? []) as unknown as FeedbackRow[]).map(
    (row) => ({
      id: row.id,
      memberName: row.members?.name ?? '---',
      grade: row.members?.grade ?? 'G1',
      divisionName: row.divisions?.name ?? '---',
      totalScore: row.total_score ?? 0,
      rank: (row.rank as Rank) ?? 'B',
      status: row.status,
      feedbackDate: row.status === 'feedback_done' ? row.updated_at.split('T')[0] : null,
      feedbackNotes: row.evaluator_comment,
      nextActions: row.next_actions,
    }),
  );

  const pendingCount = targets.filter((t) => t.status === 'calibrated').length;
  const doneCount = targets.filter((t) => t.status === 'feedback_done').length;

  return (
    <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* ページヘッダー */}
        <div>
          <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
            評価フィードバック
          </h1>
          <p className="text-sm text-[#737373] mt-1">
            部下への評価結果フィードバック面談
          </p>
        </div>

        {/* サマリー */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-1">対象者数</div>
            <div className="text-2xl font-bold text-[#e5e5e5]">{targets.length}</div>
          </div>
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-1">未実施</div>
            <div className="text-2xl font-bold text-[#f59e0b]">{pendingCount}</div>
          </div>
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-1">実施済み</div>
            <div className="text-2xl font-bold text-[#22d3ee]">{doneCount}</div>
          </div>
        </div>

        {/* 空状態 */}
        {targets.length === 0 && (
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-12 text-center">
            <p className="text-sm text-[#737373]">フィードバック対象の評価はありません</p>
          </div>
        )}

        {/* フィードバック対象者一覧 (クライアントコンポーネントに委譲) */}
        {targets.length > 0 && <FeedbackClient targets={targets} isAdmin={['G4', 'G5'].includes(member.grade)} />}
      </div>
    </div>
  );
}
