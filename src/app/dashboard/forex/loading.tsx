export default function Loading() {
  return (
    <div className="flex flex-col gap-[var(--section-gap)]">
      <div className="space-y-2">
        <div className="h-10 w-48 bg-white/5 rounded-2xl" />
        <div className="h-4 w-64 bg-white/5 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-white/5 rounded-[var(--radius-xl)] border border-white/5" />
        ))}
      </div>
      <div className="h-96 bg-white/5 rounded-[var(--radius-xl)] border border-white/5" />
    </div>
  );
}
