/**
 * Mobile Card Layout Component
 * Provides consistent mobile-friendly card layouts for table data
 */

import { ReactNode } from "react";

interface MobileCardProps {
  children: ReactNode;
  className?: string;
}

export function MobileCard({ children, className = "" }: MobileCardProps) {
  return (
    <div className={`glass-card p-4 space-y-3 ${className}`}>
      {children}
    </div>
  );
}

interface MobileCardRowProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
}

export function MobileCardRow({ label, value, icon }: MobileCardRowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {icon && <div className="flex-shrink-0">{icon}</div>}
        <span className="text-xs font-bold text-[--text-muted] uppercase tracking-wider truncate">
          {label}
        </span>
      </div>
      <div className="flex-shrink-0 text-right">{value}</div>
    </div>
  );
}

interface MobileCardHeaderProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  actions?: ReactNode;
}

export function MobileCardHeader({ title, subtitle, badge, actions }: MobileCardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-base font-black text-[--text-primary] truncate">{title}</h3>
          {badge}
        </div>
        {subtitle && (
          <p className="text-xs text-[--text-secondary] mt-1 truncate">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex-shrink-0">{actions}</div>}
    </div>
  );
}

interface MobileCardListProps {
  items: ReactNode[];
  emptyMessage?: string;
}

export function MobileCardList({ items, emptyMessage = "No items to display" }: MobileCardListProps) {
  if (items.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-[--text-muted] italic">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={index}>{item}</div>
      ))}
    </div>
  );
}
