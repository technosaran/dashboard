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
import { getTableHeaderClass, getTableCellClass } from "@/lib/utils";

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
          return <PnLValue amount={diff} showIcon currency="INR" glow />;
        },
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: (info) => (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => onEdit(info.row.original.id)}
              className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-300 hover:text-white transition-all cursor-pointer"
              title="Edit Asset"
            >
              Adjust
            </button>
            <button
              onClick={() => onDelete(info.row.original.id, info.row.original.name)}
              className="px-2.5 py-1.5 rounded-lg border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500 hover:text-white text-rose-400 transition-all text-xs font-bold cursor-pointer"
              title="Delete Asset"
            >
              Delete
            </button>
          </div>
        ),
      }),
    ],
    [onEdit, onDelete]
  );

  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: assets,
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
    <div className="glass-card-static rounded-2xl overflow-hidden flex flex-col border border-white/5 bg-[#151515]">

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
