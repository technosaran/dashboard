"use client";

import { useMemo, useState, Fragment } from "react";
import { format } from "date-fns";
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

type LedgerLog = {
  id: string;
  created_at: string | null;
  account_name: string | null;
  account_id: string | null;
  action_type: string;
  amount: number | null;
  previous_balance: number | null;
  new_balance: number | null;
  details: string | null;
};

interface LedgerDataTableProps {
  logs: LedgerLog[];
  getLogCurrency: (accountId: string | null) => string;
  isDebitLog: (log: LedgerLog) => boolean;
  getActionBadge: (type: string) => React.ReactNode;
  formatMoney: (val: number | null, currency: string) => string;
  onReset: () => void;
}

const columnHelper = createColumnHelper<LedgerLog>();

export default function LedgerDataTable({
  logs,
  getLogCurrency,
  isDebitLog,
  getActionBadge,
  formatMoney,
  onReset,
}: LedgerDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("created_at", {
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center gap-1 uppercase tracking-[0.2em] hover:text-white transition-colors">
            Timestamp
            {column.getIsSorted() === "asc" ? <ArrowUp className="w-3 h-3" /> : column.getIsSorted() === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-50" />}
          </button>
        ),
        cell: (info) => {
          const val = info.getValue();
          return (
            <div>
              <p className="text-xs font-bold text-white tracking-tight">
                {val ? format(new Date(val), "MMM d, yyyy") : "—"}
              </p>
              <p className="text-[10px] font-mono text-[--text-muted] mt-1 tracking-widest uppercase">
                {val ? format(new Date(val), "hh:mm:ss a") : "—"}
              </p>
            </div>
          );
        },
        sortingFn: "datetime",
      }),
      columnHelper.accessor("action_type", {
        header: "Action Type",
        cell: (info) => getActionBadge(info.getValue()),
      }),
      columnHelper.accessor("account_name", {
        header: "Registry Account",
        cell: (info) => (
          <span className="text-xs font-bold text-white tracking-tight px-2 py-1 rounded bg-white/5 border border-white/10">
            {info.getValue() || "System"}
          </span>
        ),
      }),
      columnHelper.accessor("details", {
        header: "Audit Details",
        cell: (info) => (
          <div className="text-xs text-[--text-secondary] leading-relaxed break-words max-w-[300px]">
            {info.getValue() || "No transactional details provided"}
          </div>
        ),
      }),
      columnHelper.accessor("amount", {
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center justify-end w-full gap-1 uppercase tracking-[0.2em] hover:text-white transition-colors">
            {column.getIsSorted() === "asc" ? <ArrowUp className="w-3 h-3" /> : column.getIsSorted() === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-50" />}
            Amount Flow
          </button>
        ),
        cell: (info) => {
          const log = info.row.original;
          const isDebit = isDebitLog(log);
          return (
            <div className="text-right">
              <p className={`text-base font-black tabular-nums tracking-tight ${isDebit ? "text-danger" : "text-success"}`}>
                {log.amount !== null ? `${isDebit ? "-" : "+"}${formatMoney(log.amount, getLogCurrency(log.account_id))}` : "—"}
              </p>
              {log.new_balance !== null && (
                <p className="text-[10px] font-bold text-[--text-muted] mt-1.5 uppercase tracking-widest opacity-60">
                  Bal: {formatMoney(log.new_balance, getLogCurrency(log.account_id))}
                </p>
              )}
            </div>
          );
        },
      }),
    ],
    [getLogCurrency, isDebitLog, getActionBadge, formatMoney]
  );

  const table = useReactTable({
    data: logs,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 50 },
      sorting: [{ id: "created_at", desc: true }]
    },
  });

  if (logs.length === 0) {
    return (
      <div className="glass-card-static p-0 min-h-[400px] rounded-[24px] border border-white/10 overflow-hidden bg-white/[0.01] shadow-lg shadow-black/25">
        <EmptyState
          title="No Ledger Entries Located"
          description="No transaction matches the current date filters."
          icon="🛡️"
          glowColor="indigo"
          action={
            <button
              type="button"
              onClick={onReset}
              className="btn-secondary !h-10 !px-6 text-[10px] font-black uppercase tracking-widest rounded-xl"
            >
              Restore Audit Stream
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="glass-card-static p-0 min-h-[400px] rounded-[24px] border border-white/10 overflow-hidden bg-white/[0.01] shadow-lg shadow-black/25 flex flex-col">
      <div className="w-full overflow-x-auto hidden md:block">
        <table className="min-w-full divide-y divide-white/10 table-fixed">
          <thead className="bg-white/[0.02]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-white/10">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-white/10">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="transition-colors hover:bg-white/[0.02] border-b border-white/5">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-6 py-4.5 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="divide-y divide-white/5 bg-[#0a0e1c]/40 md:hidden">
        {table.getRowModel().rows.map((row) => {
          const log = row.original;
          const isDebit = isDebitLog(log);
          return (
            <article key={log.id} className="p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-mono text-[--text-muted] tracking-wider uppercase">
                    {log.created_at ? format(new Date(log.created_at), "MMM d, hh:mm a") : "—"}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-black text-white tracking-tight px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                      {log.account_name || "System"}
                    </span>
                  </div>
                </div>
                {getActionBadge(log.action_type)}
              </div>

              <p className="text-xs text-[--text-secondary] leading-relaxed break-words">{log.details || "No details"}</p>

              <div className="flex items-end justify-between mt-1">
                <div>
                  <p className={`text-base font-black tabular-nums tracking-tight ${isDebit ? "text-danger" : "text-success"}`}>
                    {log.amount !== null ? `${isDebit ? "-" : "+"}${formatMoney(log.amount, getLogCurrency(log.account_id))}` : "—"}
                  </p>
                  {log.new_balance !== null && (
                    <p className="text-[9px] font-bold text-[--text-muted] mt-0.5 uppercase tracking-widest opacity-60">
                      Bal: {formatMoney(log.new_balance, getLogCurrency(log.account_id))}
                    </p>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Pagination Controls */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between border-t border-white/10 p-5 bg-white/[0.01]">
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="btn-secondary !h-10 !px-4 text-[10px] font-black uppercase tracking-widest rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="btn-secondary !h-10 !px-4 text-[10px] font-black uppercase tracking-widest rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
