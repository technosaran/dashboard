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
import { ArrowUpDown, ArrowUp, ArrowDown, Edit2, Trash2 } from "lucide-react";
import type { Tables } from "@/lib/database.types";
import PnLValue from "@/components/pnl-value";

type AltAsset = Tables<"alternative_assets">;

interface AlternativeAssetsDataTableProps {
  assets: AltAsset[];
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onAdd: () => void;
}

const CATEGORIES = [
  { label: "Real Estate", icon: "🏙️" },
  { label: "Gold / Precious Metals", icon: "🏆" },
  { label: "Physical Assets", icon: "📦" },
  { label: "Collectibles", icon: "🎨" },
  { label: "Private Equity", icon: "🤝" },
  { label: "Crypto (Cold Storage)", icon: "🔐" },
  { label: "Others", icon: "🎯" },
];

const columnHelper = createColumnHelper<AltAsset>();

export default function AlternativeAssetsDataTable({ assets, onEdit, onDelete, onAdd }: AlternativeAssetsDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Asset",
        cell: (info) => {
          const category = CATEGORIES.find(c => c.label === info.row.original.category) || CATEGORIES[6];
          return (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-sm shadow-sm">
                {category.icon}
              </div>
              <div className="flex flex-col max-w-[200px]">
                <p className="text-[13px] font-bold text-white truncate" title={info.getValue()}>{info.getValue()}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] truncate">{info.row.original.category}</p>
              </div>
            </div>
          );
        },
      }),
      columnHelper.accessor("purchase_date", {
        header: "Acquisition Date",
        cell: (info) => (
          <span className="text-[12px] font-medium text-white">
            {info.getValue() ? format(parseISO(info.getValue()!), "MMM d, yyyy") : "Unknown"}
          </span>
        ),
      }),
      columnHelper.accessor("purchase_price", {
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center gap-1 uppercase tracking-[0.2em] hover:text-white transition-colors">
            Cost Basis
            {column.getIsSorted() === "asc" ? <ArrowUp className="w-3 h-3" /> : column.getIsSorted() === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-50" />}
          </button>
        ),
        cell: (info) => (
          <span className="text-[13px] font-mono text-[--text-secondary]">
            ₹{Number(info.getValue()).toLocaleString()}
          </span>
        ),
        sortingFn: (rowA, rowB) => Number(rowA.original.purchase_price) - Number(rowB.original.purchase_price)
      }),
      columnHelper.accessor("current_value", {
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center gap-1 uppercase tracking-[0.2em] hover:text-white transition-colors">
            Market Value
            {column.getIsSorted() === "asc" ? <ArrowUp className="w-3 h-3" /> : column.getIsSorted() === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-50" />}
          </button>
        ),
        cell: (info) => (
          <span className="text-[13px] font-bold text-white">
            ₹{Number(info.getValue()).toLocaleString()}
          </span>
        ),
        sortingFn: (rowA, rowB) => Number(rowA.original.current_value) - Number(rowB.original.current_value)
      }),
      columnHelper.display({
        id: "pnl",
        header: "Growth",
        cell: (info) => {
          const val = Number(info.row.original.current_value);
          const cost = Number(info.row.original.purchase_price);
          const diff = val - cost;
          return <PnLValue amount={diff} showIcon currency="INR" />;
        },
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: (info) => (
          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(info.row.original.id)}
              className="p-2 rounded-lg bg-white/5 text-[--text-muted] hover:bg-white/10 hover:text-white transition-colors"
              title="Edit Asset"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(info.row.original.id, info.row.original.name)}
              className="p-2 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors"
              title="Delete Asset"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      }),
    ],
    [onEdit, onDelete]
  );

  const filteredAssets = useMemo(() => {
    if (!globalFilter) return assets;
    const lower = globalFilter.toLowerCase();
    return assets.filter(a => 
      a.name.toLowerCase().includes(lower) || 
      a.category.toLowerCase().includes(lower) ||
      (a.notes && a.notes.toLowerCase().includes(lower))
    );
  }, [assets, globalFilter]);

  const table = useReactTable({
    data: filteredAssets,
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

  if (assets.length === 0) {
    return (
      <EmptyState 
        icon="💎"
        title="Register Your First Asset"
        description="Track real estate, gold, collectibles, and other tangible holdings. Build a complete picture of your alternative wealth portfolio."
        action={
          <button onClick={onAdd} className="btn-primary">
            Record New Asset
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
            placeholder="Search assets..."
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
                  No assets match your search.
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
