'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteOneOnOne } from '@/lib/okr/actions';

interface OneOnOneActionsProps {
  recordId: string;
  canDelete: boolean;
}

export default function OneOnOneActions({ recordId, canDelete }: OneOnOneActionsProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canDelete) return null;

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    const result = await deleteOneOnOne(recordId);
    setDeleting(false);
    if (result.success) {
      router.refresh();
    } else {
      setError(result.error ?? '削除に失敗しました');
      setConfirming(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-[10px] text-[#ef4444]">{error}</span>}
      {confirming ? (
        <>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="px-2 py-1 bg-[#ef4444] text-[10px] text-white font-bold hover:bg-[#dc2626] disabled:opacity-50"
          >
            {deleting ? '...' : '削除確定'}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="px-2 py-1 border border-[#333333] text-[10px] text-[#737373]"
          >
            取消
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="px-2 py-1 border border-[#333333] text-[10px] text-[#737373] hover:border-[#ef4444] hover:text-[#ef4444] transition-colors"
        >
          削除
        </button>
      )}
    </div>
  );
}
