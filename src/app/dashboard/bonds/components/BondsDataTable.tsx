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
import { ArrowUpDown, ArrowUp, ArrowDown, Edit, Grid, List } from "lucide-react";
import type { Tables } from "@/lib/database.types";
import PnLValue from "@/components/pnl-value";
import { getTableHeaderClass, getTableCellClass } from "@/lib/utils";

type Bond = Tables<"bonds">;

interface BondsDataTableProps {
  bonds: Bond[];
  onEdit: (bond: Bond) => void;
  onAdd: () => void;
}

const columnHelper = createColumnHelper<Bond>();

export default function BondsDataTable({ bonds, onEdit, onAdd }: BondsDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  const getRatingBadgeClass = (rating: string | null) => {
    if (!rating) return "bg-gray-500/10 text-gray-400 border-gray-500/20";
    const r = rating.toUpperCase();
    if (r.includes("AAA") || r.includes("SOVEREIGN")) {
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    }
    if (r.includes("AA")) {
      return "bg-sky-500/10 text-sky-400 border-sky-500/20";
    }
    if (r.includes("A")) {
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    }
    return "bg-rose-500/10 text-rose-400 border-rose-500/20";
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor("bond_name", {
        header: "Bond",
        cell: (info) => (
          <div className="flex flex-col max-w-[200px]">
            <p className="text-[13px] font-bold text-white truncate" title={info.getValue()}>{info.getValue()}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] truncate">{info.row.original.issuer || "N/A"} • {info.row.original.isin || "N/A"}</p>
          </div>
        ),
      }),
      columnHelper.accessor("bond_type", {
        header: "Type",
        cell: (info) => (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-[0.1em] bg-white/5 border border-white/10 text-[--text-muted]">
            {info.getValue() || "N/A"}
          </span>
        ),
      }),
      columnHelper.accessor("coupon_rate", {
        header: "Coupon",
        cell: (info) => (
          <div className="flex flex-col">
            <span className="text-[12px] font-bold text-[--accent-primary]">{Number(info.getValue()).toFixed(2)}%</span>
            <span className="text-[9px] text-[--text-muted]">{info.row.original.interest_frequency}</span>
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
          const invested = Number(info.row.original.total_invested);
          return (
            <div className="flex flex-col">
              <span className="text-[12px] font-bold text-white">₹{invested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="text-[9px] text-[--text-muted]">{info.row.original.quantity} qty @ ₹{Number(info.row.original.purchase_price).toFixed(2)}</span>
            </div>
          );
        },
        sortingFn: (rowA, rowB) => Number(rowA.original.total_invested) - Number(rowB.original.total_invested)
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
          const current = Number(info.row.original.current_value);
          return (
            <div className="flex flex-col">
              <span className="text-[12px] font-bold text-white">₹{current.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="text-[9px] text-[--text-muted]">LTP: ₹{Number(info.row.original.current_price).toFixed(2)}</span>
            </div>
          );
        },
        sortingFn: (rowA, rowB) => Number(rowA.original.current_value) - Number(rowB.original.current_value)
      }),
      columnHelper.display({
        id: "maturity",
        header: "Maturity",
        cell: (info) => {
          const date = info.row.original.maturity_date;
          return (
            <div className="flex flex-col">
              <span className="text-[12px] text-white">{date ? format(parseISO(date), "MMM d, yyyy") : "N/A"}</span>
              <span className="text-[9px] text-[--text-muted]">YTM: {info.row.original.ytm ? `${Number(info.row.original.ytm).toFixed(2)}%` : "N/A"}</span>
            </div>
          );
        },
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: (info) => (
          <div className="flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(info.row.original)}
              className="p-2 rounded-lg bg-white/5 text-[--text-muted] hover:bg-[--accent-primary] hover:text-white transition-colors"
              title="Edit Bond"
            >
              <Edit className="w-4 h-4" />
            </button>
          </div>
        ),
      }),
    ],
    [onEdit]
  );

  const filteredBonds = useMemo(() => {
    if (!globalFilter) return bonds;
    const lower = globalFilter.toLowerCase();
    return bonds.filter(b => 
      b.bond_name.toLowerCase().includes(lower) || 
      (b.issuer && b.issuer.toLowerCase().includes(lower)) ||
      (b.isin && b.isin.toLowerCase().includes(lower))
    );
  }, [bonds, globalFilter]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredBonds,
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

  if (bonds.length === 0) {
    return (
      <EmptyState 
        icon="📜"
        title="No Bonds Found"
        description="You have no active bond investments."
        action={
          <button onClick={onAdd} className="btn-primary">
            Record Investment
          </button>
        }
      />
    );
  }

  const fmt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

  return (
    <div className="glass-card-static rounded-2xl overflow-hidden flex flex-col border border-white/5">
      <div className="p-4 md:p-5 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.02]">
        <div className="relative w-full sm:w-72">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--text-muted]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            placeholder="Search bonds..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="input-premium pl-9 py-2 text-sm w-full !bg-black/20"
          />
        </div>
        
        {/* View Mode Toggle */}
        <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10 shrink-0 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            className={`p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs font-bold ${
              viewMode === "cards" ? "bg-[--accent-primary] text-white shadow-md" : "text-[--text-muted] hover:text-white"
            }`}
            title="Wint Cards view"
          >
            <Grid className="w-4 h-4" />
            Wint Cards
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs font-bold ${
              viewMode === "table" ? "bg-[--accent-primary] text-white shadow-md" : "text-[--text-muted] hover:text-white"
            }`}
            title="List Table view"
          >
            <List className="w-4 h-4" />
            Statement Table
          </button>
        </div>
      </div>

      {viewMode === "cards" ? (
        /* Wint Wealth Style Card Grid Layout */
        filteredBonds.length === 0 ? (
          <div className="px-5 py-12 text-center text-[--text-muted] text-sm bg-black/10">No bonds match your search.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 bg-black/10">
            {filteredBonds.map((bond) => {
              const invested = Number(bond.total_invested);
              const current = Number(bond.current_value);
              const returns = current - invested;
              const initials = bond.bond_name.replace(/[^a-zA-Z0-9]/g, "").substring(0, 2).toUpperCase() || "BD";
              
              // Term progress calculation
              const purchase = bond.purchase_date ? new Date(bond.purchase_date).getTime() : 0;
              const maturity = bond.maturity_date ? new Date(bond.maturity_date).getTime() : 0;
              const today = Date.now();
              let progress = 0;
              let daysLeft = 0;
              if (maturity > purchase) {
                progress = Math.min(100, Math.max(0, ((today - purchase) / (maturity - purchase)) * 100));
                daysLeft = Math.max(0, Math.ceil((maturity - today) / (1000 * 60 * 60 * 24)));
              }

              return (
                <div 
                  key={bond.id} 
                  className="p-5 rounded-2xl border border-white/10 bg-gradient-to-b from-[#18181e] to-[#121216] hover:border-purple-500/40 hover:shadow-[0_0_30px_-5px_rgba(139,92,246,0.25)] hover:scale-[1.02] transition-all duration-300 flex flex-col justify-between min-h-[320px] shadow-lg relative group"
                >
                  <div>
                    {/* Top Segment: Issuer Avatar, Name, Rating */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/10 to-indigo-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-black text-xs shrink-0 shadow-[0_0_15px_rgba(139,92,246,0.1)]">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-white leading-tight truncate group-hover:text-purple-400 transition-colors" title={bond.bond_name}>
                            {bond.bond_name}
                          </h3>
                          <p className="text-[10px] text-[--text-muted] mt-1 font-semibold truncate">
                            {bond.issuer}
                          </p>
                        </div>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${getRatingBadgeClass(bond.credit_rating)}`}>
                        {bond.credit_rating || "Unrated"}
                      </span>
                    </div>

                    {/* Yield Banner (Wint App returns focus) */}
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 flex justify-between items-center my-4">
                      <div>
                        <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Yield to Maturity</p>
                        <p className="text-lg font-black text-purple-400 mt-0.5">
                          {bond.ytm ? `${Number(bond.ytm).toFixed(2)}% p.a.` : `${Number(bond.coupon_rate).toFixed(2)}% p.a.`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Payout</p>
                        <p className="text-xs font-bold text-white mt-1">
                          {bond.interest_frequency}
                        </p>
                      </div>
                    </div>

                    {/* Middle Segment: Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 py-2 text-left">
                      <div>
                        <p className="text-[8px] font-bold uppercase tracking-wider text-gray-500">Invested</p>
                        <p className="text-xs font-bold text-white mt-1">{fmt.format(invested)}</p>
                        <p className="text-[8px] text-gray-500 mt-0.5">{bond.quantity} Units</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-bold uppercase tracking-wider text-gray-500">Current</p>
                        <p className="text-xs font-bold text-white mt-1">{fmt.format(current)}</p>
                        <p className="text-[8px] text-gray-500 mt-0.5">LTP: ₹{Number(bond.current_price).toFixed(0)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] font-bold uppercase tracking-wider text-gray-500">Returns</p>
                        <div className="mt-1">
                          <PnLValue value={returns} size="sm" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Segment: Maturity progress and Edit button */}
                  <div className="mt-4 pt-3 border-t border-white/5">
                    <div className="flex justify-between items-center text-[9px] text-gray-500 font-bold uppercase tracking-wider">
                      <span>Matures: {bond.maturity_date ? format(parseISO(bond.maturity_date), "dd MMM yyyy") : "N/A"}</span>
                      <span className={daysLeft > 0 ? "text-indigo-400" : "text-emerald-400"}>
                        {daysLeft > 0 ? `${daysLeft} days left` : "Matured"}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full mt-1.5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          daysLeft > 0 ? "bg-gradient-to-r from-purple-500 via-indigo-500 to-[--accent-primary]" : "bg-gradient-to-r from-emerald-500 to-teal-500"
                        }`}
                        style={{ width: `${progress}%` }} 
                      />
                    </div>

                    {/* Hover edit layout */}
                    <div className="flex justify-between items-center mt-4 pt-3 border-t border-white/5">
                      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">ISIN: {bond.isin}</span>
                      <button 
                        onClick={() => onEdit(bond)} 
                        className="bg-white/5 hover:bg-purple-600 hover:text-white px-3 py-1 rounded text-xs font-bold transition-all border border-white/10 hover:border-purple-500 flex items-center gap-1 cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" /> Edit
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Detailed Statement Table View */
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
                    No bonds match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

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
