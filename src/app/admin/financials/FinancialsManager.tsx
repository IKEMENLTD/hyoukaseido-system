'use client';

// =============================================================================
// 事業部別財務データ管理 Client Component
// 月次入力グリッド + 四半期サマリー + 共通固定費 + 全社サマリー + 保存
// =============================================================================

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { saveDivisionFinancials, saveSharedCosts } from '@/lib/financials/actions';

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

interface SharedCostData {
  id: string;
  category: string;
  label: string;
  amount: number;
  isLoan: boolean;
  fiscalYear: number;
  month: number;
  note: string | null;
}

interface SharedCostItem {
  id?: string;
  tempId: string;
  category: string;
  label: string;
  amount: string;
  isLoan: boolean;
  note: string;
}

const SHARED_COST_CATEGORIES = [
  { value: 'rent', label: '家賃' },
  { value: 'personnel', label: '人件費' },
  { value: 'entertainment', label: '接待交際費' },
  { value: 'consulting', label: '顧問料' },
  { value: 'loan_repayment', label: '借入金返済' },
  { value: 'interest', label: '利息' },
  { value: 'other', label: 'その他' },
] as const;

const LOAN_CATEGORIES = new Set(['loan_repayment', 'interest']);

interface FinancialsManagerProps {
  divisions: Division[];
  existingData: FinancialData[];
  existingSharedCosts: SharedCostData[];
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
  existingSharedCosts,
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

  // 共通固定費の入力状態
  const [sharedCostItems, setSharedCostItems] = useState<SharedCostItem[]>(() => {
    return existingSharedCosts
      .filter(sc => sc.fiscalYear === currentYear && sc.month === currentMonth)
      .map(sc => ({
        id: sc.id,
        tempId: crypto.randomUUID(),
        category: sc.category,
        label: sc.label,
        amount: String(sc.amount),
        isLoan: sc.isLoan,
        note: sc.note ?? '',
      }));
  });
  const [deletedSharedCostIds, setDeletedSharedCostIds] = useState<string[]>([]);

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

