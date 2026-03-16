'use client';

import type { Rank } from '@/types/evaluation';

interface CompanyOverviewData {
  totalMembers: number;
  averageScore: number;
  rankDistribution: Record<Rank, number>;
  promotionCandidates: number;
  improvementNeeded: number;
  evalPeriodName: string;
  evalPeriodStatus: string;
}

interface CompanyOverviewProps {
  data: CompanyOverviewData;
}

const RANK_ORDER: Rank[] = ['S', 'A', 'B', 'C', 'D'];

const RANK_COLORS: Record<Rank, string> = {
  S: 'bg-[#3b82f6]',
  A: 'bg-[#22d3ee]',
  B: 'bg-[#a3a3a3]',
  C: 'bg-[#f59e0b]',
  D: 'bg-[#ef4444]',
};

function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
      <div className="text-xs text-[#737373] uppercase tracking-wider mb-2">
        {label}
      </div>
      <div
        className={`text-2xl font-bold ${accent ? 'text-[#3b82f6]' : 'text-[#e5e5e5]'}`}
      >
        {value}
      </div>
    </div>
  );
}

export default function CompanyOverview({ data }: CompanyOverviewProps) {
  const maxRankCount = Math.max(...RANK_ORDER.map((r) => data.rankDistribution[r] || 0), 1);

  return (
    <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
      <div className="border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
          全社サマリー
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#737373]">{data.evalPeriodName}</span>
          <span className="px-2 py-0.5 border border-[#333333] text-xs text-[#a3a3a3]">
            {data.evalPeriodStatus}
          </span>
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="総人数" value={data.totalMembers} />
        <StatCard label="平均スコア" value={data.averageScore.toFixed(1)} accent />
        <StatCard label="昇格候補" value={data.promotionCandidates} />
        <StatCard label="要改善" value={data.improvementNeeded} />
      </div>

      <div className="border-t border-[#1a1a1a] px-4 py-4">
        <div className="text-xs text-[#737373] uppercase tracking-wider mb-3">
          ランク分布
        </div>
        <div className="flex items-end gap-2 h-24">
          {RANK_ORDER.map((rank) => {
            const count = data.rankDistribution[rank] || 0;
            const height = maxRankCount === 0 ? 0 : (count / maxRankCount) * 100;
            return (
              <div key={rank} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-[#a3a3a3] font-medium">{count}</span>
                <div className="w-full relative" style={{ height: '64px' }}>
                  <div
                    className={`absolute bottom-0 w-full ${RANK_COLORS[rank]} transition-all`}
                    style={{ height: `${height}%` }}
                  />
                </div>
                <span className="text-xs text-[#737373] font-bold">{rank}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
