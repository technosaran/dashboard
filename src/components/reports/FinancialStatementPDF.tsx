import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const formatMoney = (val: number | string | null | undefined, currency = "INR") => {
  if (val === null || val === undefined) return "—";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "—";

  const formatted = num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return currency === "USD" ? `$${formatted}` : `₹${formatted}`;
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#334155",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    paddingBottom: 15,
    marginBottom: 20,
  },
  logoSection: {
    flexDirection: "column",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 9,
    color: "#64748b",
    marginTop: 2,
  },
  metaSection: {
    textAlign: "right",
    fontSize: 8,
    color: "#64748b",
    lineHeight: 1.4,
  },
  summaryGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    padding: 10,
  },
  summaryLabel: {
    fontSize: 8,
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 4,
    fontWeight: "bold",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#0f172a",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  table: {
    width: "100%",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    alignItems: "center",
    minHeight: 22,
  },
  tableHeaderRow: {
    backgroundColor: "#f1f5f9",
    borderBottomColor: "#cbd5e1",
    minHeight: 24,
  },
  tableColHeader: {
    fontWeight: "bold",
    color: "#475569",
    padding: 5,
    fontSize: 8,
  },
  tableCol: {
    padding: 5,
    fontSize: 8,
  },
  textRight: {
    textAlign: "right",
  },
  textCenter: {
    textAlign: "center",
  },
  colDesc: { flex: 2 },
  colCat: { flex: 1 },
  colAcc: { flex: 1 },
  colAmt: { flex: 1 },
  colDate: { flex: 1 },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    color: "#94a3b8",
    fontSize: 8,
  },
});

export interface PDFStatementProps {
  statementPeriod: string;
  generatedAt: string;
  userName: string;
  stats: {
    netWorth: number;
    totalAssets: number;
    totalLiabilities: number;
  };
  accounts: Array<{
    name: string;
    type: string;
    balance: string;
    currency: string;
  }>;
  transactions: Array<{
    date: string;
    description: string;
    type: string;
    amount: string;
    category: string | null;
    account_name?: string;
  }>;
}

export default function FinancialStatementPDF({
  statementPeriod,
  generatedAt,
  userName,
  stats,
  accounts,
  transactions,
}: PDFStatementProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoSection}>
            <Text style={styles.title}>FINANCE DASHBOARD</Text>
            <Text style={styles.subtitle}>Monthly Wealth & Cash Flow Statement</Text>
          </View>
          <View style={styles.metaSection}>
            <Text>Prepared For: {userName}</Text>
            <Text>Period: {statementPeriod}</Text>
            <Text>Generated: {generatedAt}</Text>
          </View>
        </View>

        {/* Wealth Summary Cards */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Net Worth</Text>
            <Text style={styles.summaryValue}>{formatMoney(stats.netWorth)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Assets</Text>
            <Text style={styles.summaryValue}>{formatMoney(stats.totalAssets)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Liabilities</Text>
            <Text style={styles.summaryValue}>{formatMoney(stats.totalLiabilities)}</Text>
          </View>
        </View>

        {/* Accounts Summary */}
        <Text style={styles.sectionTitle}>Asset & Liability Accounts</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeaderRow]}>
            <Text style={[styles.tableColHeader, { flex: 2 }]}>Account Name</Text>
            <Text style={[styles.tableColHeader, { flex: 1 }]}>Type</Text>
            <Text style={[styles.tableColHeader, { flex: 1, textAlign: "right" }]}>Balance</Text>
          </View>
          {accounts.length > 0 ? (
            accounts.map((acc, index) => (
              <View
                key={index}
                style={[
                  styles.tableRow,
                  index === accounts.length - 1 ? { borderBottomWidth: 0 } : {},
                ]}
              >
                <Text style={[styles.tableCol, { flex: 2 }]}>{acc.name}</Text>
                <Text style={[styles.tableCol, { flex: 1, textTransform: "capitalize" }]}>
                  {acc.type}
                </Text>
                <Text style={[styles.tableCol, { flex: 1, textAlign: "right" }]}>
                  {formatMoney(acc.balance, acc.currency)}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.tableRow}>
              <Text style={[styles.tableCol, { flex: 1, textAlign: "center", color: "#94a3b8" }]}>
                No accounts found.
              </Text>
            </View>
          )}
        </View>

        {/* Transactions List */}
        <Text style={styles.sectionTitle}>Transactions Ledger</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeaderRow]}>
            <Text style={[styles.tableColHeader, styles.colDate]}>Date</Text>
            <Text style={[styles.tableColHeader, styles.colDesc]}>Description</Text>
            <Text style={[styles.tableColHeader, styles.colCat]}>Category</Text>
            <Text style={[styles.tableColHeader, styles.colAcc]}>Account</Text>
            <Text style={[styles.tableColHeader, styles.colAmt, { textAlign: "right" }]}>Amount</Text>
          </View>
          {transactions.length > 0 ? (
            transactions.map((txn, index) => {
              const isExpense = txn.type === "expense";
              const isTransferOut = txn.type === "transfer_out";
              const sign = isExpense || isTransferOut ? "-" : "+";
              const color = isExpense || isTransferOut ? "#ef4444" : "#10b981";

              return (
                <View
                  key={index}
                  style={[
                    styles.tableRow,
                    index === transactions.length - 1 ? { borderBottomWidth: 0 } : {},
                  ]}
                >
                  <Text style={[styles.tableCol, styles.colDate]}>{txn.date}</Text>
                  <Text style={[styles.tableCol, styles.colDesc]}>{txn.description}</Text>
                  <Text style={[styles.tableCol, styles.colCat]}>{txn.category || "—"}</Text>
                  <Text style={[styles.tableCol, styles.colAcc]}>{txn.account_name || "—"}</Text>
                  <Text
                    style={[
                      styles.tableCol,
                      styles.colAmt,
                      { textAlign: "right", color, fontWeight: "bold" },
                    ]}
                  >
                    {sign}
                    {formatMoney(txn.amount)}
                  </Text>
                </View>
              );
            })
          ) : (
            <View style={styles.tableRow}>
              <Text style={[styles.tableCol, { flex: 1, textAlign: "center", color: "#94a3b8" }]}>
                No transactions recorded for this period.
              </Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Confidential Financial Report</Text>
          <Text>Page 1 of 1</Text>
        </View>
      </Page>
    </Document>
  );
}
