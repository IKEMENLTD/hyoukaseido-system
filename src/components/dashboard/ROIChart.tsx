'use client';

interface ROIData {
  monthlySalaryCost: number;
  monthlyRevenue: number;
  costRatio: number;
  perPersonCost: number;
}

interface ROIChartProps {
  data: ROIData;
}

function formatCurrency(value: number): string {
  if (value >= 100_000_000) {
    return `${(value / 100_000_000).toFixed(1)}億円`;
  }
  if (value >= 10_000) {
    return `${Math.round(value / 10_000).toLocaleString()}万円`;
  }
  return `${value.toLocaleString()}円`;
}

function MetricRow({
  label,
  value,
  subtext,
  accent = false,
}: {
  label: string;
  value: string;
  subtext?: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#111111] last:border-b-0">
      <div>
        <div className="text-sm text-[#a3a3a3]">{label}</div>
        {subtext && <div className="text-xs text-[#737373] mt-0.5">{subtext}</div>}
      </div>
      <div
        className={`text-lg font-bold ${accent ? 'text-[#3b82f6]' : 'text-[#e5e5e5]'}`}
      >
        {value}
      </div>
    </div>
  );
}

export default function ROIChart({ data }: ROIChartProps) {
  const costBarWidth = Math.min((data.costRatio / 100) * 100, 100);
  const isHealthy = data.costRatio <= 30;

  return (
    <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
      <div className="border-b border-[#1a1a1a] px-4 py-3">
        <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
          人件費ROI
        </h3>
      </div>
      <div className="p-4 space-y-1">
        <MetricRow
          label="月間人件費"
          value={formatCurrency(data.monthlySalaryCost)}
        />
        <MetricRow
          label="月間売上"
          value={formatCurrency(data.monthlyRevenue)}
          accent
        />
        <MetricRow
          label="一人当たりコスト"
          value={formatCurrency(data.perPersonCost)}
          subtext="月額平均"
        />
      </div>
      <div className="border-t border-[#1a1a1a] p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[#737373] uppercase tracking-wider">
            人件費率
          </span>
          <span
            className={`text-sm font-bold ${isHealthy ? 'text-[#22d3ee]' : 'text-[#ef4444]'}`}
          >
            {data.costRatio.toFixed(1)}%
          </span>
        </div>
        <div className="h-3 bg-[#1a1a1a] relative">
          <div
            className={`h-full transition-all ${isHealthy ? 'bg-[#22d3ee]' : 'bg-[#ef4444]'}`}
            style={{ width: `${costBarWidth}%` }}
          />
          <div
            className="absolute top-0 h-full w-px bg-[#3b82f6]"
            style={{ left: '30%' }}
            title="目標: 30%"
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-[#737373]">0%</span>
          <span className="text-xs text-[#3b82f6]">目標30%</span>
          <span className="text-xs text-[#737373]">100%</span>
        </div>
      </div>
    </div>
  );
}
