'use client';

import { useState, useCallback } from 'react';

interface KeyResultInput {
  id: string;
  title: string;
  currentValue: number;
  targetValue: number;
  unit: string;
}

interface CheckinEntry {
  keyResultId: string;
  value: number;
  confidence: number;
  note: string;
  blockers: string;
}

interface CheckinFormProps {
  keyResults: KeyResultInput[];
  onSubmit?: (data: CheckinEntry[]) => void;
}

function getProgressColor(ratio: number): string {
  if (ratio >= 0.7) return 'bg-[#3b82f6]';
  if (ratio >= 0.4) return 'bg-[#22d3ee]';
  return 'bg-[#ef4444]';
}

function getConfidenceColor(value: number): string {
  if (value >= 70) return '#22d3ee';
  if (value >= 40) return '#f59e0b';
  return '#ef4444';
}

export default function CheckinForm({ keyResults, onSubmit }: CheckinFormProps) {
  const [entries, setEntries] = useState<CheckinEntry[]>(
    keyResults.map((kr) => ({
      keyResultId: kr.id,
      value: kr.currentValue,
      confidence: 50,
      note: '',
      blockers: '',
    }))
  );

  const updateEntry = useCallback(
    (index: number, field: keyof CheckinEntry, fieldValue: string | number) => {
      setEntries((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: fieldValue };
        return next;
      });
    },
    []
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit?.(entries);
    },
    [entries, onSubmit]
  );

  return (
    <form onSubmit={handleSubmit} className="border border-[#1a1a1a] bg-[#0a0a0a]">
      <div className="border-b border-[#1a1a1a] px-4 py-3">
        <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
          週次チェックイン
        </h3>
      </div>
      <div className="divide-y divide-[#111111]">
        {keyResults.map((kr, index) => {
          const entry = entries[index];
          const ratio = kr.targetValue === 0 ? 0 : Math.min(entry.value / kr.targetValue, 1);
          const percent = Math.round(ratio * 100);

          return (
            <div key={kr.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm text-[#e5e5e5] font-medium">{kr.title}</h4>
                <span className="text-xs text-[#737373] whitespace-nowrap">
                  目標: {kr.targetValue} {kr.unit}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#737373] mb-1">
                    進捗値 ({kr.unit})
                  </label>
                  <input
                    type="number"
                    value={entry.value}
                    onChange={(e) =>
                      updateEntry(index, 'value', Number(e.target.value))
                    }
                    className="w-full bg-[#111111] border border-[#333333] px-3 py-2 text-sm text-[#e5e5e5] focus:border-[#3b82f6] focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#737373] mb-1">
                    自信度: {entry.confidence}%
                  </label>
                  <div className="relative h-2 bg-[#1a1a1a] mt-3">
                    <div
                      className="absolute top-0 left-0 h-full transition-all"
                      style={{
                        width: `${entry.confidence}%`,
                        backgroundColor: getConfidenceColor(entry.confidence),
                      }}
                    />
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={entry.confidence}
                      onChange={(e) =>
                        updateEntry(index, 'confidence', Number(e.target.value))
                      }
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      aria-label="自信度"
                    />
                  </div>
                </div>
              </div>

              <div className="h-1.5 bg-[#1a1a1a]">
                <div
                  className={`h-full transition-all ${getProgressColor(ratio)}`}
                  style={{ width: `${percent}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#737373] mb-1">
                    コメント
                  </label>
                  <textarea
                    value={entry.note}
                    onChange={(e) => updateEntry(index, 'note', e.target.value)}
                    rows={2}
                    className="w-full bg-[#111111] border border-[#333333] px-3 py-2 text-sm text-[#e5e5e5] focus:border-[#3b82f6] focus:outline-none transition-colors resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#737373] mb-1">
                    ブロッカー
                  </label>
                  <textarea
                    value={entry.blockers}
                    onChange={(e) =>
                      updateEntry(index, 'blockers', e.target.value)
                    }
                    rows={2}
                    className="w-full bg-[#111111] border border-[#333333] px-3 py-2 text-sm text-[#e5e5e5] focus:border-[#3b82f6] focus:outline-none transition-colors resize-none"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {onSubmit && (
        <div className="border-t border-[#1a1a1a] px-4 py-3 flex justify-end">
          <button
            type="submit"
            className="px-6 py-2 bg-[#3b82f6] text-[#050505] text-sm font-bold uppercase tracking-wider hover:bg-[#2563eb] transition-colors"
          >
            チェックイン送信
          </button>
        </div>
      )}
    </form>
  );
}
