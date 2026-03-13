// =============================================================================
// X-03 クロスセルマップページ
// 全7事業部間のクロスセル実績を可視化
// 対象ユーザー: G4/G5/代表
// =============================================================================

import CrossSellMap from '@/components/dashboard/CrossSellMap';
import { getCurrentMember } from '@/lib/auth/get-member';
import { createClient } from '@/lib/supabase/server';

// -----------------------------------------------------------------------------
// Supabase行データの型定義
// -----------------------------------------------------------------------------

interface DivisionRow {
  id: string;
  name: string;
}

interface CrossSellTossRow {
  id: string;
  route_id: string;
  status: string;
  gross_profit: number | null;
  toss_bonus: number | null;
  receive_bonus: number | null;
  crosssell_routes: {
    from_division_id: string;
    to_division_id: string;
  } | null;
}

// CrossSellMapコンポーネントに渡すルートデータ
interface RouteData {
  fromDivision: string;
  toDivision: string;
  tossCount: number;
  contractedCount: number;
  totalBonus: number;
}

// -----------------------------------------------------------------------------
// ヘルパー関数
// -----------------------------------------------------------------------------

function buildDivisionName(id: string, divisions: DivisionRow[]): string {
  return divisions.find((d) => d.id === id)?.name ?? 'Unknown';
}

// 事業部ごとのトス数集計
function computeDivisionSummary(
  routes: Array<{ fromDivision: string; toDivision: string; tossCount: number }>
): Array<{ division: string; sentCount: number; receivedCount: number; netToss: number }> {
  const divisionMap = new Map<string, { sent: number; received: number }>();

  for (const route of routes) {
    const from = divisionMap.get(route.fromDivision) ?? { sent: 0, received: 0 };
    from.sent += route.tossCount;
    divisionMap.set(route.fromDivision, from);

    const to = divisionMap.get(route.toDivision) ?? { sent: 0, received: 0 };
    to.received += route.tossCount;
    divisionMap.set(route.toDivision, to);
  }

  return Array.from(divisionMap.entries()).map(([division, data]) => ({
    division,
    sentCount: data.sent,
    receivedCount: data.received,
    netToss: data.sent - data.received,
  }));
}

