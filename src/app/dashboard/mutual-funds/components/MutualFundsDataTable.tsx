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

function AMCAvatar({ amcName, logoUrl }: { amcName: string; logoUrl: string }) {
  const [error, setError] = useState(false);
  const initials = amcName.substring(0, 2).toUpperCase();
  if (logoUrl && !error) {
    return (
      <img 
        src={logoUrl} 
        alt={amcName} 
        className="w-8 h-8 rounded-full bg-white object-contain flex-shrink-0 border border-[#eee] dark:border-white/10"
        onError={() => setError(true)}
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-white dark:bg-[#1e1e1e] border border-[#ddd] dark:border-white/10 flex items-center justify-center text-xs font-semibold text-[#555] dark:text-[--text-muted] flex-shrink-0">
      {initials}
    </div>
  );
}

export default function MutualFundsDataTable({ funds, onEdit, onSell, onAdd }: MutualFundsDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const formatMoney = (val: number) => val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const columns = useMemo(
    () => [
      columnHelper.accessor("fund_name", {
        header: "Fund name",
        cell: (info) => {
          const amc = info.row.original.amc_name || "";
          const logo = getAMCLogoUrl(amc);
          return (
            <div className="flex items-center gap-3">
              <AMCAvatar amcName={amc} logoUrl={logo} />
              <div className="flex flex-col">
                <p className="text-sm font-medium text-[--text-primary]" title={info.getValue()}>{info.getValue()}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-[--text-muted] px-1.5 py-0.5 rounded bg-white/5 border border-white/10">{info.row.original.category || "Others"}</span>
                  <span className="text-[10px] text-[--text-muted]">{info.row.original.investment_type || "SIP"}</span>
                </div>
              </div>
            </div>
          );
        },
      }),
      columnHelper.display({
        id: "invested",
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center justify-end w-full gap-1 hover:text-[--text-primary] transition-colors">
            Invested
            {column.getIsSorted() === "asc" ? <ArrowUp className="w-3 h-3" /> : column.getIsSorted() === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-30" />}
          </button>
        ),
        cell: (info) => {
          const invested = Number(info.row.original.units) * Number(info.row.original.avg_nav);
          return (
            <div className="flex flex-col items-end">
              <span className="text-sm text-[--text-primary]">₹{formatMoney(invested)}</span>
              <span className="text-xs text-[--text-muted]">{Number(info.row.original.units).toFixed(3)} units</span>
            </div>
          );
        },
        sortingFn: (rowA, rowB) => {
          return (Number(rowA.original.units) * Number(rowA.original.avg_nav)) - (Number(rowB.original.units) * Number(rowB.original.avg_nav));
        }
      }),
      columnHelper.display({
        id: "current",
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center justify-end w-full gap-1 hover:text-[--text-primary] transition-colors">
            Current
            {column.getIsSorted() === "asc" ? <ArrowUp className="w-3 h-3" /> : column.getIsSorted() === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-30" />}
          </button>
        ),
        cell: (info) => {
          const current = Number(info.row.original.units) * Number(info.row.original.current_nav);
          return (
            <div className="flex flex-col items-end">
              <span className="text-sm font-medium text-[--text-primary]">₹{formatMoney(current)}</span>
              <span className="text-xs text-[--text-muted]">NAV: ₹{Number(info.row.original.current_nav).toFixed(2)}</span>
            </div>
          );
        },
        sortingFn: (rowA, rowB) => {
          return (Number(rowA.original.units) * Number(rowA.original.current_nav)) - (Number(rowB.original.units) * Number(rowB.original.current_nav));
        }
      }),
      columnHelper.display({
        id: "returns",
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center justify-end w-full gap-1 hover:text-[--text-primary] transition-colors">
            Returns
            {column.getIsSorted() === "asc" ? <ArrowUp className="w-3 h-3" /> : column.getIsSorted() === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-30" />}
          </button>
        ),
        cell: (info) => {
          const invested = Number(info.row.original.units) * Number(info.row.original.avg_nav);
          const current = Number(info.row.original.units) * Number(info.row.original.current_nav);
          const pnl = current - invested;
          const pct = invested > 0 ? (pnl / invested) * 100 : 0;
          const isPositive = pnl >= 0;
          return (
            <div className={`flex flex-col items-end text-sm ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
              <span className="font-medium">{isPositive ? '+' : ''}₹{formatMoney(pnl)}</span>
              <span className="text-xs opacity-80">{isPositive ? '+' : ''}{pct.toFixed(2)}%</span>
            </div>
          );
        },
        sortingFn: (rowA, rowB) => {
          const invA = Number(rowA.original.units) * Number(rowA.original.avg_nav);
          const curA = Number(rowA.original.units) * Number(rowA.original.current_nav);
          const invB = Number(rowB.original.units) * Number(rowB.original.avg_nav);
          const curB = Number(rowB.original.units) * Number(rowB.original.current_nav);
          return (curA - invA) - (curB - invB);
        }
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: (info) => (
          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(info.row.original); }}
              className="px-3 py-1 rounded bg-[#2185d0]/10 text-[#2185d0] hover:bg-[#2185d0] hover:text-white transition-colors text-xs font-semibold"
            >
              Add
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onSell(info.row.original); }}
              className="px-3 py-1 rounded bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors text-xs font-semibold"
            >
              Redeem
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
      pagination: { pageSize: 50 },
    },
  });

  if (funds.length === 0) {
    return (
      <EmptyState 
        icon="📈"
        title="No investments"
        description="You haven't invested in any mutual funds yet."
        action={
          <button onClick={onAdd} className="btn-primary">
            Explore funds
          </button>
        }
      />
    );
  }

  return (
    <div className="bg-[#121212] rounded-xl border border-white/10 flex flex-col overflow-hidden shadow-sm">
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <input
          type="text"
          placeholder="Search your investments"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="bg-transparent border-none outline-none text-sm text-[--text-primary] placeholder-[--text-muted] w-full max-w-xs"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-white/10">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-6 py-4 text-xs font-normal text-[--text-muted] whitespace-nowrap bg-white/[0.02]">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-white/5">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="group hover:bg-white/[0.03] transition-colors cursor-pointer bg-[#121212]">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-6 py-4 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {table.getPageCount() > 1 && (
        <div className="p-4 border-t border-white/10 flex items-center justify-between text-xs text-[--text-muted] bg-white/[0.02]">
          <div>
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, filteredFunds.length)} of {filteredFunds.length} entries
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-3 py-1.5 disabled:opacity-30 hover:text-white border border-white/10 rounded"
            >
              Previous
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-3 py-1.5 disabled:opacity-30 hover:text-white border border-white/10 rounded"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