      // 共通固定費もリセット
      const newSharedCosts = existingSharedCosts
        .filter(sc => sc.fiscalYear === year && sc.month === month)
        .map(sc => ({
          id: sc.id,
          tempId: crypto.randomUUID(),
          category: sc.category,
          label: sc.label,
          amount: String(sc.amount),
          isLoan: sc.isLoan,
          note: sc.note ?? '',
        }));
      setSharedCostItems(newSharedCosts);
      setDeletedSharedCostIds([]);
    },
    [divisions, existingData, existingSharedCosts]
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

  // --- 共通固定費ハンドラー ---

  const addSharedCostRow = useCallback(() => {
    setSharedCostItems(prev => [...prev, {
      tempId: crypto.randomUUID(),
      category: 'rent',
      label: '',
      amount: '',
      isLoan: false,
      note: '',
    }]);
  }, []);

  const updateSharedCostItem = useCallback((tempId: string, field: keyof SharedCostItem, value: string | boolean) => {
    setSharedCostItems(prev => prev.map(item => {
      if (item.tempId !== tempId) return item;
      const updated = { ...item, [field]: value };
      // カテゴリ変更時にisLoanを自動設定
      if (field === 'category' && typeof value === 'string') {
        updated.isLoan = LOAN_CATEGORIES.has(value);
      }
      return updated;
    }));
  }, []);

  const removeSharedCostItem = useCallback((tempId: string) => {
    setSharedCostItems(prev => {
      const item = prev.find(i => i.tempId === tempId);
      if (item?.id) {
        setDeletedSharedCostIds(ids => [...ids, item.id as string]);
      }
      return prev.filter(i => i.tempId !== tempId);
    });
  }, []);

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

  // 全社サマリー計算
  const companySummary = useMemo(() => {
    let totalOperatingProfit = 0;
    for (const div of divisions) {
      const key = cellKey(div.id, selectedYear, selectedMonth);
      const cell = cells[key];
      if (cell) {
        const rev = parseInt(cell.revenue, 10) || 0;
        const cost = parseInt(cell.cost, 10) || 0;
        const opCost = parseInt(cell.operatingCost, 10) || 0;
        totalOperatingProfit += (rev - cost - opCost);
      }
    }

    let sharedCostTotal = 0;
    let nonOperatingTotal = 0;
    for (const item of sharedCostItems) {
      const amt = parseInt(item.amount, 10) || 0;
      if (item.isLoan) {
        nonOperatingTotal += amt;
      } else {
        sharedCostTotal += amt;
      }
    }

    const ordinaryProfit = totalOperatingProfit - sharedCostTotal;
    const realCashFlow = ordinaryProfit - nonOperatingTotal;

    return { totalOperatingProfit, sharedCostTotal, ordinaryProfit, nonOperatingTotal, realCashFlow };
  }, [divisions, cells, sharedCostItems, selectedYear, selectedMonth]);

  // 保存
  const handleSave = useCallback(async () => {
    setSaving(true);
    setMessage(null);

    try {
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

      if (inputs.length === 0 && sharedCostItems.length === 0 && deletedSharedCostIds.length === 0) {
        setMessage({ type: 'error', text: '保存するデータがありません' });
        setSaving(false);
        return;
      }

      // 事業部データ保存
      if (inputs.length > 0) {
        const result = await saveDivisionFinancials(inputs);
        if (!result.success) {
          setMessage({ type: 'error', text: result.error ?? '保存に失敗しました' });
          setSaving(false);
          return;
        }
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
      }

      // 共通固定費保存
      const sharedCostInputs = sharedCostItems
        .filter(item => item.label && item.amount)
        .map(item => ({
          id: item.id,
          category: item.category,
          label: item.label,
          amount: parseInt(item.amount, 10) || 0,
          is_loan: item.isLoan,
          note: item.note || null,
        }));

      if (sharedCostInputs.length > 0 || deletedSharedCostIds.length > 0) {
        const scResult = await saveSharedCosts(selectedYear, selectedMonth, sharedCostInputs, deletedSharedCostIds);
        if (!scResult.success) {
          setMessage({ type: 'error', text: scResult.error ?? '共通固定費の保存に失敗しました' });
          setSaving(false);
          return;
        }
        setDeletedSharedCostIds([]);
      }

      setSaving(false);
      setMessage({ type: 'success', text: `${selectedYear}年${selectedMonth}月のデータを保存しました` });
      // Server Componentを再取得してpropsを更新
      router.refresh();
    } catch (err) {
      console.error('handleSave error:', err);
      setSaving(false);
      setMessage({ type: 'error', text: '保存中に予期しないエラーが発生しました' });
    }
  }, [divisions, cells, sharedCostItems, deletedSharedCostIds, selectedYear, selectedMonth, router]);

  // 年選択肢
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  // サマリー値の分割代入
  const { totalOperatingProfit, sharedCostTotal, ordinaryProfit, nonOperatingTotal, realCashFlow } = companySummary;

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
            <div className="flex flex-wrap gap-1">
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

          {/* モバイルカードビュー */}
          <div className="sm:hidden p-3 space-y-3">
            {divisions.map((div) => {
              const mKey = cellKey(div.id, selectedYear, selectedMonth);
              const mCell = cells[mKey] ?? { revenue: '', cost: '', operatingCost: '', note: '' };
              const mRev = parseInt(mCell.revenue, 10) || 0;
              const mCost = parseInt(mCell.cost, 10) || 0;
              const mOpCost = parseInt(mCell.operatingCost, 10) || 0;
              const mGross = mRev - mCost;
              const mNet = mGross - mOpCost;
              const mHasData = !!(mCell.revenue || mCell.cost || mCell.operatingCost);
              return (
                <div key={div.id} className="border border-[#1a1a1a] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#e5e5e5] font-bold">{div.name}</span>
                    <span className={`px-2 py-0.5 border text-[10px] font-bold ${
                      div.phase === 'profitable' ? 'text-[#22d3ee] border-[#22d3ee]' : 'text-[#f59e0b] border-[#f59e0b]'
                    }`}>{div.phase === 'profitable' ? '黒字' : '赤字'}</span>
                  </div>
                  <div className="space-y-2">
                    <div><label className="text-[10px] text-[#737373]">売上</label><input type="number" value={mCell.revenue} onChange={(e) => updateCell(div.id, 'revenue', e.target.value)} placeholder="0" className="w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] text-right px-2 py-1 text-xs focus:border-[#3b82f6] outline-none" /></div>
                    <div><label className="text-[10px] text-[#737373]">原価</label><input type="number" value={mCell.cost} onChange={(e) => updateCell(div.id, 'cost', e.target.value)} placeholder="0" className="w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] text-right px-2 py-1 text-xs focus:border-[#3b82f6] outline-none" /></div>
                    <div><label className="text-[10px] text-[#737373]">販管費</label><input type="number" value={mCell.operatingCost} onChange={(e) => updateCell(div.id, 'operatingCost', e.target.value)} placeholder="0" className="w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] text-right px-2 py-1 text-xs focus:border-[#3b82f6] outline-none" /></div>
                  </div>
                  {mHasData && (
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-[#111111]">
                      <span className={mGross >= 0 ? 'text-[#22d3ee]' : 'text-[#ef4444]'}>粗利: {formatYen(mGross)}</span>
                      <span className={mNet >= 0 ? 'text-[#22d3ee]' : 'text-[#ef4444]'}>営業利益: {formatYen(mNet)}</span>
                    </div>
                  )}
                  <input type="text" value={mCell.note} onChange={(e) => updateCell(div.id, 'note', e.target.value)} placeholder="備考" className="w-full bg-[#111111] border border-[#333333] text-[#a3a3a3] px-2 py-1 text-xs focus:border-[#3b82f6] outline-none" />
                </div>
              );
            })}
          </div>

          {/* デスクトップテーブルビュー */}
          <div className="hidden sm:block overflow-x-auto">
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

        {/* 共通固定費入力 */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
              共通固定費 {selectedYear}年{selectedMonth}月
            </h3>
            <button
              type="button"
              onClick={addSharedCostRow}
              className="px-3 py-1 text-xs font-bold text-[#3b82f6] border border-[#3b82f6] hover:bg-[#3b82f6]/10 transition-colors"
            >
              行を追加
            </button>
          </div>

          {/* モバイルカードビュー */}
          <div className="sm:hidden p-3 space-y-3">
            {sharedCostItems.map((item) => (
              <div key={item.tempId} className="border border-[#1a1a1a] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <select
                    value={item.category}
                    onChange={(e) => updateSharedCostItem(item.tempId, 'category', e.target.value)}
                    className="bg-[#111111] border border-[#333333] text-[#e5e5e5] text-xs px-2 py-1 focus:border-[#3b82f6] outline-none flex-1 mr-2"
                  >
                    {SHARED_COST_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeSharedCostItem(item.tempId)}
                    className="text-[#ef4444] hover:text-[#dc2626] transition-colors p-1"
                    aria-label="削除"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                  </button>
                </div>
                <div>
                  <label className="text-[10px] text-[#737373]">名目</label>
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => updateSharedCostItem(item.tempId, 'label', e.target.value)}
                    placeholder="名目を入力"
                    className="w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] px-2 py-1 text-xs focus:border-[#3b82f6] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#737373]">金額 (円)</label>
                  <input
                    type="number"
                    value={item.amount}
                    onChange={(e) => updateSharedCostItem(item.tempId, 'amount', e.target.value)}
                    placeholder="0"
                    className="w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] text-right px-2 py-1 text-xs focus:border-[#3b82f6] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#737373]">備考</label>
                  <input
                    type="text"
                    value={item.note}
                    onChange={(e) => updateSharedCostItem(item.tempId, 'note', e.target.value)}
                    placeholder="備考"
                    className="w-full bg-[#111111] border border-[#333333] text-[#a3a3a3] px-2 py-1 text-xs focus:border-[#3b82f6] outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-[#737373]">
                  <input
                    type="checkbox"
                    checked={item.isLoan}
                    onChange={(e) => updateSharedCostItem(item.tempId, 'isLoan', e.target.checked)}
                    className="accent-[#3b82f6]"
                  />
                  <span>営業外</span>
                </div>
              </div>
            ))}
          </div>

          {/* デスクトップテーブルビュー */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a1a1a] text-[#737373]">
                  <th className="px-4 py-2 text-left font-medium">カテゴリ</th>
                  <th className="px-4 py-2 text-left font-medium">名目</th>
                  <th className="px-4 py-2 text-right font-medium">金額 (円)</th>
                  <th className="px-4 py-2 text-center font-medium">営業外</th>
                  <th className="px-4 py-2 text-left font-medium">備考</th>
                  <th className="px-4 py-2 text-center font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {sharedCostItems.map((item) => (
                  <tr key={item.tempId} className="border-b border-[#111111] hover:bg-[#111111] transition-colors">
                    <td className="px-4 py-3">
                      <select
                        value={item.category}
                        onChange={(e) => updateSharedCostItem(item.tempId, 'category', e.target.value)}
                        className="bg-[#111111] border border-[#333333] text-[#e5e5e5] text-xs px-2 py-1 focus:border-[#3b82f6] outline-none"
                      >
                        {SHARED_COST_CATEGORIES.map((cat) => (
                          <option key={cat.value} value={cat.value}>{cat.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={item.label}
                        onChange={(e) => updateSharedCostItem(item.tempId, 'label', e.target.value)}
                        placeholder="名目を入力"
                        className="w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] px-2 py-1 text-xs focus:border-[#3b82f6] outline-none"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={item.amount}
                        onChange={(e) => updateSharedCostItem(item.tempId, 'amount', e.target.value)}
                        placeholder="0"
                        className="w-28 bg-[#111111] border border-[#333333] text-[#e5e5e5] text-right px-2 py-1 text-xs focus:border-[#3b82f6] outline-none"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={item.isLoan}
                        onChange={(e) => updateSharedCostItem(item.tempId, 'isLoan', e.target.checked)}
                        className="accent-[#3b82f6]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={item.note}
                        onChange={(e) => updateSharedCostItem(item.tempId, 'note', e.target.value)}
                        placeholder="備考"
                        className="w-full bg-[#111111] border border-[#333333] text-[#a3a3a3] px-2 py-1 text-xs focus:border-[#3b82f6] outline-none"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => removeSharedCostItem(item.tempId)}
                        className="text-[#ef4444] hover:text-[#dc2626] transition-colors p-1"
                        aria-label="削除"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {sharedCostItems.length === 0 && (
            <div className="p-4 text-center text-xs text-[#404040]">
              共通固定費はまだ登録されていません
            </div>
          )}
        </div>

        {/* 全社サマリー */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="border-b border-[#1a1a1a] px-4 py-3">
            <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
              全社サマリー {selectedYear}年{selectedMonth}月
            </h3>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-[#a3a3a3]">事業部営業利益合計</span>
              <span className={totalOperatingProfit >= 0 ? 'text-[#22d3ee]' : 'text-[#ef4444]'}>
                {formatYen(totalOperatingProfit)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-[#a3a3a3]">共通固定費小計</span>
              <span className="text-[#ef4444]">-{formatYen(sharedCostTotal)}</span>
            </div>
            <div className="border-t border-[#1a1a1a] pt-3 flex justify-between items-center text-sm font-bold">
              <span className="text-[#e5e5e5]">経常利益</span>
              <span className={ordinaryProfit >= 0 ? 'text-[#22d3ee]' : 'text-[#ef4444]'}>
                {formatYen(ordinaryProfit)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-[#a3a3a3]">営業外支出小計</span>
              <span className="text-[#ef4444]">-{formatYen(nonOperatingTotal)}</span>
            </div>
            <div className="border-t border-[#1a1a1a] pt-3 flex justify-between items-center text-sm font-bold">
              <span className="text-[#e5e5e5]">実質キャッシュフロー</span>
              <span className={realCashFlow >= 0 ? 'text-[#22d3ee]' : 'text-[#ef4444]'}>
                {formatYen(realCashFlow)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
