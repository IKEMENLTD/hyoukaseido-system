'use client';

import type { Grade } from '@/types/evaluation';

interface GradeBarProps {
  grade: Grade;
}

const GRADES: Grade[] = ['G1', 'G2', 'G3', 'G4', 'G5'];

const GRADE_LABELS: Record<Grade, string> = {
  G1: 'メンバー',
  G2: 'シニア',
  G3: 'マネージャー',
  G4: '部長',
  G5: '代表',
};

export default function GradeBar({ grade }: GradeBarProps) {
  return (
    <div className="flex items-center gap-0">
      {GRADES.map((g) => {
        const isActive = g === grade;
        const gradeNum = parseInt(g.slice(1), 10);
        const currentNum = parseInt(grade.slice(1), 10);
        const isPassed = gradeNum <= currentNum;

        return (
          <div
            key={g}
            className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 border transition-colors ${
              isActive
                ? 'border-[#3b82f6] bg-[#3b82f6]/10'
                : isPassed
                  ? 'border-[#333333] bg-[#111111]'
                  : 'border-[#1a1a1a] bg-transparent'
            }`}
          >
            <span
              className={`text-sm font-bold ${
                isActive
                  ? 'text-[#3b82f6]'
                  : isPassed
                    ? 'text-[#a3a3a3]'
                    : 'text-[#404040]'
              }`}
            >
              {g}
            </span>
            <span
              className={`text-xs ${
                isActive
                  ? 'text-[#3b82f6]'
                  : isPassed
                    ? 'text-[#737373]'
                    : 'text-[#333333]'
              }`}
            >
              {GRADE_LABELS[g]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
