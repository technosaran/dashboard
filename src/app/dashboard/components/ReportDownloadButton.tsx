"use client";

import { useHasMounted } from "@/hooks/use-has-mounted";

export default function ReportDownloadButton() {
  const mounted = useHasMounted();

  if (!mounted) return null;

  const handleDownload = () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    window.open(`/api/reports/download?month=${month}&year=${year}`, "_blank");
  };

  return (
    <div className="flex items-center">
      <button
        onClick={handleDownload}
        className="btn-secondary !h-10 px-4 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-white/10 shadow-lg shadow-black/20"
        title="Export monthly financial statement PDF"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Export PDF Report
      </button>
    </div>
  );
}
