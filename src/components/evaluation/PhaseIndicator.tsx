'use client';

import type { Phase } from '@/types/evaluation';
import { PHASE_WEIGHTS } from '@/types/evaluation';

interface PhaseIndicatorProps {
  phase: Phase;
  showWeights?: boolean;
}

const PHASE_CONFIG: Record<Phase, { label: string; color: string; bgColor: string }> = {
  profitable: {
    label: '黒字',
    color: 'text-[#22d3ee]',
    bgColor: 'bg-[#22d3ee]/10 border-[#22d3ee]/30',
  },
  investing: {
    label: '赤字',
    color: 'text-[#ef4444]',
    bgColor: 'bg-[#ef4444]/10 border-[#ef4444]/30',
  },
};

export default function PhaseIndicator({
  phase,
  showWeights = false,
}: PhaseIndicatorProps) {
  const config = PHASE_CONFIG[phase];
  const weights = PHASE_WEIGHTS[phase];

  return (
    <div className="inline-flex items-center gap-3">
      <span
        className={`inline-flex items-center px-3 py-1 border text-xs font-bold uppercase tracking-wider ${config.bgColor} ${config.color}`}
      >
        {config.label}
      </span>
      {showWeights && (
        <div className="flex items-center gap-2 text-xs text-[#737373]">
          <span>
            定量 <span className="text-[#a3a3a3] font-medium">{weights.quantitative}%</span>
          </span>
          <span className="text-[#333333]">/</span>
          <span>
            定性 <span className="text-[#a3a3a3] font-medium">{weights.qualitative}%</span>
          </span>
          <span className="text-[#333333]">/</span>
          <span>
            バリュー <span className="text-[#a3a3a3] font-medium">{weights.value}%</span>
          </span>
        </div>
      )}
    </div>
  );
}
