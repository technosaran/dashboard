"use client";

import { useMemo, useState } from "react";
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
import { getTableHeaderClass, getTableCellClass } from "@/lib/utils";

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
  source_type: string | null;
  source_id: string | null;
};

interface LedgerDataTableProps {
  logs: LedgerLog[];
  getLogCurrency: (accountId: string | null) => string;
  isDebitLog: (log: LedgerLog) => boolean;
  isCreditLog: (log: LedgerLog) => boolean;
  getActionBadge: (log: LedgerLog) => React.ReactNode;
  formatMoney: (val: number | null, currency: string) => string;
  onReset: () => void;
  onRevert: (logId: string) => void;
}

const columnHelper = createColumnHelper<LedgerLog>();

export default function LedgerDataTable({
  logs,
  getLogCurrency,
  isDebitLog,
  isCreditLog,
  getActionBadge,
  formatMoney,
  onReset,
  onRevert,
}: LedgerDataTableProps) {
  const [isReverting, setIsReverting] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);

  const getVoucherType = (type: string) => {
    if (type === "CREATE" || type === "TRANSFER_IN" || type === "ADJUST_UP") return "RECEIPT";
    if (type === "DELETE" || type === "TRANSFER_OUT" || type === "SEND_MONEY" || type === "ADJUST_DOWN") return "PAYMENT";
    return "JOURNAL";
  };

  const getSourceLabel = (srcType: string | null) => {
    if (!srcType) return "Manual";
    switch (srcType.toLowerCase()) {
      case "family_transfer": return "Family";
      case "investment": return "Stocks";
      case "mutual_fund": return "Mutual Funds";
      case "bond": return "Bonds";
      case "forex": return "Forex";
      case "alternative_asset": return "Alt Assets";
      case "liability": return "Liabilities";
      case "goal": return "Goals";
      case "transfer": return "Transfer";
      case "income": return "Income";
      case "expense": return "Expense";
      default: return srcType;
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor("created_at", {
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center gap-1 uppercase tracking-[0.2em] hover:text-white transition-colors">
            Date
            {column.getIsSorted() === "asc" ? <ArrowUp className="w-3 h-3" /> : column.getIsSorted() === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-50" />}
          </button>
        ),
        cell: (info) => {
          const val = info.getValue();
          return <span className="text-xs text-white font-medium whitespace-nowrap">{val ? format(new Date(val), "dd-MM-yyyy") : "—"}</span>;
        },
        sortingFn: "datetime",
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: (info) => {
          const log = info.row.original;
          return (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={async () => {
                  setIsReverting(log.id);
                  await onRevert(log.id);
                  setIsReverting(null);
                }}
                disabled={isReverting === log.id}
                className="text-[9px] font-black uppercase tracking-widest text-rose-500 hover:text-white bg-rose-500/5 hover:bg-rose-500 border border-rose-500/10 px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                {isReverting === log.id ? "..." : "Revert"}
              </button>
            </div>
          );
        },
      }),
      columnHelper.accessor("account_name", {
        header: "Account",
        cell: (info) => <span className="text-xs font-semibold text-[--text-secondary] whitespace-nowrap">{info.getValue() || "—"}</span>
      }),
      columnHelper.accessor("source_type", {
        header: "Source",
        cell: (info) => {
          const val = info.getValue();
          const label = getSourceLabel(val);
          return (
            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-[4px] bg-white/5 border border-white/10 text-gray-300 whitespace-nowrap">
              {label}
            </span>
          );
        }
      }),
      columnHelper.display({
        id: "action_badge",
        header: "Action",
        cell: (info) => getActionBadge(info.row.original)
      }),
      columnHelper.accessor("action_type", {
        header: "Voucher",
        cell: (info) => {
          const val = info.getValue();
          const vType = getVoucherType(val);
          return (
            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-[4px] ${
              vType === "RECEIPT" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
              vType === "PAYMENT" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
            } whitespace-nowrap`}>
              {vType}
            </span>
          );
        }
      }),
      columnHelper.accessor("details", {
        header: "Particulars",
        cell: (info) => {
          const details = info.getValue() || "No details provided";
          return (
            <div className="text-xs text-gray-300 leading-relaxed max-w-[240px] break-words">
              {details}
            </div>
          );
        }
      }),
      columnHelper.accessor("previous_balance", {
        header: () => <div className="text-right w-full">Prev Balance</div>,
        cell: (info) => {
          const log = info.row.original;
          if (log.previous_balance === null) return <div className="text-right text-xs text-gray-600">—</div>;
          return (
            <div className="text-right text-xs font-medium text-[--text-secondary] tabular-nums whitespace-nowrap">
              {formatMoney(log.previous_balance, getLogCurrency(log.account_id))}
            </div>
          );
        }
      }),
      columnHelper.display({
        id: "debit",
        header: () => <div className="text-right w-full">Debit (Dr)</div>,
        cell: (info) => {
          const log = info.row.original;
          const isDebit = isDebitLog(log);
          if (!isDebit || log.amount === null) return <div className="text-right text-xs text-gray-600">—</div>;
          return (
            <div className="text-right text-[13px] font-bold text-rose-400 tabular-nums whitespace-nowrap">
              {formatMoney(log.amount, getLogCurrency(log.account_id))}
            </div>
          );
        }
      }),
      columnHelper.display({
        id: "credit",
        header: () => <div className="text-right w-full">Credit (Cr)</div>,
        cell: (info) => {
          const log = info.row.original;
          const isCredit = isCreditLog(log);
          if (!isCredit || log.amount === null) return <div className="text-right text-xs text-gray-600">—</div>;
          return (
            <div className="text-right text-[13px] font-bold text-emerald-400 tabular-nums whitespace-nowrap">
              {formatMoney(log.amount, getLogCurrency(log.account_id))}
            </div>
          );
        }
      }),
      columnHelper.accessor("new_balance", {
        header: () => <div className="text-right w-full">Closing Balance</div>,
        cell: (info) => {
          const log = info.row.original;
          if (log.new_balance === null) return <div className="text-right text-xs text-gray-600">—</div>;
          return (
            <div className="text-right text-[13px] font-bold text-white tabular-nums whitespace-nowrap">
              {formatMoney(log.new_balance, getLogCurrency(log.account_id))}
            </div>
          );
        }
      }),
    ],
    [getLogCurrency, isDebitLog, isCreditLog, formatMoney, onRevert, isReverting, getActionBadge]
  );

  // eslint-disable-next-line react-hooks/incompatible-library
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
        <table className="min-w-full divide-y divide-white/10">
          <thead className="bg-white/[0.02]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-white/10">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className={`px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] ${getTableHeaderClass(header.column.id)}`}>
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
                  <td key={cell.id} className={`px-6 py-4.5 ${getTableCellClass(cell.column.id)}`}>
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
                {getActionBadge(log)}
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
                {log.source_type && log.source_type !== "account" && (
                  <button
                    type="button"
                    onClick={async () => {
                      setIsReverting(log.id);
                      await onRevert(log.id);
                      setIsReverting(null);
                    }}
                    disabled={isReverting === log.id}
                    className="text-[9px] font-black uppercase tracking-widest text-danger hover:text-white bg-danger/10 hover:bg-danger/20 border border-danger/20 px-2 py-1 rounded transition-all disabled:opacity-50"
                  >
                    {isReverting === log.id ? "..." : "Revert"}
                  </button>
                )}
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
