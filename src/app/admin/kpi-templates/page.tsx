// =============================================================================
// KPIテンプレート管理ページ (管理者)
// 事業部・職種別のKPIテンプレートを管理 - Supabase統合
// Server Component: データ取得 + 権限チェック → KpiTemplateManagerに委譲
// =============================================================================

import type { EvalType } from '@/types/evaluation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMember } from '@/lib/auth/get-member';
import KpiTemplateManager from './KpiTemplateManager';

// ---------------------------------------------------------------------------
// Supabase返却型 (any禁止)
// ---------------------------------------------------------------------------

interface KpiItemRow {
  id: string;
  name: string;
  weight: number;
  measurement_unit: string | null;
  description: string | null;
  threshold_s: number | null;
  threshold_a: number | null;
  threshold_b: number | null;
  threshold_c: number | null;
  sort_order: number;
}

interface KpiTemplateRow {
  id: string;
  division_id: string;
  role: string;
  eval_type: EvalType | null;
  version: number;
  is_active: boolean;
  created_at: string;
  divisions: { name: string } | null;
  kpi_items: KpiItemRow[];
}

interface DivisionRow {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// ページコンポーネント (Server Component)
// ---------------------------------------------------------------------------

export default async function AdminKpiTemplatesPage() {
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

  const [templatesResult, divisionsResult] = await Promise.all([
    supabase
      .from('kpi_templates')
      .select('*, divisions(name), kpi_items(*)')
      .eq('is_active', true)
      .order('created_at'),
    supabase
      .from('divisions')
      .select('id, name')
      .order('name'),
  ]);

  const { data: templates, error } = templatesResult;
  const { data: divisions } = divisionsResult;

  const templateList: KpiTemplateRow[] = (templates as KpiTemplateRow[] | null) ?? [];

  // camelCase変換
  const templateData = templateList.map((t) => ({
    id: t.id,
    divisionId: t.division_id,
    divisionName: t.divisions?.name ?? '不明',
    role: t.role,
    evalType: t.eval_type,
    version: t.version,
    isActive: t.is_active,
    items: [...t.kpi_items]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => ({
        id: item.id,
        name: item.name,
        weight: item.weight,
        measurementUnit: item.measurement_unit ?? '',
        description: item.description ?? '',
        thresholdS: item.threshold_s ?? null,
        thresholdA: item.threshold_a ?? null,
        thresholdB: item.threshold_b ?? null,
        thresholdC: item.threshold_c ?? null,
        sortOrder: item.sort_order,
      })),
  }));

  const divisionList: DivisionRow[] = (divisions as DivisionRow[] | null) ?? [];

  return (
    <div className="min-h-screen bg-[#050505] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ページヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
              KPIテンプレート管理
            </h1>
            <p className="text-sm text-[#737373] mt-1">
              事業部・職種別の評価テンプレートを管理
            </p>
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="border border-red-900 bg-red-950/30 px-4 py-3 text-xs text-red-400">
            データの取得に失敗しました: {error.message}
          </div>
        )}

        {/* クライアントコンポーネントに委譲 */}
        <KpiTemplateManager
          templates={templateData}
          divisions={divisionList}
        />
      </div>
    </div>
  );
}
