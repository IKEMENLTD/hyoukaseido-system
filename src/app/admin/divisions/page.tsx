// =============================================================================
// 事業部管理ページ (管理者) - Server Component
// 初期データをSupabaseから取得し、クライアントコンポーネントに渡す
// =============================================================================

import type { Phase } from '@/types/evaluation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMember } from '@/lib/auth/get-member';
import DivisionManager from './DivisionManager';

// ---------------------------------------------------------------------------
// Supabase返却型 (any禁止)
// ---------------------------------------------------------------------------

interface DivisionQueryRow {
  id: string;
  org_id: string;
  name: string;
  phase: Phase;
  mission: string | null;
  created_at: string;
  division_members: Array<{ count: number }>;
}

// ---------------------------------------------------------------------------
// ページコンポーネント (Server Component)
// ---------------------------------------------------------------------------

export default async function AdminDivisionsPage() {
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

  // 事業部一覧取得 (メンバー数含む)
  const { data: divisions, error: divisionsError } = await supabase
    .from('divisions')
    .select('*, division_members(count)')
    .order('name');

  // org_id取得 (最初の組織)
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id')
    .limit(1)
    .single();

  const divisionQueryList: DivisionQueryRow[] = (divisions as DivisionQueryRow[] | null) ?? [];
  const orgId: string = orgs?.id ?? '';

  // 事業部長の名前を取得
  const divisionIds = divisionQueryList.map((d) => d.id);
  const headMap: Record<string, string> = {};

  if (divisionIds.length > 0) {
    const { data: heads } = await supabase
      .from('division_members')
      .select('division_id, members(name)')
      .eq('is_head', true)
      .in('division_id', divisionIds);

    if (heads) {
      for (const head of heads as unknown as Array<{ division_id: string; members: { name: string } | null }>) {
        if (head.members?.name) {
          headMap[head.division_id] = head.members.name;
        }
      }
    }
  }

  // クライアントコンポーネントに渡すデータに変換
  const divisionList = divisionQueryList.map((d) => ({
    id: d.id,
    org_id: d.org_id,
    name: d.name,
    phase: d.phase,
    mission: d.mission,
    created_at: d.created_at,
    memberCount: d.division_members[0]?.count ?? 0,
    headName: headMap[d.id] ?? null,
  }));

  // データ取得エラー時のフォールバック
  if (divisionsError) {
    return (
      <div className="min-h-screen bg-[#050505] p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider mb-4">
            事業部管理
          </h1>
          <div className="border border-red-900 bg-red-950/30 px-4 py-3 text-xs text-red-400">
            データの取得に失敗しました: {divisionsError.message}
          </div>
        </div>
      </div>
    );
  }

  return (
    <DivisionManager
      initialDivisions={divisionList}
      orgId={orgId}
    />
  );
}
