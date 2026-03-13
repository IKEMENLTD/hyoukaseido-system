'use client';

interface KeyResultData {
  id: string;
  title: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  confidence: number;
}

interface ObjectiveData {
  id: string;
  title: string;
  level: 'company' | 'division' | 'individual';
  memberName?: string;
  keyResults: KeyResultData[];
}

interface OKRTreeProps {
  objectives: ObjectiveData[];
}

const LEVEL_CONFIG: Record<string, { label: string; color: string; borderColor: string }> = {
  company: {
    label: '全社',
    color: 'text-[#3b82f6]',
    borderColor: 'border-l-[#3b82f6]',
  },
  division: {
    label: '事業部',
    color: 'text-[#22d3ee]',
    borderColor: 'border-l-[#22d3ee]',
  },
  individual: {
    label: '個人',
    color: 'text-[#a3a3a3]',
    borderColor: 'border-l-[#a3a3a3]',
  },
};

function getProgressColor(ratio: number): string {
  if (ratio >= 0.7) return 'bg-[#3b82f6]';
  if (ratio >= 0.4) return 'bg-[#22d3ee]';
  return 'bg-[#ef4444]';
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 70) return 'text-[#22d3ee]';
  if (confidence >= 40) return 'text-[#f59e0b]';
  return 'text-[#ef4444]';
}

function ProgressBar({ current, target }: { current: number; target: number }) {
  const ratio = target === 0 ? 0 : Math.min(current / target, 1);
  const percent = Math.round(ratio * 100);

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-[#1a1a1a]">
        <div
          className={`h-full transition-all ${getProgressColor(ratio)}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-[#a3a3a3] w-10 text-right">{percent}%</span>
    </div>
  );
}

export default function OKRTree({ objectives }: OKRTreeProps) {
  const grouped = {
    company: objectives.filter((o) => o.level === 'company'),
    division: objectives.filter((o) => o.level === 'division'),
    individual: objectives.filter((o) => o.level === 'individual'),
  };

  const levels: Array<'company' | 'division' | 'individual'> = ['company', 'division', 'individual'];

  return (
    <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
      <div className="border-b border-[#1a1a1a] px-4 py-3">
        <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
          OKR ツリー
        </h3>
      </div>
      <div className="divide-y divide-[#1a1a1a]">
        {levels.map((level) => {
          const objs = grouped[level];
          if (objs.length === 0) return null;
          const config = LEVEL_CONFIG[level];

          return (
            <div key={level} className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <span
                  className={`px-2 py-0.5 border border-current text-xs font-bold uppercase ${config.color}`}
                >
                  {config.label}
                </span>
              </div>
              <div className="space-y-3">
                {objs.map((obj) => (
                  <div
                    key={obj.id}
                    className={`border-l-2 ${config.borderColor} pl-4`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[#e5e5e5] font-medium text-sm">
                        {obj.title}
                      </span>
                      {obj.memberName && (
                        <span className="text-xs text-[#737373]">
                          ({obj.memberName})
                        </span>
                      )}
                    </div>
                    <div className="space-y-2 ml-2">
                      {obj.keyResults.map((kr) => (
                        <div key={kr.id} className="flex items-center gap-3">
                          <span className="text-xs text-[#737373] min-w-0 flex-shrink-0 w-4">
                            KR
                          </span>
                          <span className="text-xs text-[#a3a3a3] min-w-0 flex-1 truncate">
                            {kr.title}
                          </span>
                          <div className="w-32 flex-shrink-0">
                            <ProgressBar
                              current={kr.currentValue}
                              target={kr.targetValue}
                            />
                          </div>
                          <span className="text-xs text-[#737373] flex-shrink-0 w-20 text-right">
                            {kr.currentValue}/{kr.targetValue} {kr.unit}
                          </span>
                          <span
                            className={`text-xs font-medium flex-shrink-0 w-10 text-right ${getConfidenceColor(kr.confidence)}`}
                          >
                            {kr.confidence}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
