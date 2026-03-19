// =============================================================================
// 個人評価結果CSV出力ボタン (Client Component)
// =============================================================================

'use client';

import { useCallback } from 'react';
import { downloadCSV } from '@/lib/utils/csv-export';

// -----------------------------------------------------------------------------
// 型定義
// -----------------------------------------------------------------------------

interface KpiDetail {
  name: string;
  targetValue: string;
  actualValue: string;
  achievementRate: string;
}

interface ResultCsvButtonProps {
  periodName: string;
  grade: string;
  totalScore: string;
  rank: string;
  quantitativeScore: string;
  qualitativeScore: string;
  valueScore: string;
  salaryChange: string;
  promotionEligibility: string;
  kpiDetails: KpiDetail[];
}

// -----------------------------------------------------------------------------
// コンポーネント
// -----------------------------------------------------------------------------

export default function ResultCsvButton({
  periodName,
  grade,
  totalScore,
  rank,
  quantitativeScore,
  qualitativeScore,
  valueScore,
  salaryChange,
  promotionEligibility,
  kpiDetails,
}: ResultCsvButtonProps) {
  const handleExport = useCallback(() => {
    const headers = ['項目', 'スコア/値', '備考'];

    const rows: string[][] = [
      ['総合スコア', totalScore, ''],
      ['ランク', rank, ''],
      ['等級', grade, ''],
      ['定量KPIスコア', quantitativeScore, ''],
      ['定性スコア', qualitativeScore, ''],
      ['バリュースコア', valueScore, ''],
    ];

    // KPI詳細行
    for (const kpi of kpiDetails) {
      rows.push([
        `KPI: ${kpi.name}`,
        `目標${kpi.targetValue} / 実績${kpi.actualValue}`,
        `達成率${kpi.achievementRate}%`,
      ]);
    }

    rows.push(['昇給額', `${salaryChange}円`, '']);
    rows.push(['昇格適格性', promotionEligibility, '']);

    const today = new Date().toISOString().slice(0, 10);
    const filename = `個人評価結果_${periodName}_${today}.csv`;
    downloadCSV(filename, headers, rows);
  }, [
    periodName, grade, totalScore, rank,
    quantitativeScore, qualitativeScore, valueScore,
    salaryChange, promotionEligibility, kpiDetails,
  ]);

  return (
    <button
      type="button"
      onClick={handleExport}
      className="no-print px-4 py-2 border border-[#333333] text-xs text-[#a3a3a3] font-bold hover:text-[#e5e5e5] hover:border-[#555555] transition-colors"
    >
      <span className="flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="square" strokeLinejoin="miter" d="M12 5v14m0 0l-6-6m6 6l6-6M5 19h14" />
        </svg>
        CSV出力
      </span>
    </button>
  );
}
