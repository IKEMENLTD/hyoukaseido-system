'use client';

import type { Phase } from '@/types/evaluation';

interface DivisionData {
  name: string;
  memberCount: number;
  averageScore: number;
  phase: Phase;
  kpiAchievement: string;
}

interface DivisionComparisonProps {
  divisions: DivisionData[];
}

const PHASE_LABELS: Record<Phase, { text: string; color: string }> = {
  profitable: { text: '黒字', color: 'text-[#22d3ee]' },
  investing: { text: '赤字', color: 'text-[#ef4444]' },
};

export default function DivisionComparison({ divisions }: DivisionComparisonProps) {
  return (
    <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
      <div className="border-b border-[#1a1a1a] px-4 py-3">
        <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
          事業部比較
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a1a1a] text-[#737373]">
              <th className="px-4 py-2 text-left font-medium">事業部</th>
              <th className="px-4 py-2 text-right font-medium">人数</th>
              <th className="px-4 py-2 text-right font-medium">平均スコア</th>
              <th className="px-4 py-2 text-center font-medium">フェーズ</th>
              <th className="px-4 py-2 text-right font-medium">KPI達成率</th>
            </tr>
          </thead>
          <tbody>
            {divisions.map((div, index) => {
              const phaseConfig = PHASE_LABELS[div.phase];
              return (
                <tr
                  key={index}
                  className="border-b border-[#111111] hover:bg-[#111111] transition-colors"
                >
                  <td className="px-4 py-3 text-[#e5e5e5] font-medium">
                    {div.name}
                  </td>
                  <td className="px-4 py-3 text-right text-[#a3a3a3]">
                    {div.memberCount}名
                  </td>
                  <td className="px-4 py-3 text-right text-[#e5e5e5] font-bold">
                    {div.averageScore.toFixed(1)}
                  </td>
                  <td className={`px-4 py-3 text-center font-bold ${phaseConfig.color}`}>
                    {phaseConfig.text}
                  </td>
                  <td className="px-4 py-3 text-right text-[#a3a3a3]">
                    {div.kpiAchievement}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
