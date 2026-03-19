export default function QuarterlyBonusLoading() {
  return (
    <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="h-7 w-36 bg-[#0a0a0a] animate-pulse" />
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-[#111111] animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
