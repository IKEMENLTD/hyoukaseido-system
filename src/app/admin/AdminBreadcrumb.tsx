'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AdminBreadcrumb() {
  const pathname = usePathname();
  const isSubPage = pathname !== '/admin';

  if (!isSubPage) return null;

  return (
    <div className="border-b border-[#1a1a1a] bg-[#050505] px-3 py-2 sm:px-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-xs text-[#737373] hover:text-[#3b82f6] transition-colors"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path
            strokeLinecap="square"
            strokeLinejoin="miter"
            d="M19 12H5M12 19l-7-7 7-7"
          />
        </svg>
        管理メニュー
      </Link>
    </div>
  );
}
