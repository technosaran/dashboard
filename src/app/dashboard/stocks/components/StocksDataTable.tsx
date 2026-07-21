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
import { getTableHeaderClass, getTableCellClass } from "@/lib/utils";

type Stock = Tables<"investments"> & { day_change?: number; day_change_percent?: number };

interface StocksDataTableProps {
  stocks: Stock[];
  onEdit: (stock: Stock) => void;
  onBuy: (stock: Stock) => void;
  onSell: (stock: Stock) => void;
  onAdd: () => void;
}

const columnHelper = createColumnHelper<Stock>();

export default function StocksDataTable({ stocks, onEdit, onBuy, onSell, onAdd }: StocksDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);


  const formatMoney = (val: number) => val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Instrument",
        cell: (info) => (
          <div className="flex flex-col">
            <span className="text-sm font-medium text-[--text-primary]" title={info.getValue()}>{info.row.original.symbol || info.getValue()}</span>
          </div>
        ),
      }),
      columnHelper.accessor("quantity", {
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center justify-end w-full gap-1 hover:text-[--text-primary] transition-colors">
            Qty.
            {column.getIsSorted() === "asc" ? <ArrowUp className="w-3 h-3" /> : column.getIsSorted() === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-30" />}
          </button>
        ),
        cell: (info) => <div className="text-right text-sm text-[--text-secondary]">{Number(info.getValue()).toString()}</div>,
      }),
      columnHelper.accessor("buy_price", {
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center justify-end w-full gap-1 hover:text-[--text-primary] transition-colors">
            Avg. cost
            {column.getIsSorted() === "asc" ? <ArrowUp className="w-3 h-3" /> : column.getIsSorted() === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-30" />}
          </button>
        ),
        cell: (info) => <div className="text-right text-sm text-[--text-secondary]">{formatMoney(Number(info.getValue()))}</div>,
      }),
      columnHelper.accessor("current_price", {
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center justify-end w-full gap-1 hover:text-[--text-primary] transition-colors">
            LTP
            {column.getIsSorted() === "asc" ? <ArrowUp className="w-3 h-3" /> : column.getIsSorted() === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-30" />}
          </button>
        ),
        cell: (info) => {
          const ltp = Number(info.getValue());
          const prev = Number(info.row.original.previous_close || ltp);
          const isUp = ltp >= prev;
          return <div className={`text-right text-sm font-medium ${isUp ? 'text-emerald-500' : 'text-rose-500'}`}>{formatMoney(ltp)}</div>;
        },
      }),
      columnHelper.display({
        id: "curVal",
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center justify-end w-full gap-1 hover:text-[--text-primary] transition-colors">
            Cur. val
            {column.getIsSorted() === "asc" ? <ArrowUp className="w-3 h-3" /> : column.getIsSorted() === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-30" />}
          </button>
        ),
        cell: (info) => {
          const val = Number(info.row.original.quantity) * Number(info.row.original.current_price);
          return <div className="text-right text-sm text-[--text-secondary]">{formatMoney(val)}</div>;
        },
        sortingFn: (rowA, rowB) => {
          return (Number(rowA.original.quantity) * Number(rowA.original.current_price)) - (Number(rowB.original.quantity) * Number(rowB.original.current_price));
        }
      }),
      columnHelper.display({
        id: "pnl",
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center justify-end w-full gap-1 hover:text-[--text-primary] transition-colors">
            P&L
            {column.getIsSorted() === "asc" ? <ArrowUp className="w-3 h-3" /> : column.getIsSorted() === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-30" />}
          </button>
        ),
        cell: (info) => {
          const inv = Number(info.row.original.quantity) * Number(info.row.original.buy_price);
          const cur = Number(info.row.original.quantity) * Number(info.row.original.current_price);
          const pnl = cur - inv;
          const pct = inv > 0 ? (pnl / inv) * 100 : 0;
          const isPositive = pnl >= 0;
          return (
            <div 
              className="text-right text-sm font-black"
              style={{ 
                color: isPositive ? '#34d399' : '#f87171',
                textShadow: isPositive ? '0 0 8px rgba(52,211,153,0.35)' : '0 0 8px rgba(248,113,113,0.35)'
              }}
            >
              <div>{isPositive ? '+' : ''}{formatMoney(pnl)}</div>
              <div className="text-xs opacity-90">{isPositive ? '+' : ''}{pct.toFixed(2)}%</div>
            </div>
          );
        },
        sortingFn: (rowA, rowB) => {
          const invA = Number(rowA.original.quantity) * Number(rowA.original.buy_price);
          const curA = Number(rowA.original.quantity) * Number(rowA.original.current_price);
          const invB = Number(rowB.original.quantity) * Number(rowB.original.buy_price);
          const curB = Number(rowB.original.quantity) * Number(rowB.original.current_price);
          return (curA - invA) - (curB - invB);
        }
      }),
      columnHelper.display({
        id: "netChg",
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center justify-end w-full gap-1 hover:text-[--text-primary] transition-colors">
            Net chg.
            {column.getIsSorted() === "asc" ? <ArrowUp className="w-3 h-3" /> : column.getIsSorted() === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-30" />}
          </button>
        ),
        cell: (info) => {
          const pct = Number(info.row.original.day_change_percent || 0);
          const isPositive = pct >= 0;
          return (
            <div 
              className="text-right text-sm font-black"
              style={{ 
                color: isPositive ? '#34d399' : '#f87171',
                textShadow: isPositive ? '0 0 8px rgba(52,211,153,0.35)' : '0 0 8px rgba(248,113,113,0.35)'
              }}
            >
              {isPositive ? '+' : ''}{pct.toFixed(2)}%
            </div>
          );
        },
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: (info) => (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(info.row.original); }}
              className="px-2.5 py-1 rounded bg-white/5 text-xs font-bold text-gray-300 cursor-pointer"
              title="Edit holding details"
            >
              ✏️
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onBuy(info.row.original); }}
              className="px-3 py-1 rounded bg-blue-500/10 text-blue-400 text-xs font-semibold cursor-pointer"
            >
              Buy
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onSell(info.row.original); }}
              className="px-3 py-1 rounded bg-rose-500/10 text-rose-400 text-xs font-semibold cursor-pointer"
            >
              Sell
            </button>
          </div>
        ),
      }),
    ],
    [onEdit, onBuy, onSell]
  );



  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: stocks,
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

  if (stocks.length === 0) {
    return (
      <EmptyState 
        icon="🏢"
        title="No holdings"
        description="You have no active stock investments."
        action={
          <button onClick={onAdd} className="btn-primary">
            Add Trade
          </button>
        }
      />
    );
  }

  return (
    <div className="bg-[var(--bg-deep)] rounded-md border border-white/10 flex flex-col">

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-white/10">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className={`px-4 py-3 text-xs font-normal text-[--text-muted] whitespace-nowrap bg-white/[0.02] ${getTableHeaderClass(header.column.id)}`}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-white/5">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="cursor-pointer">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={`px-4 py-3 align-middle ${getTableCellClass(cell.column.id)}`}>
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
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, stocks.length)} of {stocks.length} entries
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
