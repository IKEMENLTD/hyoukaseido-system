'use client';

import type { Rank } from '@/types/evaluation';

interface EvalRankBadgeProps {
  rank: Rank;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const RANK_STYLES: Record<Rank, { bg: string; text: string; border: string }> = {
  S: { bg: 'bg-[#3b82f6]/15', text: 'text-[#3b82f6]', border: 'border-[#3b82f6]' },
  A: { bg: 'bg-[#22d3ee]/15', text: 'text-[#22d3ee]', border: 'border-[#22d3ee]' },
  B: { bg: 'bg-[#a3a3a3]/15', text: 'text-[#a3a3a3]', border: 'border-[#a3a3a3]' },
  C: { bg: 'bg-[#f59e0b]/15', text: 'text-[#f59e0b]', border: 'border-[#f59e0b]' },
  D: { bg: 'bg-[#ef4444]/15', text: 'text-[#ef4444]', border: 'border-[#ef4444]' },
};

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg' | 'xl', string> = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-20 h-20 text-3xl border-2',
};

export default function EvalRankBadge({ rank, size = 'md' }: EvalRankBadgeProps) {
  const style = RANK_STYLES[rank];
  const sizeClass = SIZE_CLASSES[size];

  return (
    <span
      className={`inline-flex items-center justify-center border font-bold ${style.bg} ${style.text} ${style.border} ${sizeClass}`}
    >
      {rank}
    </span>
  );
}
