'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

interface SidebarProps {
  navItems: NavItem[];
}

export default function Sidebar({ navItems }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // ページ遷移時にメニューを閉じる
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // メニューが開いているときにbodyスクロールを防止
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* モバイルヘッダー (lg未満で表示) */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-[#050505] border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="p-1.5 -ml-1.5 text-white/70 hover:text-white transition-colors"
            aria-label="メニューを開く"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="square" strokeLinejoin="miter" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-sm font-bold tracking-wide text-[#3b82f6]">
            評価制度システム
          </span>
        </div>
      </div>

      {/* モバイルオーバーレイ */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-[60] bg-black/60"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* サイドバー本体 */}
      <nav
        className={`
          fixed top-0 left-0 h-full z-[60] w-60 bg-[#050505] border-r border-white/10 flex flex-col
          transition-transform duration-200 ease-out
          lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shrink-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* ロゴ + 閉じるボタン */}
        <div className="px-4 py-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold tracking-wide text-[#3b82f6]">
              評価制度システム
            </h1>
            <p className="text-[10px] text-white/40 mt-0.5">v2.0</p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-1 text-white/40 hover:text-white transition-colors"
            aria-label="メニューを閉じる"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="square" strokeLinejoin="miter" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ナビゲーション */}
        <ul className="flex-1 py-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                    isActive
                      ? 'text-[#3b82f6] bg-[#3b82f6]/5 border-r-2 border-[#3b82f6]'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <svg
                    className="w-4 h-4 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="square"
                      strokeLinejoin="miter"
                      d={item.icon}
                    />
                  </svg>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="px-4 py-3 border-t border-white/10 text-[10px] text-white/30">
          イケメングループ
        </div>
      </nav>

      {/* モバイルヘッダー分のスペーサー (lg未満でコンテンツが被らないよう) */}
      <div className="lg:hidden h-[52px] shrink-0" />
    </>
  );
}
