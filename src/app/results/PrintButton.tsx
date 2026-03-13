// =============================================================================
// PDF出力ボタン (Client Component)
// ブラウザの印刷ダイアログ → PDF保存
// =============================================================================

'use client';

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print px-4 py-2 border border-[#3b82f6] text-xs text-[#3b82f6] font-bold hover:bg-[#3b82f6]/10"
    >
      <span className="flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="square" strokeLinejoin="miter" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
        PDF出力
      </span>
    </button>
  );
}
