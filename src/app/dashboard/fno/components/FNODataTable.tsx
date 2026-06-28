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
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { FnoTrade } from "@/hooks/use-finance-data";

interface FnoDataTableProps {
  trades: FnoTrade[];
  onCloseTrade?: (trade: FnoTrade) => void;
  onDeleteTrade?: (id: string) => void;
  onAdd?: () => void;
  showActions: boolean;
  livePrices?: Record<string, { price: number; prevClose?: number }>;
}

const columnHelper = createColumnHelper<FnoTrade>();

export default function FNODataTable({ trades, onCloseTrade, onDeleteTrade, onAdd, showActions, livePrices }: FnoDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);


  const formatMoney = (val: number) => val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const columns = useMemo(() => {
    const cols: any[] = [
      columnHelper.accessor("symbol", {
        header: "Instrument",
        cell: (info) => (
          <div className="flex flex-col">
            <span className="text-sm font-medium text-[--text-primary]" title={info.getValue()}>
              {info.getValue()}
              <span className={`ml-2 px-1 py-0.5 rounded text-[9px] font-semibold tracking-wider ${
                info.row.original.instrument_type === 'FUT' ? 'bg-[#2185d0]/10 text-[#2185d0]' :
                info.row.original.instrument_type === 'CE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
              }`}>
                {info.row.original.instrument_type}
              </span>
            </span>
            {info.row.original.strike_price && (
              <span className="text-[10px] text-[--text-muted]">Strike: {info.row.original.strike_price}</span>
            )}
          </div>
        ),
      }),
      columnHelper.accessor("trade_type", {
        header: "Product",
        cell: (info) => {
          const isBuy = info.getValue() === 'BUY';
          return (
            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${isBuy ? 'bg-[#2185d0]/10 text-[#2185d0]' : 'bg-rose-500/10 text-rose-500'}`}>
              {info.getValue()}
            </span>
          );
        },
      }),
      columnHelper.accessor("quantity", {
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center justify-end w-full gap-1 hover:text-[--text-primary] transition-colors">
            Qty.
            {column.getIsSorted() === "asc" ? <ArrowUp className="w-3 h-3" /> : column.getIsSorted() === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-30" />}
          </button>
        ),
        cell: (info) => <div className="text-right text-sm text-[--text-secondary]">{info.getValue()}</div>,
      }),
      columnHelper.accessor("entry_price", {
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center justify-end w-full gap-1 hover:text-[--text-primary] transition-colors">
            Avg. price
            {column.getIsSorted() === "asc" ? <ArrowUp className="w-3 h-3" /> : column.getIsSorted() === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-30" />}
          </button>
        ),
        cell: (info) => <div className="text-right text-sm text-[--text-secondary]">{formatMoney(Number(info.getValue()))}</div>,
      }),
      columnHelper.display({
        id: "ltp_or_exit",
        header: () => <div className="text-right text-xs font-normal text-[--text-muted]">LTP / Exit</div>,
        cell: (info) => {
          const trade = info.row.original;
          if (trade.status === 'OPEN') {
            const price = livePrices?.[trade.symbol]?.price;
            return <div className="text-right text-sm text-[--text-secondary]">{price ? `₹${formatMoney(price)}` : "—"}</div>;
          } else {
            return <div className="text-right text-sm text-[--text-secondary]">{trade.exit_price ? `₹${formatMoney(Number(trade.exit_price))}` : "—"}</div>;
          }
        }
      }),
      columnHelper.accessor("pnl", {
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center justify-end w-full gap-1 hover:text-[--text-primary] transition-colors">
            P&L
            {column.getIsSorted() === "asc" ? <ArrowUp className="w-3 h-3" /> : column.getIsSorted() === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-30" />}
          </button>
        ),
        cell: (info) => {
          const trade = info.row.original;
          if (trade.status === 'OPEN') {
            const ltp = livePrices?.[trade.symbol]?.price;
            if (!ltp) return <div className="text-right text-sm text-[--text-muted]">—</div>;
            const pnl = trade.trade_type === 'BUY' 
              ? (ltp - Number(trade.entry_price)) * Number(trade.quantity)
              : (Number(trade.entry_price) - ltp) * Number(trade.quantity);
            const isPositive = pnl >= 0;
            return (
              <div className={`text-right text-sm font-medium ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                {isPositive ? '+' : ''}{formatMoney(pnl)}
              </div>
            );
          }
          const pnl = Number(info.getValue());
          const isPositive = pnl >= 0;
          return (
            <div className={`text-right text-sm font-medium ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
              {isPositive ? '+' : ''}{formatMoney(pnl)}
            </div>
          );
        },
        sortingFn: (rowA, rowB) => {
          const getPnLValue = (row: typeof rowA) => {
            const trade = row.original;
            if (trade.status === 'OPEN') {
              const ltp = livePrices?.[trade.symbol]?.price;
              if (!ltp) return 0;
              return trade.trade_type === 'BUY'
                ? (ltp - Number(trade.entry_price)) * Number(trade.quantity)
                : (Number(trade.entry_price) - ltp) * Number(trade.quantity);
            }
            return Number(trade.pnl);
          };
          return getPnLValue(rowA) - getPnLValue(rowB);
        }
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
                  onClick={(e) => { e.stopPropagation(); onCloseTrade(info.row.original); }}
                  className="px-3 py-1 rounded bg-[#2185d0]/10 text-[#2185d0] hover:bg-[#2185d0] hover:text-white transition-colors text-xs font-semibold"
                >
                  Exit
                </button>
              )}
              {onDeleteTrade && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteTrade(info.row.original.id); }}
                  className="px-3 py-1 rounded bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors text-xs font-semibold"
                >
                  Delete
                </button>
              )}
            </div>
          ),
        })
      );
    }
    return cols;
  }, [showActions, onCloseTrade, onDeleteTrade, livePrices]);



  const table = useReactTable({
    data: trades,
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
        icon="⚡"
        title="No positions"
        description="You have no active F&O trades."
        action={onAdd ? (
          <button onClick={onAdd} className="btn-primary">
            Add Trade
          </button>
        ) : undefined}
      />
    );
  }

  return (
    <div className="bg-[#0a0a0a] rounded-md border border-white/10 flex flex-col">

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
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
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, trades.length)} of {trades.length} entries
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
