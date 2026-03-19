'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function WelcomeBanner() {
  const searchParams = useSearchParams();
  const isWelcome = searchParams.get('welcome') === '1';
  const [dismissed, setDismissed] = useState(false);

  // URLからwelcomeパラメータを除去（ブラウザ履歴を汚さない）
  useEffect(() => {
    if (isWelcome) {
      const url = new URL(window.location.href);
      url.searchParams.delete('welcome');
      window.history.replaceState({}, '', url.toString());
    }
  }, [isWelcome]);

  if (!isWelcome || dismissed) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* オーバーレイ */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={() => setDismissed(true)}
      />

      {/* ポップアップ */}
      <div className="relative z-10 w-full max-w-md border border-[#3b82f6]/30 bg-[#0a0a0a]">
        {/* ヘッダー */}
        <div className="border-b border-[#1a1a1a] px-4 py-4 sm:px-6 sm:py-5 text-center">
          <div className="text-xs text-[#3b82f6] uppercase tracking-wider mb-2">
            WELCOME
          </div>
          <h2 className="text-lg font-bold text-[#e5e5e5] tracking-wider">
            ようこそ、評価制度システムへ
          </h2>
        </div>

        {/* 本文 */}
        <div className="px-4 py-4 sm:px-6 sm:py-5 space-y-3">
          <p className="text-sm text-[#a3a3a3] leading-relaxed">
            アカウントの紐付けが完了しました。
          </p>
          <p className="text-sm text-[#a3a3a3] leading-relaxed">
            初めての方は「使い方ガイド」で、システムの全体像と操作方法を確認できます。
            1から順番にステップを進めるだけで使いこなせるようになります。
          </p>
        </div>

        {/* ボタン */}
        <div className="border-t border-[#1a1a1a] px-4 py-4 sm:px-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Link
            href="/guide"
            className="flex-1 px-4 py-2.5 bg-[#3b82f6] text-[#050505] text-sm font-bold uppercase tracking-wider text-center hover:bg-[#2563eb] transition-colors"
            onClick={() => setDismissed(true)}
          >
            使い方ガイドを見る
          </Link>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="px-4 py-2.5 border border-[#333333] text-sm text-[#a3a3a3] hover:text-[#e5e5e5] hover:border-[#555555] transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
