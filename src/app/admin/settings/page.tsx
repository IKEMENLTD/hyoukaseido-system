// =============================================================================
// システム設定ページ (管理者)
// 全社設定、等級定義、バリュー項目の管理
// =============================================================================

import type { Grade } from '@/types/evaluation';
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

interface RankThresholdRow {
  rank: string;
  min_score: number;
  salary_change: number;
}

export default async function AdminSettingsPage() {
  const member = await getCurrentMember();
  if (!member || !['G4', 'G5'].includes(member.grade)) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
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

  const [orgResult, gradeResult, valueResult, rankResult] = await Promise.all([
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
    supabase
      .from('rank_thresholds')
      .select('rank, min_score, salary_change')
      .eq('org_id', member.org_id)
      .order('min_score', { ascending: false }),
  ]);

  const orgRow = orgResult.data as unknown as OrganizationRow | null;
  const gradeRows = (gradeResult.data ?? []) as unknown as GradeDefinitionRow[];
  const valueRows = (valueResult.data ?? []) as unknown as ValueItemRow[];
  const rankRows = (rankResult.data ?? []) as unknown as RankThresholdRow[];

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

  const rankThresholds = rankRows.length > 0
    ? rankRows.map((r) => ({
        rank: r.rank,
        minScore: r.min_score,
        salaryChange: r.salary_change,
      }))
    : RANK_THRESHOLDS.map((t) => ({
        rank: t.rank,
        minScore: t.min,
        salaryChange: SALARY_CHANGE[t.rank],
      }));

  return (
    <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
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
          rankThresholds={rankThresholds}
          orgId={member.org_id}
        />

      </div>
    </div>
  );
}
