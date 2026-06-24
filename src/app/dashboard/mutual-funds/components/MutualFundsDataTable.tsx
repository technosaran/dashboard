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
import { ArrowUpDown, ArrowUp, ArrowDown, Edit, TrendingDown } from "lucide-react";
import type { Tables } from "@/lib/database.types";
import PnLValue from "@/components/pnl-value";

type MF = Tables<"mutual_funds"> & { scheme_code?: string | null; fund_symbol?: string | null; pnlPercent?: number; day_change?: number; day_change_percent?: number };

interface MutualFundsDataTableProps {
  funds: MF[];
  onEdit: (fund: MF) => void;
  onSell: (fund: MF) => void;
  onAdd: () => void;
}

const columnHelper = createColumnHelper<MF>();

function getAMCLogoUrl(amcName: string): string {
  const amc = (amcName || "").toLowerCase();
  if (amc.includes('hdfc')) return 'https://logo.clearbit.com/hdfcfund.com';
  if (amc.includes('sbi')) return 'https://logo.clearbit.com/sbimf.com';
  if (amc.includes('icici')) return 'https://logo.clearbit.com/icicipruamc.com';
  if (amc.includes('axis')) return 'https://logo.clearbit.com/axismf.com';
  if (amc.includes('kotak')) return 'https://logo.clearbit.com/kotakmf.com';
  if (amc.includes('aditya birla') || amc.includes('birla')) return 'https://logo.clearbit.com/mutualfund.adityabirlacapital.com';
  if (amc.includes('nippon')) return 'https://logo.clearbit.com/nipponindiaim.com';
  if (amc.includes('franklin')) return 'https://logo.clearbit.com/franklintempletonindia.com';
  if (amc.includes('dsp')) return 'https://logo.clearbit.com/dspim.com';
  if (amc.includes('mirae')) return 'https://logo.clearbit.com/miraeassetmf.co.in';
  if (amc.includes('parag parikh') || amc.includes('ppfas')) return 'https://logo.clearbit.com/amc.ppfas.com';
  if (amc.includes('motilal')) return 'https://logo.clearbit.com/motilaloswalmf.com';
  if (amc.includes('tata')) return 'https://logo.clearbit.com/tatamutualfund.com';
  if (amc.includes('uti')) return 'https://logo.clearbit.com/utimf.com';
  if (amc.includes('bandhan') || amc.includes('idfc')) return 'https://logo.clearbit.com/bandhanmutual.com';
  if (amc.includes('edelweiss')) return 'https://logo.clearbit.com/edelweissmf.com';
  if (amc.includes('sundaram')) return 'https://logo.clearbit.com/sundarammutual.com';
  if (amc.includes('quant')) return 'https://logo.clearbit.com/quantmutual.com';
  if (amc.includes('canara')) return 'https://logo.clearbit.com/canararobeco.com';
  if (amc.includes('invesco')) return 'https://logo.clearbit.com/invescomutualfund.com';
  if (amc.includes('lic')) return 'https://logo.clearbit.com/licmf.com';
  if (amc.includes('mahindra')) return 'https://logo.clearbit.com/mahindramanulife.com';
  if (amc.includes('union')) return 'https://logo.clearbit.com/unionmf.com';
  if (amc.includes('taurus')) return 'https://logo.clearbit.com/taurusmutualfund.com';
  if (amc.includes('navi')) return 'https://logo.clearbit.com/navi.com';
  if (amc.includes('groww')) return 'https://logo.clearbit.com/groww.in';
  return '';
}

