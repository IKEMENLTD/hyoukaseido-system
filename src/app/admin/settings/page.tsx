// =============================================================================
// システム設定ページ (管理者)
// 全社設定、等級定義、バリュー項目の管理
// =============================================================================

import type { Grade, Rank } from '@/types/evaluation';
import { RANK_THRESHOLDS, SALARY_CHANGE } from '@/types/evaluation';
import { getCurrentMember } from '@/lib/auth/get-member';
import { createClient } from '@/lib/supabase/server';
import SettingsClient from './SettingsClient';

interface OrganizationRow {
  id: string;
  name: string;
  fiscal_year_start: number;
}

interface GradeDefinitionRow {
  grade: Grade;
  name: string;
  salary_range_min: number | null;
  salary_range_max: number | null;
  description: string | null;
  expected_multiplier: number | null;
}

interface ValueItemRow {
  name: string;
  definition: string;
  axis: string | null;
  max_score: number;
}

export default async function AdminSettingsPage() {
  const member = await getCurrentMember();
  if (!member || !['G4', 'G5'].includes(member.grade)) {
    return (
      <div className="min-h-screen bg-[#050505] p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">アクセス権限がありません</h2>
          <p className="text-sm text-[#737373]">
            管理機能はG4以上の等級のメンバーのみ利用できます。
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  const [orgResult, gradeResult, valueResult] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, fiscal_year_start')
      .eq('id', member.org_id)
      .single(),
    supabase
      .from('grade_definitions')
      .select('grade, name, salary_range_min, salary_range_max, description, expected_multiplier')
      .eq('org_id', member.org_id)
      .order('grade'),
    supabase
      .from('value_items')
      .select('name, definition, axis, max_score')
      .eq('org_id', member.org_id)
      .order('sort_order'),
  ]);

  const orgRow = orgResult.data as unknown as OrganizationRow | null;
  const gradeRows = (gradeResult.data ?? []) as unknown as GradeDefinitionRow[];
  const valueRows = (valueResult.data ?? []) as unknown as ValueItemRow[];

  // camelCase に変換して SettingsClient に渡す
  const org = {
    id: orgRow?.id ?? '',
    name: orgRow?.name ?? '',
    fiscalYearStart: orgRow?.fiscal_year_start ?? 4,
  };

  const gradeDefinitions = gradeRows.map((g) => ({
    grade: g.grade as string,
    name: g.name,
    salaryRangeMin: g.salary_range_min ?? 0,
    salaryRangeMax: g.salary_range_max ?? 0,
    description: g.description ?? '',
    expectedMultiplier: g.expected_multiplier ?? 0,
  }));

  const valueItems = valueRows.map((v) => ({
    name: v.name,
    definition: v.definition,
    axis: v.axis ?? '',
    maxScore: v.max_score,
  }));

  return (
    <div className="min-h-screen bg-[#050505] p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* ページヘッダー */}
        <div>
          <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
            システム設定
          </h1>
          <p className="text-sm text-[#737373] mt-1">
            全社設定、等級定義、バリュー項目
          </p>
        </div>

        {/* 編集可能セクション (Client Component) */}
        <SettingsClient
          org={org}
          gradeDefinitions={gradeDefinitions}
          valueItems={valueItems}
          orgId={member.org_id}
        />

        {/* ランク判定閾値 (読み取り専用 - Server Component) */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="border-b border-[#1a1a1a] px-4 py-3">
            <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
              ランク判定閾値 / 昇給額
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a1a1a] text-[#737373]">
                  <th className="px-4 py-2 text-center font-medium">ランク</th>
                  <th className="px-4 py-2 text-right font-medium">最低スコア</th>
                  <th className="px-4 py-2 text-right font-medium">昇給額</th>
                </tr>
              </thead>
              <tbody>
                {RANK_THRESHOLDS.map((threshold) => (
                  <tr key={threshold.rank} className="border-b border-[#111111]">
                    <td className="px-4 py-2 text-center">
                      <span className={`font-bold ${
                        ({ S: 'text-[#3b82f6]', A: 'text-[#22d3ee]', B: 'text-[#a3a3a3]', C: 'text-[#f59e0b]', D: 'text-[#ef4444]' } as Record<Rank, string>)[threshold.rank]
                      }`}>
                        {threshold.rank}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-[#a3a3a3]">{threshold.min}点</td>
                    <td className="px-4 py-2 text-right">
                      <span className={`font-bold ${SALARY_CHANGE[threshold.rank] >= 0 ? 'text-[#22d3ee]' : 'text-[#ef4444]'}`}>
                        {SALARY_CHANGE[threshold.rank] >= 0 ? '+' : ''}{SALARY_CHANGE[threshold.rank].toLocaleString()}円
                      </span>
                    </td>
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
