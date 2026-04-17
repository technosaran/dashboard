/**
 * Standardized Empty State Component
 * Consistent empty state design across the application
 */

import { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {icon && (
        <div className="mb-6 p-6 rounded-2xl bg-[--accent-primary]/5 border border-[--accent-primary]/10">
          {icon}
        </div>
      )}
      <h3 className="text-xl font-black text-[--text-primary] mb-2">{title}</h3>
      {description && <p className="text-sm text-[--text-secondary] max-w-md mb-6">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="btn-primary flex items-center gap-2 h-12 px-6 rounded-xl font-bold text-sm uppercase tracking-wider"
        >
          {action.icon}
          {action.label}
        </button>
      )}
    </div>
  );
}
