'use client';

import { useState, useEffect } from 'react';

interface PhaseInfo {
  id: string;
  title: string;
  color: string;
}

interface GuideFilterProps {
  phases: PhaseInfo[];
  userRole: 'admin' | 'manager' | 'all';
}

export default function GuideFilter({ phases, userRole }: GuideFilterProps) {
  const [showMyOnly, setShowMyOnly] = useState(userRole === 'all');

  // フィルタ切り替え時にCSSクラスで表示制御
  useEffect(() => {
    const steps = document.querySelectorAll('.guide-step');
    steps.forEach((step) => {
      const el = step as HTMLElement;
      const who = el.dataset.who;
      if (showMyOnly) {
        // 自分に関係ないステップを非表示
        const isForMe =
          who === 'all' ||
          (userRole === 'manager' && who !== 'admin') ||
          userRole === 'admin';
        el.style.display = isForMe ? '' : 'none';
      } else {
        el.style.display = '';
      }
    });
  }, [showMyOnly, userRole]);

  return (
    <div className="space-y-3">
      {/* フィルタトグル */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          {phases.map((phase, i) => (
            <div key={phase.id} className="flex items-center gap-1.5">
              <a
                href={`#${phase.id}`}
                className={`px-2 py-1 border ${phase.color} text-[11px] text-[#e5e5e5] hover:bg-[#111111] transition-colors`}
              >
                {phase.title}
              </a>
              {i < phases.length - 1 && (
                <span className="text-[#333333] text-xs hidden sm:inline">{'>'}</span>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowMyOnly(!showMyOnly)}
          className={`flex-shrink-0 px-3 py-1.5 border text-[11px] font-bold transition-colors ${
            showMyOnly
              ? 'border-[#3b82f6] text-[#3b82f6] bg-[#3b82f6]/10'
              : 'border-[#333333] text-[#737373] hover:border-[#555555]'
          }`}
        >
          {showMyOnly ? '自分のステップのみ' : '全ステップ表示'}
        </button>
      </div>

      {/* 凡例 */}
      <div className="flex items-center gap-4 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 border border-[#22d3ee] text-[#22d3ee] font-bold">全社員</span>
          <span className="text-[#737373]">全員対象</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 border border-[#a855f7] text-[#a855f7] font-bold">G3+</span>
          <span className="text-[#737373]">マネージャー以上</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 border border-[#f59e0b] text-[#f59e0b] font-bold">G4/G5</span>
          <span className="text-[#737373]">管理者のみ</span>
        </div>
      </div>
    </div>
  );
}
