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
import { ArrowUpDown, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import type { Tables } from "@/lib/database.types";

type LedgerLog = Tables<"ledger_logs">;
type Recipient = Tables<"recipients">;
type Account = Tables<"accounts">;

interface FamilyDataTableProps {
  recentSends: LedgerLog[];
  accounts: Account[];
  recipients: Recipient[];
  getRecipientId: (log: LedgerLog) => string | null;
  onRevert: (id: string) => void;
  onAdd: () => void;
}

const columnHelper = createColumnHelper<LedgerLog>();

export default function FamilyDataTable({ recentSends, accounts, recipients, getRecipientId, onRevert, onAdd }: FamilyDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const getAccountCurrency = (accountId: string | null) => {
    if (!accountId) return "INR";
    const acc = accounts.find((a) => a.id === accountId);
    return acc ? acc.currency : "INR";
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
        cell: (info) => (
          <p className="text-[13px] font-bold text-[--text-primary]">
            {info.getValue() ? format(new Date(info.getValue() as string), "MMM d, yy") : "—"}
          </p>
        ),
        sortingFn: "datetime"
      }),
      columnHelper.accessor("details", {
        header: "Ref / Description",
        cell: (info) => {
          const recId = getRecipientId(info.row.original);
          const recipientName = recipients.find(r => r.id === recId)?.name || "Unknown";
          return (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg flex-shrink-0">
                👨‍👩‍👧‍👦
              </div>
              <p className="text-[13px] font-medium text-[--text-primary] group-hover:text-[--accent-primary] transition-colors truncate max-w-[120px] md:max-w-none">
                {info.row.original.details || `Transfer to ${recipientName}`}
              </p>
            </div>
          );
        },
      }),
      columnHelper.accessor((row) => getRecipientId(row), {
        id: "recipient",
        header: "Recipient",
        cell: (info) => {
          const recId = info.getValue();
          const recipientName = recipients.find(r => r.id === recId)?.name || "Unknown";
          return (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-[0.1em] bg-white/5 border border-white/10 text-[--accent-primary]">
              {recipientName}
            </span>
          );
        },
      }),
      columnHelper.accessor("account_id", {
        header: "Channel",
        cell: (info) => {
          const account = accounts.find((a) => a.id === info.getValue());
          return (
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="text-[11px] font-medium text-[--text-secondary]">{account?.name || "Cash"}</span>
            </div>
          );
        },
      }),
      columnHelper.accessor("amount", {
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center justify-end w-full gap-1 uppercase tracking-[0.2em] hover:text-white transition-colors">
            {column.getIsSorted() === "asc" ? <ArrowUp className="w-3 h-3" /> : column.getIsSorted() === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-50" />}
            Amount
          </button>
        ),
        cell: (info) => {
          const val = Number(info.getValue());
          const currency = getAccountCurrency(info.row.original.account_id);
          return (
            <p className="text-[15px] md:text-base font-black text-danger text-right">
              -{currency === "USD" ? "$" : "₹"}
              {val.toLocaleString()}
            </p>
          );
        },
        sortingFn: "basic"
      }),
      columnHelper.display({
        id: "actions",
        header: () => <div className="text-right">Action</div>,
        cell: (info) => (
          <button
            type="button"
            onClick={() => onRevert(info.row.original.id)}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-[--text-muted] hover:text-rose-400 hover:bg-rose-500/10 transition-all ml-auto flex items-center justify-center"
            title="Revert Transaction"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        ),
      }),
    ],
    [accounts, recipients, getRecipientId]
  );

  const table = useReactTable({
    data: recentSends,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  });

  return (
    <div className="glass-card-static p-0 min-h-[400px] rounded-[24px] border border-white/10 overflow-hidden bg-white/[0.01] shadow-lg shadow-black/25 flex flex-col">
      <div className="hidden md:block overflow-x-auto w-full">
        {recentSends.length === 0 ? (
          <EmptyState
            title="No Family Transfers Found"
            description="Start by sending money to a family member. Track every transfer here."
            icon={
              <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            }
            glowColor="indigo"
            action={
              <button type="button" onClick={onAdd} className="btn-primary shadow-xl shadow-[--accent-primary]/20 flex items-center gap-2">
                {recipients.length === 0 ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                    Add Contact
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                    Send Money
                  </>
                )}
              </button>
            }
          />
        ) : (
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
        )}
      </div>

      {/* Mobile View */}
      <div className="divide-y divide-white/5 bg-[#0a0e1c]/40 md:hidden">
        {table.getRowModel().rows.length === 0 ? (
          <div className="p-8 text-center text-[--text-muted] text-xs italic">
            No transactions found matching your criteria.
          </div>
        ) : (
          table.getRowModel().rows.map((row) => {
            const exp = row.original;
            const recId = getRecipientId(exp);
            const recipientName = recipients.find(r => r.id === recId)?.name || "Unknown";
            const account = accounts.find((a) => a.id === exp.account_id);
            return (
              <div key={row.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg flex-shrink-0">
                      👨‍👩‍👧‍👦
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[13px] font-bold text-white truncate">{exp.details || "Transfer"}</span>
                      <span className="text-[9px] text-[--text-muted] uppercase font-bold">{exp.created_at ? format(new Date(exp.created_at), "MMM d, yyyy") : "—"}</span>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <span className="text-[15px] font-black tabular-nums tracking-tight text-danger">-{getAccountCurrency(exp.account_id) === 'USD' ? '$' : '₹'}{Number(exp.amount).toLocaleString()}</span>
                    <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-[0.1em] bg-white/5 border border-white/10 text-[--accent-primary]">{recipientName}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-white/[0.03] pt-2 mt-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="text-[10px] font-medium text-[--text-secondary]">{account?.name || "Cash"}</span>
                  </div>
                  <button type="button" 
                    onClick={() => onRevert(exp.id)}
                    className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-bold text-[--text-secondary] active:bg-danger/10 active:text-danger"
                  >
                    Revert
                  </button>
                </div>
              </div>
            );
          })
        )}
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
