'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateObjectiveTitle, deleteObjective } from '@/lib/okr/actions';

interface ObjectiveActionsProps {
  objectiveId: string;
  currentTitle: string;
  canEdit: boolean;
  canDelete: boolean;
}

export default function ObjectiveActions({
  objectiveId,
  currentTitle,
  canEdit,
  canDelete,
}: ObjectiveActionsProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(currentTitle);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSaveTitle = async () => {
    if (!title.trim() || title === currentTitle) {
      setIsEditing(false);
      return;
    }
    setSaving(true);
    const result = await updateObjectiveTitle(objectiveId, title);
    setSaving(false);
    if (result.success) {
      setIsEditing(false);
      setMessage({ type: 'success', text: 'タイトルを更新しました' });
      router.refresh();
    } else {
      setMessage({ type: 'error', text: result.error ?? '更新に失敗しました' });
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    const result = await deleteObjective(objectiveId);
    setSaving(false);
    if (result.success) {
      router.push('/objectives');
    } else {
      setMessage({ type: 'error', text: result.error ?? '削除に失敗しました' });
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* メッセージ */}
      {message && (
        <div className={`border px-3 py-2 text-xs ${
          message.type === 'success' ? 'border-[#22d3ee] text-[#22d3ee]' : 'border-[#ef4444] text-[#ef4444]'
        }`}>
          {message.text}
        </div>
      )}

      {/* タイトル編集 */}
      {isEditing ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 bg-[#111111] border border-[#333333] text-[#e5e5e5] px-3 py-1.5 text-sm focus:border-[#3b82f6] outline-none"
          />
          <button
            type="button"
            onClick={handleSaveTitle}
            disabled={saving}
            className="px-3 py-1.5 border border-[#3b82f6] text-xs text-[#3b82f6] hover:bg-[#3b82f6]/10 disabled:opacity-50"
          >
            {saving ? '...' : '保存'}
          </button>
          <button
            type="button"
            onClick={() => { setIsEditing(false); setTitle(currentTitle); }}
            className="px-3 py-1.5 border border-[#333333] text-xs text-[#737373] hover:border-[#555555]"
          >
            取消
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 border border-[#333333] text-xs text-[#a3a3a3] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors"
            >
              タイトル編集
            </button>
          )}
          {canDelete && !showDeleteConfirm && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="px-3 py-1.5 border border-[#333333] text-xs text-[#737373] hover:border-[#ef4444] hover:text-[#ef4444] transition-colors"
            >
              削除
            </button>
          )}
        </div>
      )}

      {/* 削除確認 */}
      {showDeleteConfirm && (
        <div className="border border-[#ef4444]/30 bg-[#ef4444]/5 px-4 py-3">
          <p className="text-sm text-[#ef4444] mb-3">
            このOKRとすべてのKR・チェックインデータを削除します。この操作は取り消せません。
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="px-4 py-1.5 bg-[#ef4444] text-xs text-white font-bold hover:bg-[#dc2626] disabled:opacity-50"
            >
              {saving ? '削除中...' : '削除する'}
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="px-4 py-1.5 border border-[#333333] text-xs text-[#a3a3a3]"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