export default async function CrossSellMapPage() {
  const member = await getCurrentMember();
  if (!member || !['G4', 'G5'].includes(member.grade)) {
    return (
      <div className="min-h-screen bg-[#050505] p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">アクセス権限がありません</h2>
          <p className="text-sm text-[#737373]">クロスセルマップはG4/G5等級のメンバーのみ閲覧可能です。</p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Supabaseからデータ取得
  // ---------------------------------------------------------------------------
  const supabase = await createClient();

  const [divisionsResult, tossesResult] = await Promise.all([
    supabase.from('divisions').select('id, name').order('name'),
    supabase.from('crosssell_tosses')
      .select('id, route_id, status, gross_profit, toss_bonus, receive_bonus, crosssell_routes(from_division_id, to_division_id)'),
  ]);

  const divisions: DivisionRow[] = divisionsResult.data ?? [];
  const tosses: CrossSellTossRow[] = (tossesResult.data ?? []) as unknown as CrossSellTossRow[];

  // ---------------------------------------------------------------------------
  // ルートごとに集計（from_division_id + to_division_id でグルーピング）
  // ---------------------------------------------------------------------------
  const routeAggregation = new Map<
    string,
    { fromId: string; toId: string; tossCount: number; contractedCount: number; totalBonus: number }
  >();

  for (const toss of tosses) {
    const route = toss.crosssell_routes;
    if (!route) continue;

    const key = `${route.from_division_id}_${route.to_division_id}`;
    const existing = routeAggregation.get(key);

    if (existing) {
      existing.tossCount += 1;
      if (toss.status === 'contracted') {
        existing.contractedCount += 1;
        existing.totalBonus += (toss.toss_bonus ?? 0) + (toss.receive_bonus ?? 0);
      }
    } else {
      routeAggregation.set(key, {
        fromId: route.from_division_id,
        toId: route.to_division_id,
        tossCount: 1,
        contractedCount: toss.status === 'contracted' ? 1 : 0,
        totalBonus:
          toss.status === 'contracted'
            ? (toss.toss_bonus ?? 0) + (toss.receive_bonus ?? 0)
            : 0,
      });
    }
  }

  const crossSellRoutes: RouteData[] = Array.from(routeAggregation.values()).map((r) => ({
    fromDivision: buildDivisionName(r.fromId, divisions),
    toDivision: buildDivisionName(r.toId, divisions),
    tossCount: r.tossCount,
    contractedCount: r.contractedCount,
    totalBonus: Math.round(r.totalBonus),
  }));

  const divisionSummary = computeDivisionSummary(crossSellRoutes);

  // ---------------------------------------------------------------------------
  // レンダリング
  // ---------------------------------------------------------------------------

  // トスデータが0件の場合の空状態表示
  if (crossSellRoutes.length === 0) {
    return (
      <div className="min-h-screen bg-[#050505] p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div>
            <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
              クロスセルマップ
            </h1>
            <p className="text-sm text-[#737373] mt-1">
              事業部間トスアップの実績と経路を可視化
            </p>
          </div>

          <div className="border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3">
            <div className="text-xs text-[#737373]">
              <p>このページはG4(事業部長)/G5(役員)/代表のみ閲覧可能です</p>
            </div>
          </div>

          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 text-center">
            <p className="text-sm text-[#737373]">
              トスアップの実績データがまだありません。
            </p>
            <p className="text-xs text-[#404040] mt-2">
              トスアップが登録されると、事業部間の経路マップが表示されます。
            </p>
          </div>

          <div className="flex items-center">
            <a
              href="/toss"
              className="px-4 py-2 border border-[#333333] text-xs text-[#a3a3a3] hover:border-[#555555] transition-colors"
            >
              クロスセルトップへ戻る
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ページヘッダー */}
        <div>
          <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
            クロスセルマップ
          </h1>
          <p className="text-sm text-[#737373] mt-1">
            事業部間トスアップの実績と経路を可視化
          </p>
        </div>

        {/* アクセス権限表示 */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3">
          <div className="text-xs text-[#737373]">
            <p>このページはG4(事業部長)/G5(役員)/代表のみ閲覧可能です</p>
          </div>
        </div>

        {/* 事業部別サマリー */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="border-b border-[#1a1a1a] px-4 py-3">
            <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
              事業部別トスサマリー
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a1a1a] text-[#737373]">
                  <th className="px-4 py-2 text-left font-medium">事業部</th>
                  <th className="px-4 py-2 text-right font-medium">送出トス数</th>
                  <th className="px-4 py-2 text-right font-medium">受入トス数</th>
                  <th className="px-4 py-2 text-right font-medium">ネット</th>
                </tr>
              </thead>
              <tbody>
                {divisionSummary.map((item) => (
                  <tr
                    key={item.division}
                    className="border-b border-[#111111] hover:bg-[#111111] transition-colors"
                  >
                    <td className="px-4 py-3 text-[#e5e5e5] font-medium">{item.division}</td>
                    <td className="px-4 py-3 text-right text-[#a3a3a3]">{item.sentCount}</td>
                    <td className="px-4 py-3 text-right text-[#22d3ee]">{item.receivedCount}</td>
                    <td className={`px-4 py-3 text-right font-bold ${
                      item.netToss > 0 ? 'text-[#3b82f6]' : item.netToss < 0 ? 'text-[#f59e0b]' : 'text-[#737373]'
                    }`}>
                      {item.netToss > 0 ? '+' : ''}{item.netToss}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* クロスセル実績テーブル */}
        <CrossSellMap routes={crossSellRoutes} />

        {/* 戻るボタン */}
        <div className="flex items-center">
          <a
            href="/toss"
            className="px-4 py-2 border border-[#333333] text-xs text-[#a3a3a3] hover:border-[#555555] transition-colors"
          >
            クロスセルトップへ戻る
          </a>
        </div>
      </div>
    </div>
  );
}
