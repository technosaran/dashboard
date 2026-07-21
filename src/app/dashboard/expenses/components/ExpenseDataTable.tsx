"use client";

import { useCallback, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from "@tanstack/react-table";
import { EmptyState } from "@/components/empty-state";
import { ArrowUpDown, ArrowUp, ArrowDown, Trash2, Pencil } from "lucide-react";
import { getTableHeaderClass, getTableCellClass } from "@/lib/utils";

type Expense = {
  id: string;
  date: string | null;
  description: string;
  category: string;
  amount: string | number;
  account_id: string | null;
};

type Account = {
  id: string;
  name: string;
  currency: string;
  balance: number;
};

interface ExpenseDataTableProps {
  expenses: Expense[];
  accounts: Account[];
  onDelete: (id: string) => void;
  onEdit?: (expense: Expense) => void;
  onAdd: () => void;
  categories: { label: string; icon: string; color: string }[];
}

const PAGE_SIZE_OPTIONS = [25, 50, 100];

const columnHelper = createColumnHelper<Expense>();

export default function ExpenseDataTable({ expenses, accounts, onDelete, onEdit, onAdd, categories }: ExpenseDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [pageSize, setPageSize] = useState(50);

  const getAccountCurrency = useCallback((accountId: string | null) => {
    if (!accountId) return "INR";
    const acc = accounts.find((a) => a.id === accountId);
    return acc ? acc.currency : "INR";
  }, [accounts]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("date", {
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center gap-1 hover:text-white transition-colors">
            Date
            {column.getIsSorted() === "asc" ? <ArrowUp className="w-3 h-3" /> : column.getIsSorted() === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-50" />}
          </button>
        ),
        cell: (info) => (
          <p className="text-sm font-bold text-[--text-primary]">
            {info.getValue() ? format(parseISO(info.getValue() as string), "MMM d, yy") : "—"}
          </p>
        ),
        sortingFn: "datetime"
      }),
      columnHelper.accessor("description", {
        header: "Description",
        cell: (info) => {
          const cat = info.row.original.category;
          const theme = categories.find((c) => c.label === cat) || categories[7];
          return (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg flex-shrink-0">
                {theme.icon}
              </div>
              <p className="text-sm font-medium text-[--text-primary] group-hover:text-[--accent-primary] transition-colors truncate max-w-[120px] md:max-w-none">
                {info.getValue()}
              </p>
            </div>
          );
        },
      }),
      columnHelper.accessor("category", {
        header: "Category",
        cell: (info) => {
          const val = info.getValue();
          const theme = categories.find((c) => c.label === val) || categories[7];
          return (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-white/5 border border-white/10" style={{ color: theme.color }}>
              {val}
            </span>
          );
        },
      }),
      columnHelper.accessor("account_id", {
        header: "Account",
        cell: (info) => {
          const account = accounts.find((a) => a.id === info.getValue());
          return (
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="text-xs font-medium text-[--text-secondary]">{account?.name || "Cash"}</span>
            </div>
          );
        },
      }),
      columnHelper.accessor("amount", {
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center justify-end w-full gap-1 hover:text-white transition-colors">
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
        header: () => <div className="text-right">Actions</div>,
        cell: (info) => (
          <div className="flex items-center justify-end gap-1.5">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(info.row.original)}
                className="p-2 rounded-xl bg-white/5 border border-white/10 text-[--text-muted]"
                title="Edit Expense"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onDelete(info.row.original.id)}
              className="p-2 rounded-xl bg-white/5 border border-white/10 text-[--text-muted]"
              title="Delete Transaction"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ),
      }),
    ],
    [accounts, categories, getAccountCurrency, onDelete, onEdit]
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: expenses,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  // keep table in sync when pageSize changes
  useMemo(() => { table.setPageSize(pageSize); }, [pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="glass-card-static p-0 min-h-[400px] rounded-[24px] border border-white/10 overflow-hidden bg-white/[0.01] shadow-lg shadow-black/25 flex flex-col">

      {/* Toolbar: search + page size */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-5 py-4 border-b border-white/5 bg-white/[0.01]">
        <div className="relative w-full sm:w-64">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--text-muted]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            placeholder="Search expenses…"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="input-premium pl-9 py-2 text-sm w-full !bg-black/20"
          />
        </div>
        {/* #8 — page size selector */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-[--text-muted]">Rows</span>
          <div className="flex gap-1 rounded-xl bg-white/5 border border-white/10 p-0.5">
            {PAGE_SIZE_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPageSize(n)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${pageSize === n ? "bg-[--accent-primary] text-white" : "text-[--text-muted] hover:text-white"}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="hidden md:block overflow-x-auto w-full">
        {expenses.length === 0 ? (
          <EmptyState
            title="No expenses yet"
            description="Start by adding your first expense. Track every rupee to gain total control over your spending."
            icon={
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>
            }
            glowColor="rose"
            action={
              <button type="button" onClick={onAdd} className="btn-primary shadow-xl shadow-[--accent-primary]/20 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
                Add Your First Expense
              </button>
            }
          />
        ) : (
          <table className="min-w-full divide-y divide-white/10 table-fixed">
            <thead className="bg-white/[0.02]">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-white/10">
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className={`px-6 py-4 text-xs font-semibold text-[--text-muted] ${getTableHeaderClass(header.column.id)}`}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-white/10">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-white/5">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={`px-6 py-4 whitespace-nowrap ${getTableCellClass(cell.column.id)}`}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {table.getRowModel().rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center text-[--text-muted] text-sm italic">
                    No expenses match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile card view */}
      <div className="divide-y divide-white/5 bg-[#0a0e1c]/40 md:hidden">
        {table.getRowModel().rows.length === 0 ? (
          <div className="p-8 text-center text-[--text-muted] text-sm italic">
            No expenses match your search.
          </div>
        ) : (
          table.getRowModel().rows.map((row) => {
            const exp = row.original;
            const theme = categories.find((c) => c.label === exp.category) || categories[7];
            const account = accounts.find((a) => a.id === exp.account_id);
            return (
              <div key={row.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg flex-shrink-0">
                      {theme.icon}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-bold text-white truncate">{exp.description}</span>
                      <span className="text-xs text-[--text-muted]">{exp.date ? format(parseISO(exp.date), "MMM d, yyyy") : "—"}</span>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <span className="text-[15px] font-black tabular-nums tracking-tight text-danger">-{getAccountCurrency(exp.account_id) === 'USD' ? '$' : '₹'}{Number(exp.amount).toLocaleString()}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-white/5 border border-white/10" style={{color: theme.color}}>{exp.category}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-white/[0.03] pt-2 mt-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-medium text-[--text-secondary]">{account?.name || "Cash"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {onEdit && (
                      <button type="button"
                        onClick={() => onEdit(exp)}
                        className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-[--text-secondary] active:bg-[--accent-primary]/10 active:text-[--accent-primary]"
                      >
                        Edit
                      </button>
                    )}
                    <button type="button"
                      onClick={() => onDelete(exp.id)}
                      className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-[--text-secondary] active:bg-danger/10 active:text-danger"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between border-t border-white/10 p-4 bg-white/[0.01]">
          <span className="text-xs text-[--text-muted]">
            {table.getState().pagination.pageIndex * pageSize + 1}–{Math.min((table.getState().pagination.pageIndex + 1) * pageSize, table.getFilteredRowModel().rows.length)} of {table.getFilteredRowModel().rows.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="btn-secondary !h-9 !px-4 text-xs font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-xs text-[--text-muted] tabular-nums">{table.getState().pagination.pageIndex + 1} / {table.getPageCount()}</span>
            <button
              type="button"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="btn-secondary !h-9 !px-4 text-xs font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
