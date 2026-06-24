"use client";

import { useMemo, useState } from "react";
import { format, differenceInDays, parseISO } from "date-fns";
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
import { ArrowUpDown, ArrowUp, ArrowDown, Edit, Trash2, PlusCircle } from "lucide-react";
import type { Tables } from "@/lib/database.types";

type Goal = Tables<"goals">;

interface GoalsDataTableProps {
  goals: Goal[];
  onEdit: (goal: Goal) => void;
  onDelete: (id: string) => void;
  onContribute: (goal: Goal) => void;
  onAdd: () => void;
}

const columnHelper = createColumnHelper<Goal>();

export default function GoalsDataTable({ goals, onEdit, onDelete, onContribute, onAdd }: GoalsDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Goal Name",
        cell: (info) => (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs flex-shrink-0">
              🎯
            </div>
            <p className="text-[13px] font-bold text-white group-hover:text-[--accent-primary] transition-colors truncate">
              {info.getValue()}
            </p>
          </div>
        ),
      }),
      columnHelper.accessor("category", {
        header: "Category",
        cell: (info) => (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-[0.1em] bg-white/5 border border-white/10 text-[--text-muted]">
            {info.getValue() || "Others"}
          </span>
        ),
      }),
      columnHelper.accessor("current_amount", {
        id: "progress",
        header: "Progress",
        cell: (info) => {
          const current = Number(info.row.original.current_amount);
          const target = Number(info.row.original.target_amount);
          const pct = target > 0 ? (current / target) * 100 : 0;
          return (
            <div className="w-full max-w-[150px]">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold text-white">₹{current.toLocaleString()}</span>
                <span className="text-[9px] font-bold text-[--text-muted]">of ₹{target.toLocaleString()}</span>
              </div>
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${pct >= 100 ? 'bg-success' : 'bg-[--accent-primary]'}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            </div>
          );
        },
      }),
      columnHelper.accessor("deadline", {
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center gap-1 uppercase tracking-[0.2em] hover:text-white transition-colors">
            Deadline
            {column.getIsSorted() === "asc" ? <ArrowUp className="w-3 h-3" /> : column.getIsSorted() === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-50" />}
          </button>
        ),
        cell: (info) => {
          const val = info.getValue();
          if (!val) return <span className="text-[11px] text-[--text-muted]">No deadline</span>;
          const days = differenceInDays(parseISO(val), new Date());
          return (
            <div>
              <p className="text-[12px] font-bold text-white">{format(parseISO(val), "MMM d, yyyy")}</p>
              <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${days < 0 ? 'text-danger' : days < 30 ? 'text-warning' : 'text-[--text-muted]'}`}>
                {days < 0 ? `${Math.abs(days)} days overdue` : `${days} days left`}
              </p>
            </div>
          );
        },
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: (info) => (
          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onContribute(info.row.original)}
              className="p-2 rounded-lg bg-[--accent-primary]/10 text-[--accent-primary-light] hover:bg-[--accent-primary] hover:text-white transition-colors"
              title="Contribute"
            >
              <PlusCircle className="w-4 h-4" />
            </button>
            <button
              onClick={() => onEdit(info.row.original)}
              className="p-2 rounded-lg bg-white/5 text-[--text-muted] hover:bg-white/10 hover:text-white transition-colors"
              title="Edit Goal"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(info.row.original.id)}
              className="p-2 rounded-lg bg-danger/10 text-danger hover:bg-danger hover:text-white transition-colors"
              title="Delete Goal"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      }),
    ],
    [onEdit, onDelete, onContribute]
  );

  const filteredGoals = useMemo(() => {
    if (!globalFilter) return goals;
    const lower = globalFilter.toLowerCase();
    return goals.filter(g => 
      g.name.toLowerCase().includes(lower) || 
      (g.category && g.category.toLowerCase().includes(lower))
    );
  }, [goals, globalFilter]);

  const table = useReactTable({
    data: filteredGoals,
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

  if (goals.length === 0) {
    return (
      <EmptyState 
        icon="🎯"
        title="No Goals Found"
        description="You haven't set any financial milestones yet."
        action={
          <button onClick={onAdd} className="btn-primary">
            Create Goal
          </button>
        }
      />
    );
  }

  return (
    <div className="glass-card-static rounded-2xl overflow-hidden flex flex-col border border-white/5">
      <div className="p-4 md:p-5 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.02]">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--text-muted]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            placeholder="Search goals..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="input-premium pl-9 py-2 text-sm w-full sm:w-64 !bg-black/20"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-white/5 bg-black/40">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] whitespace-nowrap">
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
                  <td key={cell.id} className="px-5 py-3.5 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-5 py-12 text-center text-[--text-muted] text-sm">
                  No goals match your search.
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
