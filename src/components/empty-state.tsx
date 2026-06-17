import React from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  glowColor?: "indigo" | "emerald" | "rose" | "cyan" | "amber" | "sky" | "purple";
}

export function EmptyState({ 
  title, 
  description, 
  icon, 
  action, 
  glowColor = "indigo" 
}: EmptyStateProps) {
  const glowClasses = {
    indigo: "bg-indigo-500/10 blur-[100px]",
    emerald: "bg-emerald-500/10 blur-[100px]",
    rose: "bg-rose-500/10 blur-[100px]",
    cyan: "bg-cyan-500/10 blur-[100px]",
    amber: "bg-amber-500/10 blur-[100px]",
    sky: "bg-sky-500/10 blur-[100px]",
    purple: "bg-purple-500/10 blur-[100px]",
  };

  return (
    <div className="relative overflow-hidden p-8 md:p-16 flex flex-col items-center text-center min-h-[400px] justify-center rounded-3xl border border-white/5 bg-white/[0.01] backdrop-blur-xl shadow-2xl w-full">
      {/* Background glow blurs */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full pointer-events-none ${glowClasses[glowColor]}`} />
      
      {/* Icon container with pulse animation */}
      {icon && (
        <div className="relative mb-6 z-10">
          <div className="absolute inset-0 bg-white/5 rounded-2xl blur-xl animate-pulse" />
          <div className="relative w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-3xl shadow-xl">
            {icon}
          </div>
        </div>
      )}
      
      <h3 className="relative z-10 text-xl md:text-2xl font-black text-white tracking-tight">{title}</h3>
      {description && (
        <p className="relative z-10 text-sm text-[--text-muted] mt-3 max-w-md mx-auto font-medium leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="relative z-10 mt-8">{action}</div>}
    </div>
  );
}
