"use client";

import { useMemo, useState } from "react";
import { format, parseISO, differenceInDays, isValid } from "date-fns";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from "@tanstack/react-table";
import { EmptyState } from "@/components/empty-state";
import { ArrowUpDown, ArrowUp, ArrowDown, Edit, Trash2 } from "lucide-react";
import type { Tables } from "@/lib/database.types";
import { getTableHeaderClass, getTableCellClass } from "@/lib/utils";

type Liability = Tables<"liabilities">;

interface LiabilitiesDataTableProps {
  liabilities: Liability[];
  onEdit: (liability: Liability) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

const columnHelper = createColumnHelper<Liability>();

export default function LiabilitiesDataTable({ liabilities, onEdit, onDelete, onAdd }: LiabilitiesDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [recordFilter, setRecordFilter] = useState<"all" | "open" | "dueSoon" | "highApr">("all");

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Liability Name",
        cell: (info) => {
          const current = Number(info.row.original.remaining_amount);
          const total = Number(info.row.original.total_amount);
          const pct = total > 0 ? Math.max(0, Math.min(100, (1 - (current / total)) * 100)) : 0;
          return (
            <div className="flex items-center gap-3">
              <div className="relative w-8 h-8 flex-shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90 absolute">
                  <circle cx="16" cy="16" r="13" className="stroke-white/5" strokeWidth="2.5" fill="transparent" />
                  <circle
                    cx="16"
                    cy="16"
                    r="13"
                    className="stroke-rose-500 transition-all duration-1000"
                    strokeWidth="2.5"
                    fill="transparent"
                    strokeDasharray={81.6}
                    strokeDashoffset={81.6 * (1 - pct / 100)}
                  />
                </svg>
                <span className="text-[9px] font-black text-rose-400 z-10">{pct.toFixed(0)}%</span>
              </div>
              <div className="flex flex-col max-w-[200px]">
                <p className="text-[13px] font-bold text-white group-hover:text-rose-400 transition-colors truncate">
                  {info.getValue()}
                </p>
              </div>
            </div>
          );
        },
      }),
      columnHelper.accessor("category", {
        header: "Category",
        cell: (info) => (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-[0.1em] bg-white/5 border border-white/10 text-[--text-muted]">
            {info.getValue() || "Others"}
          </span>
        ),
      }),
      columnHelper.accessor("remaining_amount", {
        id: "balance",
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center gap-1 uppercase tracking-[0.2em] hover:text-white transition-colors">
            Outstanding
            {column.getIsSorted() === "asc" ? <ArrowUp className="w-3 h-3" /> : column.getIsSorted() === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-50" />}
          </button>
        ),
        cell: (info) => {
          const current = Number(info.row.original.remaining_amount);
          const total = Number(info.row.original.total_amount);
          const pct = total > 0 ? Math.max(0, Math.min(100, (1 - (current / total)) * 100)) : 0;
          return (
            <div className="w-full max-w-[150px]">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] font-bold text-rose-400">₹{current.toLocaleString()}</span>
                <span className="text-[9px] font-bold text-[--text-muted]">{pct.toFixed(0)}% paid</span>
              </div>
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-rose-500 to-orange-400"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        },
      }),
      columnHelper.accessor("monthly_payment", {
        header: "EMI",
        cell: (info) => {
          const val = info.getValue();
          return val ? <span className="text-[12px] font-bold text-white">₹{Number(val).toLocaleString()}</span> : <span className="text-[11px] text-[--text-muted]">--</span>;
        },
      }),
      columnHelper.accessor("interest_rate", {
        header: "APR",
        cell: (info) => {
          const val = info.getValue();
          return val ? <span className="text-[12px] font-bold text-white">{Number(val)}%</span> : <span className="text-[11px] text-[--text-muted]">--</span>;
        },
      }),
      columnHelper.accessor("due_date", {
        header: "Next Due",
        cell: (info) => {
          const val = info.getValue();
          if (!val) return <span className="text-[11px] text-[--text-muted]">--</span>;
          try {
            const dateObj = parseISO(val);
            if (!isValid(dateObj)) {
              return <span className="text-[11px] text-[--text-muted]">--</span>;
            }
            const daysLeft = differenceInDays(dateObj, new Date());
            return (
              <div>
                <p className="text-[12px] font-bold text-white">{format(dateObj, "MMM d, yyyy")}</p>
                <p className={`text-[9px] font-black uppercase tracking-[0.08em] mt-0.5 ${daysLeft < 0 ? "text-rose-400" : daysLeft <= 7 ? "text-amber-400" : "text-[--text-muted]"}`}>
                  {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                </p>
              </div>
            );
          } catch {
            return <span className="text-[11px] text-[--text-muted]">--</span>;
          }
        },
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: (info) => (
          <div className="flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(info.row.original)}
              className="p-2 rounded-lg bg-white/5 text-[--text-muted] hover:bg-white/10 hover:text-white transition-colors"
              title="Edit Liability"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(info.row.original.id)}
              className="p-2 rounded-lg bg-danger/10 text-danger hover:bg-danger hover:text-white transition-colors"
              title="Delete Liability"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      }),
    ],
    [onEdit, onDelete]
  );

  const filteredLiabilities = useMemo(() => {
    const lower = globalFilter.toLowerCase().trim();
    const now = new Date();
    return liabilities.filter((l) => {
      const remaining = Number(l.remaining_amount);
      const dueDate = l.due_date ? parseISO(l.due_date) : null;
      const dueSoon = dueDate && isValid(dueDate) ? differenceInDays(dueDate, now) <= 7 : false;
      const highApr = Number(l.interest_rate || 0) >= 12;

      const matchesFilter =
        recordFilter === "all" ||
        (recordFilter === "open" && remaining > 0) ||
        (recordFilter === "dueSoon" && remaining > 0 && dueSoon) ||
        (recordFilter === "highApr" && remaining > 0 && highApr);
      if (!matchesFilter) return false;

      if (!lower) return true;
      return (
        l.name.toLowerCase().includes(lower) ||
        (l.category && l.category.toLowerCase().includes(lower)) ||
        (l.notes && l.notes.toLowerCase().includes(lower))
      );
    });
  }, [liabilities, globalFilter, recordFilter]);

  const summary = useMemo(() => {
    const now = new Date();
    return liabilities.reduce(
      (acc, liability) => {
        const remaining = Number(liability.remaining_amount);
        if (remaining > 0) acc.open += 1;
        if (Number(liability.interest_rate || 0) >= 12 && remaining > 0) acc.highApr += 1;
        if (liability.due_date) {
          const parsed = parseISO(liability.due_date);
          if (isValid(parsed)) {
            const days = differenceInDays(parsed, now);
            if (days >= 0 && days <= 7 && remaining > 0) acc.dueSoon += 1;
          }
        }
        return acc;
      },
      { open: 0, dueSoon: 0, highApr: 0 }
    );
  }, [liabilities]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredLiabilities,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 15 },
    },
  });

  if (liabilities.length === 0) {
    return (
      <EmptyState 
        icon="📉"
        title="No Liabilities Found"
        description="You haven't recorded any loans or debts."
        action={
          <button onClick={onAdd} className="btn-primary !bg-rose-500 hover:!bg-rose-600">
            Record Liability
          </button>
        }
      />
    );
  }

  return (
    <div className="glass-card-static rounded-2xl overflow-hidden flex flex-col border border-white/5">
      <div className="p-4 md:p-5 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.02]">
        <div className="flex flex-col gap-3 w-full">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--text-muted]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text"
              placeholder="Search liabilities..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="input-premium pl-9 py-2 text-sm w-full sm:w-64 !bg-black/20"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { key: "all", label: "All", value: liabilities.length },
              { key: "open", label: "Open", value: summary.open },
              { key: "dueSoon", label: "Due ≤7d", value: summary.dueSoon },
              { key: "highApr", label: "APR ≥12%", value: summary.highApr },
            ].map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setRecordFilter(filter.key as typeof recordFilter)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.18em] border transition-colors ${
                  recordFilter === filter.key
                    ? "bg-rose-500/15 border-rose-500/40 text-white"
                    : "bg-white/5 border-white/10 text-[--text-muted] hover:text-white"
                }`}
              >
                {filter.label} ({filter.value})
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-white/5 bg-black/40">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className={`px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] whitespace-nowrap ${getTableHeaderClass(header.column.id)}`}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-white/5">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="group hover:bg-white/[0.02] transition-colors">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={`px-5 py-3.5 align-middle ${getTableCellClass(cell.column.id)}`}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-5 py-12 text-center text-[--text-muted] text-sm">
                  No liabilities match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {table.getPageCount() > 1 && (
        <div className="p-4 border-t border-white/5 flex items-center justify-between bg-white/[0.02]">
          <span className="text-xs font-bold text-[--text-muted]">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-2 rounded-lg hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-2 rounded-lg hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
