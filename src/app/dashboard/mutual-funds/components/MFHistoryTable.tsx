"use client";

import { useMemo, useState } from "react";
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
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { Tables } from "@/lib/database.types";

type MFTrade = Tables<"mutual_fund_trades">;

interface MFHistoryTableProps {
  trades: MFTrade[];
}

const columnHelper = createColumnHelper<MFTrade>();

export default function MFHistoryTable({ trades }: MFHistoryTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }]);
  const [globalFilter, setGlobalFilter] = useState("");

  const formatMoney = (val: number) => val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor("date", {
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center gap-1 hover:text-[--text-primary] transition-colors">
            Date
            {column.getIsSorted() === "asc" ? <ArrowUp className="w-3 h-3" /> : column.getIsSorted() === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-30" />}
          </button>
        ),
        cell: (info) => <div className="text-sm text-[--text-secondary] whitespace-nowrap">{formatDate(info.getValue() || info.row.original.created_at || "")}</div>,
      }),
      columnHelper.accessor("fund_name", {
        header: "Scheme Name",
        cell: (info) => (
          <div className="flex flex-col">
            <span className="text-sm font-medium text-[--text-primary] max-w-[300px] truncate" title={info.getValue()}>{info.getValue()}</span>
          </div>
        ),
      }),
      columnHelper.accessor("trade_type", {
        header: "Type",
        cell: (info) => {
          const type = info.getValue().toUpperCase();
          const isBuy = type === "BUY";
          return (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${isBuy ? 'bg-blue-500/10 text-blue-500' : 'bg-rose-500/10 text-rose-500'}`}>
              {type}
            </span>
          );
        },
      }),
      columnHelper.accessor("units", {
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center justify-end w-full gap-1 hover:text-[--text-primary] transition-colors">
            Units
            {column.getIsSorted() === "asc" ? <ArrowUp className="w-3 h-3" /> : column.getIsSorted() === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-30" />}
          </button>
        ),
        cell: (info) => <div className="text-right text-sm text-[--text-secondary]">{Number(info.getValue()).toLocaleString("en-IN", { maximumFractionDigits: 4 })}</div>,
      }),
      columnHelper.accessor("nav", {
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center justify-end w-full gap-1 hover:text-[--text-primary] transition-colors">
            NAV
            {column.getIsSorted() === "asc" ? <ArrowUp className="w-3 h-3" /> : column.getIsSorted() === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-30" />}
          </button>
        ),
        cell: (info) => <div className="text-right text-sm text-[--text-secondary]">{formatMoney(Number(info.getValue()))}</div>,
      }),
      columnHelper.accessor("amount", {
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center justify-end w-full gap-1 hover:text-[--text-primary] transition-colors">
            Total Value
            {column.getIsSorted() === "asc" ? <ArrowUp className="w-3 h-3" /> : column.getIsSorted() === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-30" />}
          </button>
        ),
        cell: (info) => <div className="text-right text-sm text-[--text-secondary]">{formatMoney(Number(info.getValue()))}</div>,
      }),
      columnHelper.accessor("realized_pnl", {
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center justify-end w-full gap-1 hover:text-[--text-primary] transition-colors">
            Realized P&L
            {column.getIsSorted() === "asc" ? <ArrowUp className="w-3 h-3" /> : column.getIsSorted() === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-30" />}
          </button>
        ),
        cell: (info) => {
          const val = info.getValue();
          if (val === null || val === undefined) return <div className="text-right text-sm text-[--text-muted]">-</div>;
          const isPositive = val >= 0;
          return (
            <div className={`text-right text-sm ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
              {isPositive ? '+' : ''}{formatMoney(val)}
            </div>
          );
        },
      }),
    ],
    []
  );

  const filteredTrades = useMemo(() => {
    if (!globalFilter) return trades;
    const lower = globalFilter.toLowerCase();
    return trades.filter(t => 
      t.fund_name.toLowerCase().includes(lower) || 
      t.trade_type.toLowerCase().includes(lower)
    );
  }, [trades, globalFilter]);

  const table = useReactTable({
    data: filteredTrades,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 50 },
    },
  });

  if (trades.length === 0) {
    return (
      <EmptyState 
        icon="📜"
        title="No history"
        description="You have no recorded mutual fund trades yet."
      />
    );
  }

  return (
    <div className="bg-[#0a0a0a] rounded-md border border-white/10 flex flex-col">
      <div className="p-3 border-b border-white/10 flex items-center justify-between">
        <input
          type="text"
          placeholder="Search by name or type"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="bg-transparent border-none outline-none text-sm text-[--text-primary] placeholder-[--text-muted] w-full max-w-xs px-2"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-white/10">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 text-xs font-normal text-[--text-muted] whitespace-nowrap bg-white/[0.02]">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-white/5">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="group hover:bg-white/[0.02] transition-colors cursor-pointer">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {table.getPageCount() > 1 && (
        <div className="p-3 border-t border-white/10 flex items-center justify-between text-xs text-[--text-muted]">
          <div>
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, filteredTrades.length)} of {filteredTrades.length} entries
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-2 py-1 disabled:opacity-30 hover:text-white"
            >
              Previous
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-2 py-1 disabled:opacity-30 hover:text-white"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
