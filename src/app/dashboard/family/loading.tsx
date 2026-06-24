export default function Loading() {
  return (
    <div className="flex flex-col gap-[var(--section-gap)] animate-pulse">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="h-10 w-48 bg-white/5 rounded-2xl" />
          <div className="h-4 w-64 bg-white/5 rounded-xl" />
        </div>
        <div className="h-12 w-32 bg-white/5 rounded-2xl" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-32 bg-white/5 rounded-[var(--radius-xl)] border border-white/5"
          />
        ))}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-[350px] bg-white/5 rounded-[var(--radius-xl)] border border-white/5" />
        <div className="h-[350px] bg-white/5 rounded-[var(--radius-xl)] border border-white/5" />
      </div>

      {/* Table */}
      <div className="h-96 bg-white/5 rounded-[var(--radius-xl)] border border-white/5" />
    </div>
  );
}