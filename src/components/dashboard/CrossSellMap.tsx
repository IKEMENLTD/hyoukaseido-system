'use client';

interface RouteData {
  fromDivision: string;
  toDivision: string;
  tossCount: number;
  contractedCount: number;
  totalBonus: number;
}

interface CrossSellMapProps {
  routes: RouteData[];
}

function computeConversionRate(tossed: number, contracted: number): string {
  if (tossed === 0) return '---';
  return `${Math.round((contracted / tossed) * 100)}%`;
}

export default function CrossSellMap({ routes }: CrossSellMapProps) {
  const totalToss = routes.reduce((sum, r) => sum + r.tossCount, 0);
  const totalContracted = routes.reduce((sum, r) => sum + r.contractedCount, 0);
  const totalBonusSum = routes.reduce((sum, r) => sum + r.totalBonus, 0);

  return (
    <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
      <div className="border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
          クロスセル実績
        </h3>
        <div className="flex items-center gap-4 text-xs text-[#737373]">
          <span>
            トス合計: <span className="text-[#e5e5e5] font-medium">{totalToss}</span>
          </span>
          <span>
            受注合計: <span className="text-[#22d3ee] font-medium">{totalContracted}</span>
          </span>
          <span>
            ボーナス合計:{' '}
            <span className="text-[#3b82f6] font-medium">
              {totalBonusSum.toLocaleString()}円
            </span>
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a1a1a] text-[#737373]">
              <th className="px-4 py-2 text-left font-medium">トス元</th>
              <th className="px-4 py-2 text-center font-medium">→</th>
              <th className="px-4 py-2 text-left font-medium">トス先</th>
              <th className="px-4 py-2 text-right font-medium">トス数</th>
              <th className="px-4 py-2 text-right font-medium">受注数</th>
              <th className="px-4 py-2 text-right font-medium">成約率</th>
              <th className="px-4 py-2 text-right font-medium">ボーナス</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((route, index) => (
              <tr
                key={index}
                className="border-b border-[#111111] hover:bg-[#111111] transition-colors"
              >
                <td className="px-4 py-3 text-[#e5e5e5]">{route.fromDivision}</td>
                <td className="px-4 py-3 text-center text-[#333333]">→</td>
                <td className="px-4 py-3 text-[#e5e5e5]">{route.toDivision}</td>
                <td className="px-4 py-3 text-right text-[#a3a3a3]">
                  {route.tossCount}
                </td>
                <td className="px-4 py-3 text-right text-[#22d3ee] font-medium">
                  {route.contractedCount}
                </td>
                <td className="px-4 py-3 text-right text-[#a3a3a3]">
                  {computeConversionRate(route.tossCount, route.contractedCount)}
                </td>
                <td className="px-4 py-3 text-right text-[#3b82f6] font-medium">
                  {route.totalBonus.toLocaleString()}円
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
