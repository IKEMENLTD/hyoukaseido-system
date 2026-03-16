// =============================================================================
// 事業部別財務データ管理ページ (Server Component)
// 月次の売上・原価・販管費を事業部ごとに入力・閲覧する
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import { getCurrentMember } from '@/lib/auth/get-member';
import FinancialsManager from './FinancialsManager';

interface DivisionRow {
  id: string;
  name: string;
  phase: string;
}

interface FinancialRow {
  id: string;
  division_id: string;
  fiscal_year: number;
  month: number;
  revenue: number;
  cost: number;
  gross_profit: number;
  operating_cost: number;
  net_profit: number;
  note: string | null;
}

export default async function FinancialsPage() {
  const member = await getCurrentMember();
  if (!member || !['G4', 'G5'].includes(member.grade)) {
    return (
      <div className="min-h-screen bg-[#050505] p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">アクセス権限がありません</h2>
          <p className="text-sm text-[#737373]">管理機能はG4以上のメンバーのみ利用できます。</p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  // 現在の年月を基準に直近12ヶ月分のデータを取得
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [divisionsRes, financialsRes] = await Promise.all([
    supabase.from('divisions').select('id, name, phase').order('name'),
    supabase
      .from('division_financials')
      .select('id, division_id, fiscal_year, month, revenue, cost, gross_profit, operating_cost, net_profit, note')
      .gte('fiscal_year', currentYear - 1)
      .order('fiscal_year', { ascending: false }),
  ]);

  const divisions = ((divisionsRes.data ?? []) as unknown as DivisionRow[]).map((d) => ({
    id: d.id,
    name: d.name,
    phase: d.phase,
  }));

  const financials = ((financialsRes.data ?? []) as unknown as FinancialRow[]).map((f) => ({
    id: f.id,
    divisionId: f.division_id,
    fiscalYear: f.fiscal_year,
    month: f.month,
    revenue: f.revenue,
    cost: f.cost,
    grossProfit: f.gross_profit,
    operatingCost: f.operating_cost,
    netProfit: f.net_profit,
    note: f.note,
  }));

  return (
    <FinancialsManager
      divisions={divisions}
      existingData={financials}
      currentYear={currentYear}
      currentMonth={currentMonth}
    />
  );
}
