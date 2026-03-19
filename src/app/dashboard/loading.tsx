export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <div className="h-7 w-40 bg-[#0a0a0a] animate-pulse" />
            <div className="h-4 w-28 bg-[#0a0a0a] animate-pulse mt-2" />
          </div>
          <div className="flex gap-3">
            <div className="h-7 w-20 border border-[#1a1a1a] animate-pulse" />
          </div>
        </div>

        {/* アクションアイテム */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
          <div className="h-5 w-36 bg-[#111111] animate-pulse mb-3" />
          <div className="space-y-2">
            <div className="h-10 bg-[#111111] animate-pulse" />
            <div className="h-10 bg-[#111111] animate-pulse" />
          </div>
        </div>

        {/* 全社サマリー */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
          <div className="h-5 w-28 bg-[#111111] animate-pulse mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border border-[#1a1a1a] p-4">
                <div className="h-3 w-16 bg-[#111111] animate-pulse mb-2" />
                <div className="h-8 w-20 bg-[#111111] animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* 2カラム */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 border border-[#1a1a1a] bg-[#0a0a0a] p-4 h-48 animate-pulse" />
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 h-48 animate-pulse" />
        </div>

        {/* クロスセル */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 h-32 animate-pulse" />
      </div>
    </div>
  );
}
