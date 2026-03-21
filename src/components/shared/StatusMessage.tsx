'use client';

import { useEffect, useRef } from 'react';

interface StatusMessageProps {
  message: string | null;
  type: 'success' | 'error';
  /** 自動消去までのミリ秒（0で無効）。親がonDismissでmessageをnullにする想定 */
  autoDismissMs?: number;
  onDismiss?: () => void;
}

export default function StatusMessage({
  message,
  type,
  autoDismissMs = 4000,
  onDismiss,
}: StatusMessageProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (message && autoDismissMs > 0 && onDismiss) {
      timerRef.current = setTimeout(onDismiss, autoDismissMs);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [message, autoDismissMs, onDismiss]);

  if (!message) return null;

  const styles = type === 'success'
    ? 'border-[#22d3ee]/30 bg-[#22d3ee]/5 text-[#22d3ee]'
    : 'border-[#ef4444]/30 bg-[#ef4444]/5 text-[#ef4444]';

  return (
    <div className={`flex items-center gap-2 px-4 py-2.5 border text-xs ${styles}`}>
      {type === 'success' ? (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="square" strokeLinejoin="miter" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path strokeLinecap="square" d="M12 8v4m0 4h.01" />
        </svg>
      )}
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="閉じる"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
