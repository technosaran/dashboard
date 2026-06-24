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
import { ArrowUpDown, ArrowUp, ArrowDown, Edit, TrendingDown } from "lucide-react";
import type { Tables } from "@/lib/database.types";
import PnLValue from "@/components/pnl-value";

type Stock = Tables<"investments"> & { day_change?: number; day_change_percent?: number };

interface StocksDataTableProps {
  stocks: Stock[];
  onEdit: (stock: Stock) => void;
  onSell: (stock: Stock) => void;
  onAdd: () => void;
}

const columnHelper = createColumnHelper<Stock>();

export default function StocksDataTable({ stocks, onEdit, onSell, onAdd }: StocksDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Stock",
        cell: (info) => (
          <div className="flex flex-col max-w-[200px]">
            <p className="text-[13px] font-bold text-white truncate hover:text-clip hover:absolute hover:bg-black hover:z-10 hover:p-1 hover:rounded-md hover:border hover:border-white/10" title={info.getValue()}>{info.getValue()}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] truncate">{info.row.original.symbol || "N/A"}</p>
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
          const invested = Number(info.row.original.quantity) * Number(info.row.original.buy_price);
          return (
            <div className="flex flex-col">
              <span className="text-[12px] font-bold text-white">
                {info.row.original.currency === 'USD' ? '$' : '₹'}{invested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[9px] text-[--text-muted]">{Number(info.row.original.quantity).toFixed(2)} qty</span>
            </div>
          );
        },
        sortingFn: (rowA, rowB) => {
          const invA = Number(rowA.original.quantity) * Number(rowA.original.buy_price);
          const invB = Number(rowB.original.quantity) * Number(rowB.original.buy_price);
          return invA - invB;
        }
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
          const current = Number(info.row.original.quantity) * Number(info.row.original.current_price);
          return (
            <div className="flex flex-col">
              <span className="text-[12px] font-bold text-white">
                {info.row.original.currency === 'USD' ? '$' : '₹'}{current.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[9px] text-[--text-muted]">LTP: {info.row.original.currency === 'USD' ? '$' : '₹'}{Number(info.row.original.current_price).toFixed(2)}</span>
            </div>
          );
        },
        sortingFn: (rowA, rowB) => {
          const valA = Number(rowA.original.quantity) * Number(rowA.original.current_price);
          const valB = Number(rowB.original.quantity) * Number(rowB.original.current_price);
          return valA - valB;
        }
      }),
      columnHelper.display({
        id: "pnl",
        header: "Returns",
        cell: (info) => {
          const invested = Number(info.row.original.quantity) * Number(info.row.original.buy_price);
          const current = Number(info.row.original.quantity) * Number(info.row.original.current_price);
          const pnl = current - invested;
          const pct = invested > 0 ? (pnl / invested) * 100 : 0;
          return <PnLValue amount={pnl} percentage={pct} showIcon currency={info.row.original.currency} />;
        },
      }),
      columnHelper.display({
        id: "dayChange",
        header: "1D Change",
        cell: (info) => {
          const dayPnl = Number(info.row.original.day_change || 0) * Number(info.row.original.quantity);
          const pct = Number(info.row.original.day_change_percent || 0);
          return <PnLValue amount={dayPnl} percentage={pct} currency={info.row.original.currency} />;
        },
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: (info) => (
          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onSell(info.row.original)}
              className="p-2 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors"
              title="Sell Position"
            >
              <TrendingDown className="w-4 h-4" />
            </button>
            <button
              onClick={() => onEdit(info.row.original)}
              className="p-2 rounded-lg bg-white/5 text-[--text-muted] hover:bg-[--accent-primary] hover:text-white transition-colors"
              title="Edit Stock"
            >
              <Edit className="w-4 h-4" />
            </button>
          </div>
        ),
      }),
    ],
    [onEdit, onSell]
  );

  const filteredStocks = useMemo(() => {
    if (!globalFilter) return stocks;
    const lower = globalFilter.toLowerCase();
    return stocks.filter(s => 
      s.name.toLowerCase().includes(lower) || 
      (s.symbol && s.symbol.toLowerCase().includes(lower))
    );
  }, [stocks, globalFilter]);

  const table = useReactTable({
    data: filteredStocks,
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

  if (stocks.length === 0) {
    return (
      <EmptyState 
        icon="🏢"
        title="No Stock Holdings"
        description="You have no active stock investments."
        action={
          <button onClick={onAdd} className="btn-primary">
            Record Trade
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
            placeholder="Search stocks..."
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
                  No stocks match your search.
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
