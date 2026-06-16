import React from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 md:p-16 rounded-3xl border border-white/5 bg-white/[0.02] backdrop-blur-xl">
      {icon && <div className="mb-4 text-[--accent-primary] opacity-80">{icon}</div>}
      <h3 className="text-xl md:text-2xl font-black text-white tracking-tight">{title}</h3>
      {description && (
        <p className="text-sm text-[--text-muted] mt-2 max-w-md mx-auto font-medium leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
