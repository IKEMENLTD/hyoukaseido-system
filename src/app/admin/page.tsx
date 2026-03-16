// =============================================================================
// 管理メニュー ハブページ
// 管理者向け各種設定・管理ページへのナビゲーション
// =============================================================================

import Link from 'next/link';
import { getCurrentMember } from '@/lib/auth/get-member';

const adminSections: Array<{
  href: string;
  title: string;
  description: string;
  icon: string;
}> = [
  {
    href: '/admin/members',
    title: 'メンバー管理',
    description: 'メンバーの追加、編集、無効化',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  },
  {
    href: '/admin/divisions',
    title: '事業部管理',
    description: '事業部の追加、編集、フェーズ切り替え',
    icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  },
  {
    href: '/admin/kpi-templates',
    title: 'KPIテンプレート',
    description: '事業部x職種別のKPI項目テンプレート管理',
    icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    href: '/admin/eval-periods',
    title: '評価期間管理',
    description: '評価期間の作成、ステータス管理',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    href: '/admin/okr-periods',
    title: 'OKR期間管理',
    description: '四半期OKR期間の作成と管理',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    href: '/admin/financials',
    title: '財務データ',
    description: '事業部別の月次売上・原価・販管費',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    href: '/admin/notifications',
    title: '通知管理',
    description: 'システム通知の設定と送信',
    icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  },
  {
    href: '/admin/settings',
    title: 'システム設定',
    description: '全社設定、等級定義、バリュー項目',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  },
];

export default async function AdminPage() {
  const member = await getCurrentMember();
  if (!member || !['G4', 'G5'].includes(member.grade)) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 sm:p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">アクセス権限がありません</h2>
          <p className="text-sm text-[#737373]">
            管理機能はG4以上の等級のメンバーのみ利用できます。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* ページヘッダー */}
        <div>
          <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
            管理メニュー
          </h1>
          <p className="text-sm text-[#737373] mt-1">
            システム管理・各種マスタ設定
          </p>
        </div>

        {/* 管理メニューグリッド */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {adminSections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="border border-[#1a1a1a] bg-[#0a0a0a] p-5 hover:border-[#3b82f6] transition-colors group"
            >
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 shrink-0 text-[#737373] group-hover:text-[#3b82f6] transition-colors mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="square"
                    strokeLinejoin="miter"
                    d={section.icon}
                  />
                </svg>
                <div>
                  <h3 className="text-sm font-bold text-[#e5e5e5] group-hover:text-[#3b82f6] transition-colors">
                    {section.title}
                  </h3>
                  <p className="text-xs text-[#737373] mt-1">
                    {section.description}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
