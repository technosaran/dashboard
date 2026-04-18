export default function Loading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="h-10 w-48 bg-white/5 rounded-xl" />
        <div className="h-10 w-32 bg-white/5 rounded-xl" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-card-static p-6 h-24" />
        ))}
      </div>
      
      <div className="glass-card-static p-6 h-96" />
    </div>
  );
}
