"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { format } from "date-fns";
import type { DashboardStats } from "./DashboardDesktop";

// We must dynamically import @react-pdf/renderer to avoid SSR issues
const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFDownloadLink),
  { ssr: false }
);

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// We define the PDF document component
const FinanceReportPDF = ({ stats }: { stats: DashboardStats }) => {

  const styles = StyleSheet.create({
    page: { padding: 40, backgroundColor: "#ffffff", fontFamily: "Helvetica" },
    header: { marginBottom: 30, borderBottomWidth: 2, borderBottomColor: "#111827", paddingBottom: 10 },
    title: { fontSize: 24, color: "#111827", fontWeight: "bold" },
    subtitle: { fontSize: 10, color: "#6b7280", marginTop: 5 },
    section: { marginBottom: 25 },
    sectionTitle: { fontSize: 14, color: "#374151", fontWeight: "bold", marginBottom: 10, textTransform: "uppercase" },
    row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", paddingBottom: 4 },
    label: { fontSize: 12, color: "#4b5563" },
    value: { fontSize: 12, color: "#111827", fontWeight: "bold" },
    totalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 5, paddingTop: 5, borderTopWidth: 2, borderTopColor: "#111827" },
    totalLabel: { fontSize: 14, color: "#111827", fontWeight: "bold" },
    totalValue: { fontSize: 14, color: "#111827", fontWeight: "bold" },
    footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 8, color: "#9ca3af", textAlign: "center" }
  });

  const formatCurrency = (val: number) => `INR ${val.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>FinanceOS Portfolio Report</Text>
          <Text style={styles.subtitle}>Generated on {format(new Date(), "MMMM d, yyyy 'at' hh:mm a")}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Executive Summary</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Total Net Worth</Text>
            <Text style={styles.value}>{formatCurrency(stats.netWorthINR)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Total Liquid Assets</Text>
            <Text style={styles.value}>{formatCurrency(stats.totalAssetsINR)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Total Debt/Liabilities</Text>
            <Text style={styles.value}>{formatCurrency(stats.debtBalance)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Asset Allocation Breakdown</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Cash & Bank</Text>
            <Text style={styles.value}>{formatCurrency(stats.cashBalanceINR)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Equities (Stocks)</Text>
            <Text style={styles.value}>{formatCurrency(stats.stockBalanceINR)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Mutual Funds</Text>
            <Text style={styles.value}>{formatCurrency(stats.mfBalance)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Bonds & Fixed Income</Text>
            <Text style={styles.value}>{formatCurrency(stats.bondBalance)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Forex</Text>
            <Text style={styles.value}>{formatCurrency(stats.forexBalanceINR)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Alternative Assets</Text>
            <Text style={styles.value}>{formatCurrency(stats.altBalance)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Assets</Text>
            <Text style={styles.totalValue}>{formatCurrency(stats.totalAssetsINR)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Month Cash Flow</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Monthly Income</Text>
            <Text style={{ ...styles.value, color: "#10b981" }}>+{formatCurrency(stats.monthlyIncome)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Monthly Expenses</Text>
            <Text style={{ ...styles.value, color: "#ef4444" }}>-{formatCurrency(stats.monthlySpend)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Net Cash Flow</Text>
            <Text style={styles.totalValue}>{formatCurrency(stats.monthlyIncome - stats.monthlySpend)}</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          This document was automatically generated by FinanceOS. It is for informational purposes only.
        </Text>
      </Page>
    </Document>
  );
};

export default function ReportDownloadButton({ stats }: { stats: any }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex items-center">
      <PDFDownloadLink
        document={<FinanceReportPDF stats={stats} />}
        fileName={`FinanceOS_Report_${format(new Date(), "MMM_yyyy")}.pdf`}
        className="btn-secondary !h-10 px-4 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-white/10 shadow-lg shadow-black/20"
      >
        {({ loading }: { loading: boolean }) =>
          loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating PDF...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export PDF Report
            </>
          )
        }
      </PDFDownloadLink>
    </div>
  );
}
