/**
 * Reusable loading skeleton components for skeleton state screens.
 * Implements requirement 8.14: skeleton screen loaders for latency masking.
 */

import React from "react";
import { cn } from "@/lib/utils";

/**
 * Base pulsing skeleton block.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-slate-800/60", className)}
      role="status"
      aria-hidden="true"
      {...props}
    />
  );
}

/**
 * Pulser card block with skeleton padding.
 */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("border border-white/5 bg-slate-900/50 p-6 rounded-2xl space-y-4", className)}>
      <Skeleton className="h-5 w-2/5" />
      <Skeleton className="h-8 w-1/4" />
      <div className="space-y-2 pt-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
    </div>
  );
}

/**
 * Renders a single skeleton row for tables.
 */
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div className="flex items-center space-x-4 py-4 px-6 border-b border-white/5">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4",
            i === 0 ? "w-1/4" : i === 1 ? "w-1/5" : i === 2 ? "w-1/6" : "w-12"
          )}
        />
      ))}
    </div>
  );
}

/**
 * Renders a full tabular loading list of elements.
 */
export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="border border-white/5 bg-slate-900/40 rounded-2xl overflow-hidden">
      <div className="bg-slate-900/80 py-4 px-6 border-b border-white/5">
        <Skeleton className="h-5 w-1/6" />
      </div>
      <div className="divide-y divide-white/5">
        {Array.from({ length: rows }).map((_, i) => (
          <TableRowSkeleton key={i} columns={columns} />
        ))}
      </div>
    </div>
  );
}

/**
 * Renders an abstract representation of chart metrics.
 */
export function ChartSkeleton() {
  return (
    <div className="border border-white/5 bg-slate-900/50 p-6 rounded-2xl space-y-4 flex flex-col justify-between h-[300px]">
      <Skeleton className="h-5 w-1/4" />
      <div className="flex items-end justify-between space-x-3 h-48 px-4">
        <Skeleton className="h-1/3 w-8" />
        <Skeleton className="h-2/3 w-8" />
        <Skeleton className="h-1/2 w-8" />
        <Skeleton className="h-5/6 w-8" />
        <Skeleton className="h-3/4 w-8" />
        <Skeleton className="h-2/5 w-8" />
      </div>
      <div className="flex justify-between pt-2 px-2">
        <Skeleton className="h-3 w-8" />
        <Skeleton className="h-3 w-8" />
        <Skeleton className="h-3 w-8" />
        <Skeleton className="h-3 w-8" />
        <Skeleton className="h-3 w-8" />
        <Skeleton className="h-3 w-8" />
      </div>
    </div>
  );
}

/**
 * Stat summary card indicator.
 */
export function StatCardSkeleton() {
  return (
    <div className="border border-white/5 bg-slate-900/50 p-6 rounded-2xl flex items-center space-x-4">
      <Skeleton className="h-12 w-12 rounded-xl" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-6 w-2/3" />
      </div>
    </div>
  );
}

/**
 * Full layout skeleton simulation.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartSkeleton />
        </div>
        <div>
          <CardSkeleton className="h-[300px]" />
        </div>
      </div>

      <TableSkeleton rows={4} columns={5} />
    </div>
  );
}
