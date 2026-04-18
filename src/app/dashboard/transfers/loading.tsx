export default function TransfersLoading() {
  return (
    <div className="flex flex-col gap-[var(--section-gap)] animate-pulse">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="skeleton h-10 w-64 rounded-xl mb-2" />
          <div className="skeleton h-4 w-48 rounded-lg" />
        </div>
        <div className="skeleton h-12 w-40 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-card-static p-8">
            <div className="skeleton h-3 w-24 rounded mb-4" />
            <div className="skeleton h-8 w-32 rounded-lg" />
          </div>
        ))}
      </div>
      <div className="glass-card-static p-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex justify-between py-4 border-b border-white/5 last:border-0">
            <div className="skeleton h-4 w-48 rounded" />
            <div className="skeleton h-4 w-24 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
