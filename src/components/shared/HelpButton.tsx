// =============================================================================
// ヘルプボタン - 全ページ右下に固定表示
// 「?」アイコンをクリックするとページガイドが展開する
// =============================================================================

'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getHelpForPath, type PageHelp } from './help-data';

export default function HelpButton() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [help, setHelp] = useState<PageHelp | null>(null);

  useEffect(() => {
    setHelp(getHelpForPath(pathname));
    setIsOpen(false);
  }, [pathname]);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  // ログインページやヘルプがないページでは非表示
  if (!help) return null;

  return (
    <>
      {/* パネル */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 z-50 w-80 max-h-[70vh] border border-[#1a1a1a] bg-[#0a0a0a] flex flex-col overflow-hidden">
          {/* ヘッダー */}
          <div className="border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-sm font-bold text-[#e5e5e5]">
                {help.pageTitle}
              </h3>
              <p className="text-[10px] text-[#737373] mt-0.5">
                このページの使い方
              </p>
            </div>
            <button
              type="button"
              onClick={toggle}
              className="text-[#737373] hover:text-[#e5e5e5] transition-colors"
              aria-label="閉じる"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* コンテンツ */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {/* サマリー */}
            <p className="text-xs text-[#a3a3a3] leading-relaxed">
              {help.summary}
            </p>

            {/* ステップ */}
            <div className="space-y-2">
              {help.steps.map((step, index) => (
                <div key={index} className="flex gap-3">
                  <div className="shrink-0 w-5 h-5 border border-[#3b82f6] flex items-center justify-center mt-0.5">
                    <span className="text-[10px] font-bold text-[#3b82f6]">
                      {index + 1}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#e5e5e5]">
                      {step.title}
                    </p>
                    <p className="text-[11px] text-[#737373] leading-relaxed mt-0.5">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ボタン */}
      <button
        type="button"
        onClick={toggle}
        className={`fixed bottom-6 right-6 z-50 w-10 h-10 flex items-center justify-center border transition-colors ${
          isOpen
            ? 'border-[#3b82f6] bg-[#3b82f6] text-white'
            : 'border-[#333333] bg-[#0a0a0a] text-[#737373] hover:border-[#3b82f6] hover:text-[#3b82f6]'
        }`}
        aria-label="ヘルプ"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
          <circle cx="12" cy="17" r="0.5" fill="currentColor" />
        </svg>
      </button>
    </>
  );
}
