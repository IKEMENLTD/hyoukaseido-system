export default function ProfileLoading() {
  return (
    <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="h-7 w-28 bg-[#0a0a0a] animate-pulse" />
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-[#111111] animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
