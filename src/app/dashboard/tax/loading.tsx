export default function TaxLoading() {
  return (
    <div className="flex flex-col gap-8 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="h-12 w-64 bg-white/5 rounded-xl" />
        <div className="h-10 w-32 bg-white/5 rounded-xl" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="glass-card-static p-8">
            <div className="h-4 w-32 bg-white/5 rounded mb-4" />
            <div className="h-8 w-full bg-white/5 rounded" />
          </div>
        ))}
      </div>
      
      <div className="glass-card-static p-8">
        <div className="h-6 w-48 bg-white/5 rounded mb-6" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 bg-white/5 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
