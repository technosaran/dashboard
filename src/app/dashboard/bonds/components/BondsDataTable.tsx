"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
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
import { ArrowUpDown, ArrowUp, ArrowDown, Edit } from "lucide-react";
import type { Tables } from "@/lib/database.types";
import PnLValue from "@/components/pnl-value";

type Bond = Tables<"bonds">;

interface BondsDataTableProps {
  bonds: Bond[];
  onEdit: (bond: Bond) => void;
  onAdd: () => void;
}

const columnHelper = createColumnHelper<Bond>();

export default function BondsDataTable({ bonds, onEdit, onAdd }: BondsDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = useMemo(
    () => [
      columnHelper.accessor("bond_name", {
        header: "Bond",
        cell: (info) => (
          <div className="flex flex-col max-w-[200px]">
            <p className="text-[13px] font-bold text-white truncate hover:text-clip hover:absolute hover:bg-black hover:z-10 hover:p-1 hover:rounded-md hover:border hover:border-white/10" title={info.getValue()}>{info.getValue()}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] truncate">{info.row.original.issuer || "N/A"} • {info.row.original.isin || "N/A"}</p>
          </div>
        ),
      }),
      columnHelper.accessor("bond_type", {
        header: "Type",
        cell: (info) => (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-[0.1em] bg-white/5 border border-white/10 text-[--text-muted]">
            {info.getValue() || "N/A"}
          </span>
        ),
      }),
      columnHelper.accessor("coupon_rate", {
        header: "Coupon",
        cell: (info) => (
          <div className="flex flex-col">
            <span className="text-[12px] font-bold text-[--accent-primary]">{Number(info.getValue()).toFixed(2)}%</span>
            <span className="text-[9px] text-[--text-muted]">{info.row.original.interest_frequency}</span>
          </div>
        ),
      }),
      columnHelper.display({
        id: "investment",
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center gap-1 uppercase tracking-[0.2em] hover:text-white transition-colors">
            Investment
            {column.getIsSorted() === "asc" ? <ArrowUp className="w-3 h-3" /> : column.getIsSorted() === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-50" />}
          </button>
        ),
        cell: (info) => {
          const invested = Number(info.row.original.total_invested);
          return (
            <div className="flex flex-col">
              <span className="text-[12px] font-bold text-white">₹{invested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="text-[9px] text-[--text-muted]">{info.row.original.quantity} qty @ ₹{Number(info.row.original.purchase_price).toFixed(2)}</span>
            </div>
          );
        },
        sortingFn: (rowA, rowB) => Number(rowA.original.total_invested) - Number(rowB.original.total_invested)
      }),
      columnHelper.display({
        id: "currentValue",
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center gap-1 uppercase tracking-[0.2em] hover:text-white transition-colors">
            Current Value
            {column.getIsSorted() === "asc" ? <ArrowUp className="w-3 h-3" /> : column.getIsSorted() === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-50" />}
          </button>
        ),
        cell: (info) => {
          const current = Number(info.row.original.current_value);
          return (
            <div className="flex flex-col">
              <span className="text-[12px] font-bold text-white">₹{current.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="text-[9px] text-[--text-muted]">LTP: ₹{Number(info.row.original.current_price).toFixed(2)}</span>
            </div>
          );
        },
        sortingFn: (rowA, rowB) => Number(rowA.original.current_value) - Number(rowB.original.current_value)
      }),
      columnHelper.display({
        id: "maturity",
        header: "Maturity",
        cell: (info) => {
          const date = info.row.original.maturity_date;
          return (
            <div className="flex flex-col">
              <span className="text-[12px] text-white">{date ? format(parseISO(date), "MMM d, yyyy") : "N/A"}</span>
              <span className="text-[9px] text-[--text-muted]">YTM: {info.row.original.ytm ? `${Number(info.row.original.ytm).toFixed(2)}%` : "N/A"}</span>
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
              onClick={() => onEdit(info.row.original)}
              className="p-2 rounded-lg bg-white/5 text-[--text-muted] hover:bg-[--accent-primary] hover:text-white transition-colors"
              title="Edit Bond"
            >
              <Edit className="w-4 h-4" />
            </button>
          </div>
        ),
      }),
    ],
    [onEdit]
  );

  const filteredBonds = useMemo(() => {
    if (!globalFilter) return bonds;
    const lower = globalFilter.toLowerCase();
    return bonds.filter(b => 
      b.bond_name.toLowerCase().includes(lower) || 
      (b.issuer && b.issuer.toLowerCase().includes(lower)) ||
      (b.isin && b.isin.toLowerCase().includes(lower))
    );
  }, [bonds, globalFilter]);

  const table = useReactTable({
    data: filteredBonds,
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

  if (bonds.length === 0) {
    return (
      <EmptyState 
        icon="📜"
        title="No Bonds Found"
        description="You have no active bond investments."
        action={
          <button onClick={onAdd} className="btn-primary">
            Record Investment
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
            placeholder="Search bonds..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="input-premium pl-9 py-2 text-sm w-full sm:w-64 !bg-black/20"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[900px]">
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
                  No bonds match your search.
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
