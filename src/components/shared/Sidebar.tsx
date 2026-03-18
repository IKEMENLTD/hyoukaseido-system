'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

interface SidebarProps {
  navItems: NavItem[];
  userInfo?: { name: string; email: string } | null;
}

// サイドバーを非表示にするパス
const AUTH_PATHS = ['/login'];

export default function Sidebar({ navItems, userInfo }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isAuthPage = AUTH_PATHS.includes(pathname);

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

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/login');
    } catch {
      setLoggingOut(false);
    }
  };

  // 認証ページではサイドバー・モバイルヘッダーを一切表示しない
  if (isAuthPage) {
    return null;
  }

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
        {userInfo && (
          <span className="text-xs text-[#a3a3a3] truncate max-w-[140px]">
            {userInfo.name}
          </span>
        )}
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

        {/* ユーザー情報 + ログアウト */}
        <div className="border-t border-white/10">
          {userInfo ? (
            <div className="px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 shrink-0 border border-[#333333] bg-[#0a0a0a] flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#737373]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="square" strokeLinejoin="miter" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#e5e5e5] truncate">{userInfo.name}</p>
                  <p className="text-[10px] text-[#737373] truncate">{userInfo.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs text-[#737373] border border-[#1a1a1a] hover:text-[#ef4444] hover:border-[#ef4444]/30 transition-colors disabled:opacity-50"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="square" strokeLinejoin="miter" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                {loggingOut ? 'ログアウト中...' : 'ログアウト'}
              </button>
            </div>
          ) : (
            <div className="px-4 py-3 text-[10px] text-white/30">
              イケメングループ
            </div>
          )}
        </div>
      </nav>

      {/* モバイルヘッダー分のスペーサー (lg未満でコンテンツが被らないよう) */}
      <div className="lg:hidden h-[52px] shrink-0" />
    </>
  );
}
