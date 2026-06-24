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
import { ArrowUpDown, ArrowUp, ArrowDown, LogOut, Trash2 } from "lucide-react";
import type { FnoTrade } from "@/hooks/use-finance-data";
import PnLValue from "@/components/pnl-value";

interface FnoDataTableProps {
  trades: FnoTrade[];
  onCloseTrade?: (trade: FnoTrade) => void;
  onDeleteTrade?: (id: string) => void;
  onAdd?: () => void;
  showActions: boolean;
}

const columnHelper = createColumnHelper<FnoTrade>();

export default function FNODataTable({ trades, onCloseTrade, onDeleteTrade, onAdd, showActions }: FnoDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = useMemo(() => {
    const cols: any[] = [
      columnHelper.accessor("symbol", {
        header: "Instrument",
        cell: (info) => (
          <div className="flex flex-col max-w-[150px]">
            <p className="text-[13px] font-bold text-white truncate hover:text-clip hover:absolute hover:bg-black hover:z-10 hover:p-1 hover:rounded-md hover:border hover:border-white/10" title={info.getValue()}>
              {info.getValue()}
              <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest uppercase ${
                info.row.original.instrument_type === 'FUT' ? 'bg-sky-500/10 text-sky-400' :
                info.row.original.instrument_type === 'CE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
              }`}>
                {info.row.original.instrument_type}
              </span>
            </p>
            {info.row.original.strike_price && (
              <p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted]">Strike: {info.row.original.strike_price}</p>
            )}
          </div>
        ),
      }),
      columnHelper.accessor("trade_type", {
        header: "Type",
        cell: (info) => (
          <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${info.getValue() === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("quantity", {
        header: "Qty & Entry",
        cell: (info) => (
          <div className="flex flex-col">
            <span className="text-[12px] font-bold text-white">{info.getValue()} qty</span>
            <span className="text-[9px] text-[--text-muted]">@ ₹{Number(info.row.original.entry_price).toLocaleString()}</span>
          </div>
        ),
      }),
      columnHelper.accessor("trade_date", {
        header: "Dates",
        cell: (info) => (
          <div className="flex flex-col">
            <span className="text-[11px] text-white">Entry: {format(parseISO(info.getValue()), "MMM d, yyyy")}</span>
            <span className="text-[9px] text-[--text-muted]">Exp: {format(parseISO(info.row.original.expiry_date), "MMM d, yyyy")}</span>
          </div>
        ),
      }),
      columnHelper.accessor("pnl", {
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center gap-1 uppercase tracking-[0.2em] hover:text-white transition-colors">
            P&L
            {column.getIsSorted() === "asc" ? <ArrowUp className="w-3 h-3" /> : column.getIsSorted() === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-50" />}
          </button>
        ),
        cell: (info) => {
          if (info.row.original.status === 'OPEN') return <span className="text-[11px] text-[--text-muted] italic">Open</span>;
          const pnl = Number(info.getValue());
          return <PnLValue amount={pnl} showIcon currency="INR" />;
        },
        sortingFn: (rowA, rowB) => Number(rowA.original.pnl) - Number(rowB.original.pnl)
      })
    ];

    if (showActions) {
      cols.push(
        columnHelper.display({
          id: "actions",
          header: "",
          cell: (info) => (
            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {info.row.original.status === 'OPEN' && onCloseTrade && (
                <button
                  onClick={() => onCloseTrade(info.row.original)}
                  className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-colors"
                  title="Close Position"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
              {onDeleteTrade && (
                <button
                  onClick={() => onDeleteTrade(info.row.original.id)}
                  className="p-2 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors"
                  title="Delete Trade"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ),
        })
      );
    }
    return cols;
  }, [showActions, onCloseTrade, onDeleteTrade]);

  const filteredTrades = useMemo(() => {
    if (!globalFilter) return trades;
    const lower = globalFilter.toLowerCase();
    return trades.filter(t => 
      t.symbol.toLowerCase().includes(lower) || 
      (t.notes && t.notes.toLowerCase().includes(lower))
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
      pagination: { pageSize: 15 },
    },
  });

  if (trades.length === 0) {
    return (
      <EmptyState 
        icon="⚡"
        title="No F&O Trades Found"
        description="There are no F&O trades matching the criteria."
        action={onAdd ? (
          <button onClick={onAdd} className="btn-primary">
            Log First Trade
          </button>
        ) : undefined}
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
            placeholder="Search F&O trades..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="input-premium pl-9 py-2 text-sm w-full sm:w-64 !bg-black/20"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
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
                  No trades match your search.
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