export default function MutualFundsDataTable({ funds, onEdit, onSell, onAdd }: MutualFundsDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = useMemo(
    () => [
      columnHelper.accessor("fund_name", {
        header: "Fund",
        cell: (info) => {
          const amc = info.row.original.amc_name || "";
          const logo = getAMCLogoUrl(amc);
          return (
            <div className="flex items-center gap-3">
              {logo ? (
                <img src={logo} alt={amc} className="w-8 h-8 rounded-md bg-white p-1 object-contain flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-md bg-[--accent-primary]/20 flex items-center justify-center text-xs font-bold text-[--accent-primary] flex-shrink-0">
                  {amc.substring(0, 2).toUpperCase()}
                </div>
              )}
              <div className="flex flex-col max-w-[200px]">
                <p className="text-[13px] font-bold text-white truncate hover:text-clip hover:absolute hover:bg-black hover:z-10 hover:p-1 hover:rounded-md hover:border hover:border-white/10" title={info.getValue()}>{info.getValue()}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] truncate">{amc}</p>
              </div>
            </div>
          );
        },
      }),
      columnHelper.accessor("category", {
        header: "Category",
        cell: (info) => (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-[0.1em] bg-white/5 border border-white/10 text-[--text-muted]">
            {info.getValue() || "Others"}
          </span>
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
          const invested = Number(info.row.original.units) * Number(info.row.original.avg_nav);
          return (
            <div className="flex flex-col">
              <span className="text-[12px] font-bold text-white">₹{invested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="text-[9px] text-[--text-muted]">{Number(info.row.original.units).toFixed(2)} units</span>
            </div>
          );
        },
        sortingFn: (rowA, rowB) => {
          const invA = Number(rowA.original.units) * Number(rowA.original.avg_nav);
          const invB = Number(rowB.original.units) * Number(rowB.original.avg_nav);
          return invA - invB;
        }
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
          const current = Number(info.row.original.units) * Number(info.row.original.current_nav);
          return (
            <div className="flex flex-col">
              <span className="text-[12px] font-bold text-white">₹{current.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="text-[9px] text-[--text-muted]">NAV: ₹{Number(info.row.original.current_nav).toFixed(2)}</span>
            </div>
          );
        },
        sortingFn: (rowA, rowB) => {
          const valA = Number(rowA.original.units) * Number(rowA.original.current_nav);
          const valB = Number(rowB.original.units) * Number(rowB.original.current_nav);
          return valA - valB;
        }
      }),
      columnHelper.display({
        id: "pnl",
        header: "Returns",
        cell: (info) => {
          const invested = Number(info.row.original.units) * Number(info.row.original.avg_nav);
          const current = Number(info.row.original.units) * Number(info.row.original.current_nav);
          const pnl = current - invested;
          const pct = invested > 0 ? (pnl / invested) * 100 : 0;
          return <PnLValue amount={pnl} percentage={pct} showIcon />;
        },
      }),
      columnHelper.display({
        id: "dayChange",
        header: "1D Change",
        cell: (info) => {
          const dayPnl = Number(info.row.original.day_change || 0) * Number(info.row.original.units);
          const pct = Number(info.row.original.day_change_percent || 0);
          return <PnLValue amount={dayPnl} percentage={pct} />;
        },
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: (info) => (
          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onSell(info.row.original)}
              className="p-2 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors"
              title="Sell / Redeem"
            >
              <TrendingDown className="w-4 h-4" />
            </button>
            <button
              onClick={() => onEdit(info.row.original)}
              className="p-2 rounded-lg bg-white/5 text-[--text-muted] hover:bg-[--accent-primary] hover:text-white transition-colors"
              title="Edit Fund"
            >
              <Edit className="w-4 h-4" />
            </button>
          </div>
        ),
      }),
    ],
    [onEdit, onSell]
  );

  const filteredFunds = useMemo(() => {
    if (!globalFilter) return funds;
    const lower = globalFilter.toLowerCase();
    return funds.filter(f => 
      f.fund_name.toLowerCase().includes(lower) || 
      (f.amc_name && f.amc_name.toLowerCase().includes(lower)) ||
      (f.category && f.category.toLowerCase().includes(lower))
    );
  }, [funds, globalFilter]);

  const table = useReactTable({
    data: filteredFunds,
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

  if (funds.length === 0) {
    return (
      <EmptyState 
        icon="📈"
        title="No Mutual Funds"
        description="You have no active mutual fund investments."
        action={
          <button onClick={onAdd} className="btn-primary">
            Record Investment
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
            placeholder="Search funds..."
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
                  No funds match your search.
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
