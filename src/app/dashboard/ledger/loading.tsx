export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="glass-card-static p-6">
        <div className="h-8 w-40 rounded bg-white/10" />
        <div className="mt-3 h-4 w-72 rounded bg-white/5" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="glass-card-static h-24 rounded-[var(--radius-lg)] border border-white/10" />
        ))}
      </div>

      <div className="glass-card-static p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-11 rounded-xl bg-white/5" />
          ))}
        </div>
      </div>

      <div className="glass-card-static h-[420px] rounded-[var(--radius-lg)] border border-white/10" />
    </div>
  );
}
