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
import { ArrowUpDown, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import type { Tables } from "@/lib/database.types";
import PnLValue from "@/components/pnl-value";
import { getTableHeaderClass, getTableCellClass } from "@/lib/utils";

type ForexAccount = Tables<"forex_accounts">;

interface ForexDataTableProps {
  accounts: ForexAccount[];
  onDelete: (id: string) => void;
  onAdd: () => void;
}

const columnHelper = createColumnHelper<ForexAccount>();

export default function ForexDataTable({ accounts, onDelete, onAdd }: ForexDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = useMemo(
    () => [
      columnHelper.accessor("account_label", {
        header: "Broker Account",
        cell: (info) => (
          <div className="flex flex-col max-w-[200px]">
            <p className="text-[13px] font-bold text-white truncate hover:text-clip hover:absolute hover:bg-black hover:z-10 hover:p-1 hover:rounded-md hover:border hover:border-white/10" title={info.getValue()}>{info.getValue()}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] truncate">{info.row.original.broker_name}</p>
          </div>
        ),
      }),
      columnHelper.accessor("account_number", {
        header: "Acc No.",
        cell: (info) => (
          <span className="text-[11px] font-mono text-[--text-secondary]">
            {info.getValue() || "N/A"}
          </span>
        ),
      }),
      columnHelper.display({
        id: "funding",
        header: "Funding (In / Out)",
        cell: (info) => {
          const inAmt = Number(info.row.original.total_deposited);
          const outAmt = Number(info.row.original.total_withdrawn);
          return (
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-[--text-secondary]">{info.row.original.currency === 'USD' ? '$' : '₹'}{inAmt.toLocaleString()} in</span>
              <span className="text-[11px] text-[--text-muted]">{info.row.original.currency === 'USD' ? '$' : '₹'}{outAmt.toLocaleString()} out</span>
            </div>
          );
        },
      }),
      columnHelper.display({
        id: "balance",
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center gap-1 uppercase tracking-[0.2em] hover:text-white transition-colors">
            Available Balance
            {column.getIsSorted() === "asc" ? <ArrowUp className="w-3 h-3" /> : column.getIsSorted() === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-50" />}
          </button>
        ),
        cell: (info) => {
          const bal = Number(info.row.original.balance);
          return (
            <span className="text-[13px] font-bold text-white">
              {info.row.original.currency === 'USD' ? '$' : '₹'}{bal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          );
        },
        sortingFn: (rowA, rowB) => Number(rowA.original.balance) - Number(rowB.original.balance)
      }),
      columnHelper.display({
        id: "pnl",
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center gap-1 uppercase tracking-[0.2em] hover:text-white transition-colors">
            Total P&L
            {column.getIsSorted() === "asc" ? <ArrowUp className="w-3 h-3" /> : column.getIsSorted() === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-50" />}
          </button>
        ),
        cell: (info) => {
          const pnl = Number(info.row.original.total_pnl);
          return <PnLValue amount={pnl} showIcon currency={info.row.original.currency} />;
        },
        sortingFn: (rowA, rowB) => Number(rowA.original.total_pnl) - Number(rowB.original.total_pnl)
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: (info) => (
          <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onDelete(info.row.original.id)}
              className="p-2 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors"
              title="Delete Account"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      }),
    ],
    [onDelete]
  );

  const filteredAccounts = useMemo(() => {
    if (!globalFilter) return accounts;
    const lower = globalFilter.toLowerCase();
    return accounts.filter(a => 
      a.account_label.toLowerCase().includes(lower) || 
      a.broker_name.toLowerCase().includes(lower) ||
      (a.account_number && a.account_number.toLowerCase().includes(lower))
    );
  }, [accounts, globalFilter]);

  const table = useReactTable({
    data: filteredAccounts,
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

  if (accounts.length === 0) {
    return (
      <EmptyState 
        icon="💱"
        title="No Broker Accounts"
        description="You have no active Forex broker accounts."
        action={
          <button onClick={onAdd} className="btn-primary">
            Add Broker Account
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
            placeholder="Search accounts..."
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
                  No accounts match your search.
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
