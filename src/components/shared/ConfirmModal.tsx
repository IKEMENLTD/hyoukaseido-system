'use client';

import { useCallback, useEffect, useRef } from 'react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = '実行',
  cancelLabel = 'キャンセル',
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  // モーダル表示時にフォーカスを確認ボタンに移動
  useEffect(() => {
    if (open) {
      confirmRef.current?.focus();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Escキーで閉じる
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !loading) {
      onCancel();
    }
  }, [onCancel, loading]);

  if (!open) return null;

  const confirmColor = variant === 'danger'
    ? 'bg-[#ef4444] hover:bg-[#dc2626] text-white'
    : 'bg-[#3b82f6] hover:bg-[#2563eb] text-[#050505]';

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-desc"
    >
      {/* オーバーレイ */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={loading ? undefined : onCancel}
      />

      {/* ダイアログ */}
      <div className="relative z-10 w-full max-w-sm border border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="px-5 py-4">
          <h3 id="confirm-title" className="text-sm font-bold text-[#e5e5e5]">
            {title}
          </h3>
          <p id="confirm-desc" className="mt-2 text-xs text-[#a3a3a3] leading-relaxed whitespace-pre-line">
            {description}
          </p>
        </div>
        <div className="border-t border-[#1a1a1a] px-5 py-3 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-xs text-[#a3a3a3] border border-[#333333] hover:text-[#e5e5e5] hover:border-[#555555] transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-2 ${confirmColor}`}
          >
            {loading && (
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
              </svg>
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
