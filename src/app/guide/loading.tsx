export default function GuideLoading() {
  return (
    <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="h-7 w-32 bg-[#0a0a0a] animate-pulse" />
        <div className="h-4 w-64 bg-[#0a0a0a] animate-pulse" />
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 h-24 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
