'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toggleMilestoneComplete, updateImprovementPlanStatus } from '@/lib/okr/actions';

interface Milestone {
  title: string;
  dueDate: string;
  completed: boolean;
}

interface PlanActionsProps {
  planId: string;
  status: string;
  milestones: Milestone[];
  canManage: boolean;
}

export default function PlanActions({ planId, status, milestones, canManage }: PlanActionsProps) {
  const router = useRouter();
  const [togglingIdx, setTogglingIdx] = useState<number | null>(null);
  const [updating, setUpdating] = useState(false);
  const [outcome, setOutcome] = useState('');
  const [showComplete, setShowComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canManage || status !== 'active') return null;

  const handleToggle = async (idx: number) => {
    setTogglingIdx(idx);
    setError(null);
    const result = await toggleMilestoneComplete(planId, idx);
    setTogglingIdx(null);
    if (result.success) {
      router.refresh();
    } else {
      setError(result.error ?? '更新に失敗しました');
    }
  };

  const handleStatusChange = async (newStatus: 'completed' | 'cancelled') => {
    setUpdating(true);
    setError(null);
    const result = await updateImprovementPlanStatus(planId, newStatus, outcome || null);
    setUpdating(false);
    if (result.success) {
      router.refresh();
    } else {
      setError(result.error ?? '更新に失敗しました');
    }
  };

  return (
    <div className="space-y-3 mt-3">
      {error && (
        <div className="text-xs text-[#ef4444] border border-[#ef4444]/30 px-3 py-2">
          {error}
        </div>
      )}

      {/* マイルストーンチェックボックス */}
      <div className="space-y-1">
        {milestones.map((m, idx) => (
          <button
            key={m.title}
            type="button"
            onClick={() => handleToggle(idx)}
            disabled={togglingIdx !== null}
            className="flex items-center gap-2 text-sm w-full text-left hover:bg-[#111111] px-2 py-1 transition-colors disabled:opacity-50"
          >
            <div className={`w-3.5 h-3.5 border flex items-center justify-center ${
              m.completed ? 'bg-[#3b82f6] border-[#3b82f6]' : 'border-[#333333] hover:border-[#3b82f6]'
            }`}>
              {m.completed && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                  <path strokeLinecap="square" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className={m.completed ? 'text-[#737373] line-through' : 'text-[#e5e5e5]'}>
              {m.title}
            </span>
            <span className="text-[10px] text-[#404040] ml-auto">{m.dueDate}</span>
            {togglingIdx === idx && <span className="text-[10px] text-[#737373]">...</span>}
          </button>
        ))}
      </div>

      {/* ステータス変更 */}
      <div className="border-t border-[#1a1a1a] pt-3 flex items-center gap-2">
        {showComplete ? (
          <div className="space-y-2 w-full">
            <textarea
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              rows={2}
              placeholder="改善結果・所見を入力"
              className="w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] px-3 py-2 text-xs focus:border-[#3b82f6] outline-none resize-none"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleStatusChange('completed')}
                disabled={updating}
                className="px-3 py-1 border border-[#22d3ee] text-[10px] text-[#22d3ee] font-bold hover:bg-[#22d3ee]/10 disabled:opacity-50"
              >
                {updating ? '...' : '完了確定'}
              </button>
              <button
                type="button"
                onClick={() => setShowComplete(false)}
                className="px-3 py-1 border border-[#333333] text-[10px] text-[#737373]"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setShowComplete(true)}
              className="px-3 py-1 border border-[#22d3ee] text-[10px] text-[#22d3ee] font-bold hover:bg-[#22d3ee]/10"
            >
              計画完了
            </button>
            <button
              type="button"
              onClick={() => handleStatusChange('cancelled')}
              disabled={updating}
              className="px-3 py-1 border border-[#737373] text-[10px] text-[#737373] hover:border-[#ef4444] hover:text-[#ef4444] disabled:opacity-50"
            >
              {updating ? '...' : '計画キャンセル'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
