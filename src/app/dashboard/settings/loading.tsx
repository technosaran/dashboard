export default function Loading() {
  return (
    <div className="flex flex-col gap-[var(--section-gap)]">
      <div className="space-y-2">
        <div className="h-10 w-48 bg-white/5 rounded-2xl" />
        <div className="h-4 w-64 bg-white/5 rounded-xl" />
      </div>
      <div className="glass-card-static p-6 md:p-10">
        <div className="space-y-5">
          <div className="h-8 w-48 bg-white/5 rounded-xl" />
          <div className="h-14 w-full bg-white/5 rounded-xl" />
          <div className="h-4 w-72 bg-white/5 rounded-lg" />
        </div>
      </div>
      <div className="glass-card-static p-6 md:p-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-16 bg-white/5 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
