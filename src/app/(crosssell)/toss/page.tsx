// =============================================================================
// トスアップ登録ページ - Server Component
// Supabaseからデータ取得し、Client Componentに渡す
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import { getCurrentMember } from '@/lib/auth/get-member';
import TossPageClient from './TossPageClient';
import type { TossStatus } from '@/types/crosssell';

// ---------------------------------------------------------------------------
// Supabaseクエリ結果の型定義
// ---------------------------------------------------------------------------

interface RouteRow {
  id: string;
  condition: string;
  toss_bonus_rate: number;
  receive_bonus_rate: number;
  from_division: { name: string } | null;
  to_division: { name: string } | null;
}

interface MemberRow {
  id: string;
  name: string;
}

interface DivisionMemberRow {
  member_id: string;
  divisions: { name: string } | null;
}

interface RecentTossRow {
  id: string;
  toss_date: string;
  status: TossStatus;
  gross_profit: number | null;
  receiver: { name: string } | null;
  crosssell_routes: {
    to_division: { name: string } | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default async function TossPage() {
  const member = await getCurrentMember();
  if (!member) {
    return (
      <div className="min-h-screen bg-[#050505] p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">
            ログインが必要です
          </h2>
          <p className="text-sm text-[#737373]">
            この機能を利用するにはログインしてください。
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  // 並列でデータ取得
  const [routesResult, membersResult, divMembersResult, recentTossesResult] =
    await Promise.all([
      // 1. クロスセル経路
      supabase
        .from('crosssell_routes')
        .select(
          `
          id, condition, toss_bonus_rate, receive_bonus_rate,
          from_division:divisions!crosssell_routes_from_division_id_fkey (name),
          to_division:divisions!crosssell_routes_to_division_id_fkey (name)
        `
        )
        .eq('is_active', true),

      // 2. アクティブメンバー一覧（自分を除外）
      supabase
        .from('members')
        .select('id, name')
        .eq('status', 'active')
        .neq('id', member.id),

      // 3. メンバーの所属部門
      supabase
        .from('division_members')
        .select('member_id, divisions (name)')
        .eq('is_primary', true),

      // 4. 最近の自分のトス
      supabase
        .from('crosssell_tosses')
        .select(
          `
          id, toss_date, status, gross_profit,
          receiver:members!crosssell_tosses_receiver_id_fkey (name),
          crosssell_routes (
            to_division:divisions!crosssell_routes_to_division_id_fkey (name)
          )
        `
        )
        .eq('tosser_id', member.id)
        .order('toss_date', { ascending: false })
        .limit(10),
    ]);

  // データをcamelCaseに変換
  const rawRoutes = (routesResult.data ?? []) as unknown as RouteRow[];
  const routes = rawRoutes.map((r) => ({
    id: r.id,
    fromDivision: r.from_division?.name ?? '不明',
    toDivision: r.to_division?.name ?? '不明',
    condition: r.condition,
    tossBonusRate: r.toss_bonus_rate,
    receiveBonusRate: r.receive_bonus_rate,
  }));

  const rawMembers = (membersResult.data ?? []) as unknown as MemberRow[];
  const rawDivMembers = (divMembersResult.data ??
    []) as unknown as DivisionMemberRow[];

  // メンバーIDから所属部門名へのマップを作成
  const divisionMap = new Map<string, string>();
  for (const dm of rawDivMembers) {
    divisionMap.set(dm.member_id, dm.divisions?.name ?? '未所属');
  }

  const receivers = rawMembers.map((m) => ({
    id: m.id,
    name: m.name,
    division: divisionMap.get(m.id) ?? '未所属',
  }));

  const rawTosses = (recentTossesResult.data ??
    []) as unknown as RecentTossRow[];
  const recentTosses = rawTosses.map((t) => ({
    id: t.id,
    toDivision: t.crosssell_routes?.to_division?.name ?? '不明',
    receiverName: t.receiver?.name ?? '不明',
    tossDate: t.toss_date,
    status: t.status,
    grossProfit: t.gross_profit,
  }));

  return (
    <TossPageClient
      routes={routes}
      receivers={receivers}
      recentTosses={recentTosses}
      memberId={member.id}
    />
  );
}
