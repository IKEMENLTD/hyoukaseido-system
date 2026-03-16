'use client';

// =============================================================================
// 事業部別財務データ管理 Client Component
// 月次入力グリッド + 四半期サマリー + 保存
// =============================================================================

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { saveDivisionFinancials } from '@/lib/financials/actions';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface Division {
  id: string;
  name: string;
  phase: string;
}

interface FinancialData {
  id: string;
  divisionId: string;
  fiscalYear: number;
  month: number;
  revenue: number;
  cost: number;
  grossProfit: number;
  operatingCost: number;
  netProfit: number;
  note: string | null;
}

interface FinancialsManagerProps {
  divisions: Division[];
  existingData: FinancialData[];
  currentYear: number;
  currentMonth: number;
}

interface CellState {
  revenue: string;
  cost: string;
  operatingCost: string;
  note: string;
}

type CellKey = `${string}_${number}_${number}`; // divisionId_year_month

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function formatYen(value: number): string {
  if (value === 0) return '---';
  const absVal = Math.abs(value);
  if (absVal >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}億`;
  if (absVal >= 10_000) return `${(value / 10_000).toFixed(0)}万`;
  return value.toLocaleString();
}

function cellKey(divisionId: string, year: number, month: number): CellKey {
  return `${divisionId}_${year}_${month}`;
}

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------

export default function FinancialsManager({
  divisions,
  existingData,
  currentYear,
  currentMonth,
}: FinancialsManagerProps) {
  const router = useRouter();

  // 表示対象の年・月
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 入力状態 (全事業部の選択月分)
  const [cells, setCells] = useState<Record<CellKey, CellState>>(() => {
    const initial: Record<CellKey, CellState> = {};
    for (const div of divisions) {
      const existing = existingData.find(
        (d) => d.divisionId === div.id && d.fiscalYear === currentYear && d.month === currentMonth
      );
      const key = cellKey(div.id, currentYear, currentMonth);
      initial[key] = {
        revenue: existing ? String(existing.revenue) : '',
        cost: existing ? String(existing.cost) : '',
        operatingCost: existing ? String(existing.operatingCost) : '',
        note: existing?.note ?? '',
      };
    }
    return initial;
  });

  // 年・月が変わったら入力状態をリセット
  const handlePeriodChange = useCallback(
    (year: number, month: number) => {
      setSelectedYear(year);
      setSelectedMonth(month);
      setMessage(null);
      const newCells: Record<CellKey, CellState> = {};
      for (const div of divisions) {
        const existing = existingData.find(
          (d) => d.divisionId === div.id && d.fiscalYear === year && d.month === month
        );
        const key = cellKey(div.id, year, month);
        newCells[key] = {
          revenue: existing ? String(existing.revenue) : '',
          cost: existing ? String(existing.cost) : '',
          operatingCost: existing ? String(existing.operatingCost) : '',
          note: existing?.note ?? '',
        };
      }
      setCells(newCells);
    },
    [divisions, existingData]
  );

  const updateCell = useCallback(
    (divisionId: string, field: keyof CellState, value: string) => {
      const key = cellKey(divisionId, selectedYear, selectedMonth);
      setCells((prev) => ({
        ...prev,
        [key]: { ...prev[key], [field]: value },
      }));
    },
    [selectedYear, selectedMonth]
  );

  // 四半期サマリー (選択年の全データを集計)
  const quarterlySummary = useMemo(() => {
    const quarters: Record<string, { revenue: number; cost: number; operatingCost: number; netProfit: number }> = {};
    for (const div of divisions) {
      for (let q = 1; q <= 4; q++) {
        const months = q === 1 ? [4, 5, 6] : q === 2 ? [7, 8, 9] : q === 3 ? [10, 11, 12] : [1, 2, 3];
        const qYear = q === 4 ? selectedYear + 1 : selectedYear;
        let rev = 0, cost = 0, opCost = 0;
        let hasData = false;
        for (const m of months) {
          const d = existingData.find(
            (f) => f.divisionId === div.id && f.fiscalYear === qYear && f.month === m
          );
          if (d) {
            rev += d.revenue;
            cost += d.cost;
            opCost += d.operatingCost;
            hasData = true;
          }
        }
        if (hasData) {
          const qKey = `${div.id}_Q${q}`;
          quarters[qKey] = { revenue: rev, cost, operatingCost: opCost, netProfit: rev - cost - opCost };
        }
      }
    }
    return quarters;
  }, [divisions, existingData, selectedYear]);

  // 保存
  const handleSave = useCallback(async () => {
    setSaving(true);
    setMessage(null);

    const inputs = divisions
      .map((div) => {
        const key = cellKey(div.id, selectedYear, selectedMonth);
        const cell = cells[key];
        if (!cell) return null;
        const revenue = parseInt(cell.revenue, 10);
        const cost = parseInt(cell.cost, 10);
        const operatingCost = parseInt(cell.operatingCost, 10);
        // 全て空ならスキップ
        if (isNaN(revenue) && isNaN(cost) && isNaN(operatingCost)) return null;
        return {
          division_id: div.id,
          fiscal_year: selectedYear,
          month: selectedMonth,
          revenue: isNaN(revenue) ? 0 : revenue,
          cost: isNaN(cost) ? 0 : cost,
          operating_cost: isNaN(operatingCost) ? 0 : operatingCost,
          note: cell.note || null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (inputs.length === 0) {
      setMessage({ type: 'error', text: '保存するデータがありません' });
      setSaving(false);
      return;
    }

    const result = await saveDivisionFinancials(inputs);
    setSaving(false);

    if (result.success) {
      setMessage({ type: 'success', text: `${selectedYear}年${selectedMonth}月のデータを保存しました` });
      // Server Componentを再取得してpropsを更新
      router.refresh();
      // 保存した値でcellsを更新（propsリフレッシュまでの間の整合性確保）
      for (const input of inputs) {
        const key = cellKey(input.division_id, input.fiscal_year, input.month);
        setCells((prev) => ({
          ...prev,
          [key]: {
            revenue: String(input.revenue),
            cost: String(input.cost),
            operatingCost: String(input.operating_cost),
            note: input.note ?? '',
          },
        }));
      }
    } else {
      setMessage({ type: 'error', text: result.error ?? '保存に失敗しました' });
    }
  }, [divisions, cells, selectedYear, selectedMonth, router]);

  // 年選択肢
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
              事業部別財務データ
            </h1>
            <p className="text-sm text-[#737373] mt-1">
              月次の売上・原価・販管費を事業部ごとに入力
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`px-6 py-2 text-sm font-bold uppercase tracking-wider transition-colors ${
              saving
                ? 'bg-[#333333] text-[#737373] cursor-not-allowed'
                : 'bg-[#3b82f6] text-[#050505] hover:bg-[#2563eb]'
            }`}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>

        {/* メッセージ */}
        {message && (
          <div className={`border px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'border-[#22d3ee] text-[#22d3ee]'
              : 'border-[#ef4444] text-[#ef4444]'
          }`}>
            {message.text}
          </div>
        )}

        {/* 期間セレクター */}
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-[10px] text-[#737373] uppercase tracking-wider mb-1">年</label>
            <select
              value={selectedYear}
              onChange={(e) => handlePeriodChange(Number(e.target.value), selectedMonth)}
              className="bg-[#0a0a0a] border border-[#333333] text-[#e5e5e5] text-sm px-3 py-2 focus:border-[#3b82f6] outline-none"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}年</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-[#737373] uppercase tracking-wider mb-1">月</label>
            <div className="flex gap-1">
              {MONTH_LABELS.map((label, i) => {
                const m = i + 1;
                const isSelected = selectedMonth === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handlePeriodChange(selectedYear, m)}
                    className={`px-2 py-1 text-[10px] font-bold transition-colors ${
                      isSelected
                        ? 'bg-[#3b82f6] text-[#050505]'
                        : 'border border-[#1a1a1a] text-[#737373] hover:border-[#333333]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 入力グリッド */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="border-b border-[#1a1a1a] px-4 py-3">
            <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
              {selectedYear}年{selectedMonth}月 入力
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a1a1a] text-[#737373]">
                  <th className="px-4 py-2 text-left font-medium">事業部</th>
                  <th className="px-4 py-2 text-left font-medium">フェーズ</th>
                  <th className="px-4 py-2 text-right font-medium">売上 (円)</th>
                  <th className="px-4 py-2 text-right font-medium">原価 (円)</th>
                  <th className="px-4 py-2 text-right font-medium">販管費 (円)</th>
                  <th className="px-4 py-2 text-right font-medium">粗利</th>
                  <th className="px-4 py-2 text-right font-medium">営業利益</th>
                  <th className="px-4 py-2 text-left font-medium">備考</th>
                </tr>
              </thead>
              <tbody>
                {divisions.map((div) => {
                  const key = cellKey(div.id, selectedYear, selectedMonth);
                  const cell = cells[key] ?? { revenue: '', cost: '', operatingCost: '', note: '' };
                  const rev = parseInt(cell.revenue, 10) || 0;
                  const cost = parseInt(cell.cost, 10) || 0;
                  const opCost = parseInt(cell.operatingCost, 10) || 0;
                  const grossProfit = rev - cost;
                  const netProfit = grossProfit - opCost;

                  return (
                    <tr key={div.id} className="border-b border-[#111111] hover:bg-[#111111] transition-colors">
                      <td className="px-4 py-3 text-[#e5e5e5] font-medium">{div.name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 border text-[10px] font-bold ${
                          div.phase === 'profitable'
                            ? 'text-[#22d3ee] border-[#22d3ee]'
                            : 'text-[#f59e0b] border-[#f59e0b]'
                        }`}>
                          {div.phase === 'profitable' ? '黒字' : '赤字'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={cell.revenue}
                          onChange={(e) => updateCell(div.id, 'revenue', e.target.value)}
                          placeholder="0"
                          className="w-28 bg-[#111111] border border-[#333333] text-[#e5e5e5] text-right px-2 py-1 text-xs focus:border-[#3b82f6] outline-none"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={cell.cost}
                          onChange={(e) => updateCell(div.id, 'cost', e.target.value)}
                          placeholder="0"
                          className="w-28 bg-[#111111] border border-[#333333] text-[#e5e5e5] text-right px-2 py-1 text-xs focus:border-[#3b82f6] outline-none"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={cell.operatingCost}
                          onChange={(e) => updateCell(div.id, 'operatingCost', e.target.value)}
                          placeholder="0"
                          className="w-28 bg-[#111111] border border-[#333333] text-[#e5e5e5] text-right px-2 py-1 text-xs focus:border-[#3b82f6] outline-none"
                        />
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-bold">
                        {cell.revenue || cell.cost ? (
                          <span className={grossProfit >= 0 ? 'text-[#22d3ee]' : 'text-[#ef4444]'}>
                            {formatYen(grossProfit)}
                          </span>
                        ) : (
                          <span className="text-[#404040]">---</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-bold">
                        {cell.revenue || cell.cost || cell.operatingCost ? (
                          <span className={netProfit >= 0 ? 'text-[#22d3ee]' : 'text-[#ef4444]'}>
                            {formatYen(netProfit)}
                          </span>
                        ) : (
                          <span className="text-[#404040]">---</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={cell.note}
                          onChange={(e) => updateCell(div.id, 'note', e.target.value)}
                          placeholder="備考"
                          className="w-full bg-[#111111] border border-[#333333] text-[#a3a3a3] px-2 py-1 text-xs focus:border-[#3b82f6] outline-none"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 四半期サマリー */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="border-b border-[#1a1a1a] px-4 py-3">
            <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
              {selectedYear}年度 四半期サマリー
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a1a1a] text-[#737373]">
                  <th className="px-4 py-2 text-left font-medium">事業部</th>
                  {[1, 2, 3, 4].map((q) => (
                    <th key={q} className="px-4 py-2 text-right font-medium" colSpan={2}>
                      Q{q} 営業利益
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {divisions.map((div) => (
                  <tr key={div.id} className="border-b border-[#111111]">
                    <td className="px-4 py-3 text-[#e5e5e5] font-medium">{div.name}</td>
                    {[1, 2, 3, 4].map((q) => {
                      const qKey = `${div.id}_Q${q}`;
                      const data = quarterlySummary[qKey];
                      if (!data) {
                        return (
                          <td key={q} className="px-4 py-3 text-right text-xs text-[#404040]" colSpan={2}>
                            ---
                          </td>
                        );
                      }
                      return (
                        <td
                          key={q}
                          className={`px-4 py-3 text-right text-xs font-bold ${
                            data.netProfit >= 0 ? 'text-[#22d3ee]' : 'text-[#ef4444]'
                          }`}
                          colSpan={2}
                        >
                          {formatYen(data.netProfit)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
