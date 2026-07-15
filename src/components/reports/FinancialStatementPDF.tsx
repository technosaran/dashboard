import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const formatMoney = (val: number | string | null | undefined, currency = "INR") => {
  if (val === null || val === undefined) return "—";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "—";

  const formatted = num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return currency === "USD" ? `$${formatted}` : `₹${formatted}`;
};

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Helvetica",
    fontSize: 8.5,
    color: "#334155",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1.5,
    borderBottomColor: "#0f172a",
    paddingBottom: 10,
    marginBottom: 15,
  },
  logoSection: {
    flexDirection: "column",
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0f172a",
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 8,
    color: "#64748b",
    marginTop: 2,
    textTransform: "uppercase",
    fontWeight: "bold",
  },
  metaSection: {
    textAlign: "right",
    fontSize: 7.5,
    color: "#475569",
    lineHeight: 1.4,
  },
  wealthHeader: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    paddingBottom: 2,
    textTransform: "uppercase",
  },
  summaryGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    padding: 8,
  },
  inrTheme: {
    borderLeftWidth: 3,
    borderLeftColor: "#0ea5e9", // Cyan line for INR
  },
  usdTheme: {
    borderLeftWidth: 3,
    borderLeftColor: "#8b5cf6", // Purple line for USD
  },
  summaryLabel: {
    fontSize: 7,
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 2,
    fontWeight: "bold",
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#0f172a",
  },
  sectionTitle: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#0f172a",
    marginTop: 12,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    borderLeftWidth: 2,
    borderLeftColor: "#0f172a",
    paddingLeft: 5,
  },
  table: {
    width: "100%",
    marginBottom: 12,
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
    minHeight: 18,
  },
  tableHeaderRow: {
    backgroundColor: "#f1f5f9",
    borderBottomColor: "#cbd5e1",
    minHeight: 20,
  },
  tableColHeader: {
    fontWeight: "bold",
    color: "#475569",
    padding: 4,
    fontSize: 7.5,
  },
  tableCol: {
    padding: 4,
    fontSize: 7.5,
  },
  textRight: {
    textAlign: "right",
  },
  textCenter: {
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    color: "#94a3b8",
    fontSize: 7,
  },
});

export interface PDFStatementProps {
  statementPeriod: string;
  generatedAt: string;
  userName: string;
  inrStats: {
    netWorth: number;
    totalAssets: number;
    totalLiabilities: number;
    liquidAssets: number;
  };
  usdStats: {
    netWorth: number;
    totalAssets: number;
    totalLiabilities: number;
    liquidAssets: number;
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
    currency: string;
    category: string | null;
    account_name?: string;
  }>;
  inrStocks: Array<{ symbol: string; name: string; quantity: number; buy_price: number; current_price: number; value: number }>;
  inrMutualFunds: Array<{ fund_name: string; category: string; units: number; avg_nav: number; current_nav: number; value: number }>;
  inrBonds: Array<{ bond_name: string; issuer: string; quantity: number; purchase_price: number; current_price: number; value: number; coupon_rate: number }>;
  inrAlternativeAssets: Array<{ name: string; category: string; purchase_price: number; current_value: number }>;
  inrLiabilities: Array<{ name: string; category: string; total_amount: number; remaining_amount: number; interest_rate: number; monthly_payment: number }>;
  usdStocks: Array<{ symbol: string; name: string; quantity: number; buy_price: number; current_price: number; value: number }>;
  usdCrypto: Array<{ symbol: string; name: string; quantity: number; buy_price: number; current_price: number; value: number }>;
}

export default function FinancialStatementPDF({
  statementPeriod,
  generatedAt,
  userName,
  inrStats,
  usdStats,
  accounts,
  transactions,
  inrStocks = [],
  inrMutualFunds = [],
  inrBonds = [],
  inrAlternativeAssets = [],
  inrLiabilities = [],
  usdStocks = [],
  usdCrypto = [],
}: PDFStatementProps) {
  const inrAccounts = accounts.filter(a => a.currency === "INR");
  const usdAccounts = accounts.filter(a => a.currency === "USD");

  return (
    <Document>
      {/* PAGE 1: WEALTH & LIQUIDITY OVERVIEW */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoSection}>
            <Text style={styles.title}>FINANCE OS STATEMENT</Text>
            <Text style={styles.subtitle}>Executive Wealth & Ledger Audit Report</Text>
          </View>
          <View style={styles.metaSection}>
            <Text>Prepared For: {userName}</Text>
            <Text>Statement Period: {statementPeriod}</Text>
            <Text>Report Generated: {generatedAt}</Text>
          </View>
        </View>

        {/* INR Summary */}
        <Text style={styles.wealthHeader}>INR Wealth Portfolio Summary (Indian Rupees)</Text>
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, styles.inrTheme]}>
            <Text style={styles.summaryLabel}>INR Net Worth</Text>
            <Text style={styles.summaryValue}>{formatMoney(inrStats.netWorth, "INR")}</Text>
          </View>
          <View style={[styles.summaryCard, styles.inrTheme]}>
            <Text style={styles.summaryLabel}>Total INR Assets</Text>
            <Text style={styles.summaryValue}>{formatMoney(inrStats.totalAssets, "INR")}</Text>
          </View>
          <View style={[styles.summaryCard, styles.inrTheme]}>
            <Text style={styles.summaryLabel}>INR Liabilities</Text>
            <Text style={styles.summaryValue}>{formatMoney(inrStats.totalLiabilities, "INR")}</Text>
          </View>
          <View style={[styles.summaryCard, styles.inrTheme]}>
            <Text style={styles.summaryLabel}>INR Bank Balance</Text>
            <Text style={styles.summaryValue}>{formatMoney(inrStats.liquidAssets, "INR")}</Text>
          </View>
        </View>

        {/* USD Summary */}
        <Text style={styles.wealthHeader}>USD Wealth Portfolio Summary (US Dollars)</Text>
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, styles.usdTheme]}>
            <Text style={styles.summaryLabel}>USD Net Worth</Text>
            <Text style={styles.summaryValue}>{formatMoney(usdStats.netWorth, "USD")}</Text>
          </View>
          <View style={[styles.summaryCard, styles.usdTheme]}>
            <Text style={styles.summaryLabel}>Total USD Assets</Text>
            <Text style={styles.summaryValue}>{formatMoney(usdStats.totalAssets, "USD")}</Text>
          </View>
          <View style={[styles.summaryCard, styles.usdTheme]}>
            <Text style={styles.summaryLabel}>USD Liabilities</Text>
            <Text style={styles.summaryValue}>{formatMoney(usdStats.totalLiabilities, "USD")}</Text>
          </View>
          <View style={[styles.summaryCard, styles.usdTheme]}>
            <Text style={styles.summaryLabel}>USD Liquid Cash</Text>
            <Text style={styles.summaryValue}>{formatMoney(usdStats.liquidAssets, "USD")}</Text>
          </View>
        </View>

        {/* Liquid Bank Accounts (INR) */}
        <Text style={styles.sectionTitle}>INR Bank & Credit Accounts</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeaderRow]}>
            <Text style={[styles.tableColHeader, { flex: 2 }]}>Account Name</Text>
            <Text style={[styles.tableColHeader, { flex: 1 }]}>Account Type</Text>
            <Text style={[styles.tableColHeader, { flex: 1, textAlign: "right" }]}>Balance</Text>
          </View>
          {inrAccounts.length > 0 ? (
            inrAccounts.map((acc, idx) => (
              <View key={idx} style={[styles.tableRow, idx === inrAccounts.length - 1 ? { borderBottomWidth: 0 } : {}]}>
                <Text style={[styles.tableCol, { flex: 2 }]}>{acc.name}</Text>
                <Text style={[styles.tableCol, { flex: 1, textTransform: "capitalize" }]}>{acc.type}</Text>
                <Text style={[styles.tableCol, { flex: 1, textAlign: "right" }]}>{formatMoney(acc.balance, "INR")}</Text>
              </View>
            ))
          ) : (
            <View style={styles.tableRow}><Text style={[styles.tableCol, { flex: 1, textAlign: "center", color: "#94a3b8" }]}>No INR Accounts logged.</Text></View>
          )}
        </View>

        {/* Liquid Bank Accounts (USD) */}
        <Text style={styles.sectionTitle}>USD Cash & Spot Accounts</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeaderRow]}>
            <Text style={[styles.tableColHeader, { flex: 2 }]}>Account Name</Text>
            <Text style={[styles.tableColHeader, { flex: 1 }]}>Account Type</Text>
            <Text style={[styles.tableColHeader, { flex: 1, textAlign: "right" }]}>Balance</Text>
          </View>
          {usdAccounts.length > 0 ? (
            usdAccounts.map((acc, idx) => (
              <View key={idx} style={[styles.tableRow, idx === usdAccounts.length - 1 ? { borderBottomWidth: 0 } : {}]}>
                <Text style={[styles.tableCol, { flex: 2 }]}>{acc.name}</Text>
                <Text style={[styles.tableCol, { flex: 1, textTransform: "capitalize" }]}>{acc.type}</Text>
                <Text style={[styles.tableCol, { flex: 1, textAlign: "right" }]}>{formatMoney(acc.balance, "USD")}</Text>
              </View>
            ))
          ) : (
            <View style={styles.tableRow}><Text style={[styles.tableCol, { flex: 1, textAlign: "center", color: "#94a3b8" }]}>No USD Accounts logged.</Text></View>
          )}
        </View>

        <View style={styles.footer}>
          <Text>Finance OS Wealth Report • Confidential</Text>
          <Text>Page 1 of 3</Text>
        </View>
      </Page>

      {/* PAGE 2: SECURITIES & INVESTMENTS DETAILS */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoSection}>
            <Text style={styles.title}>FINANCE OS STATEMENT</Text>
            <Text style={styles.subtitle}>Securities & Asset Holding Breakdown</Text>
          </View>
          <View style={styles.metaSection}>
            <Text>Prepared For: {userName}</Text>
            <Text>Statement Period: {statementPeriod}</Text>
          </View>
        </View>

        {/* INR Stocks */}
        <Text style={styles.sectionTitle}>Indian Equities Portfolio (INR)</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeaderRow]}>
            <Text style={[styles.tableColHeader, { flex: 1.2 }]}>Symbol</Text>
            <Text style={[styles.tableColHeader, { flex: 2 }]}>Company Name</Text>
            <Text style={[styles.tableColHeader, { flex: 0.8, textAlign: "right" }]}>Quantity</Text>
            <Text style={[styles.tableColHeader, { flex: 1, textAlign: "right" }]}>Avg Price</Text>
            <Text style={[styles.tableColHeader, { flex: 1, textAlign: "right" }]}>Current Price</Text>
            <Text style={[styles.tableColHeader, { flex: 1.2, textAlign: "right" }]}>Current Value</Text>
          </View>
          {inrStocks.length > 0 ? (
            inrStocks.map((stock, idx) => (
              <View key={idx} style={[styles.tableRow, idx === inrStocks.length - 1 ? { borderBottomWidth: 0 } : {}]}>
                <Text style={[styles.tableCol, { flex: 1.2 }]}>{stock.symbol}</Text>
                <Text style={[styles.tableCol, { flex: 2 }]}>{stock.name}</Text>
                <Text style={[styles.tableCol, { flex: 0.8, textAlign: "right" }]}>{stock.quantity}</Text>
                <Text style={[styles.tableCol, { flex: 1, textAlign: "right" }]}>{formatMoney(stock.buy_price, "INR")}</Text>
                <Text style={[styles.tableCol, { flex: 1, textAlign: "right" }]}>{formatMoney(stock.current_price, "INR")}</Text>
                <Text style={[styles.tableCol, { flex: 1.2, textAlign: "right", fontWeight: "bold" }]}>{formatMoney(stock.value, "INR")}</Text>
              </View>
            ))
          ) : (
            <View style={styles.tableRow}><Text style={[styles.tableCol, { flex: 1, textAlign: "center", color: "#94a3b8" }]}>No Indian Equities holdings logged.</Text></View>
          )}
        </View>

        {/* INR Mutual Funds */}
        <Text style={styles.sectionTitle}>Mutual Funds Portfolio (INR)</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeaderRow]}>
            <Text style={[styles.tableColHeader, { flex: 2.2 }]}>Fund Name</Text>
            <Text style={[styles.tableColHeader, { flex: 1 }]}>Category</Text>
            <Text style={[styles.tableColHeader, { flex: 0.8, textAlign: "right" }]}>Units</Text>
            <Text style={[styles.tableColHeader, { flex: 1, textAlign: "right" }]}>Avg NAV</Text>
            <Text style={[styles.tableColHeader, { flex: 1, textAlign: "right" }]}>Current NAV</Text>
            <Text style={[styles.tableColHeader, { flex: 1.2, textAlign: "right" }]}>Current Value</Text>
          </View>
          {inrMutualFunds.length > 0 ? (
            inrMutualFunds.map((mf, idx) => (
              <View key={idx} style={[styles.tableRow, idx === inrMutualFunds.length - 1 ? { borderBottomWidth: 0 } : {}]}>
                <Text style={[styles.tableCol, { flex: 2.2 }]}>{mf.fund_name}</Text>
                <Text style={[styles.tableCol, { flex: 1 }]}>{mf.category}</Text>
                <Text style={[styles.tableCol, { flex: 0.8, textAlign: "right" }]}>{mf.units.toFixed(3)}</Text>
                <Text style={[styles.tableCol, { flex: 1, textAlign: "right" }]}>{formatMoney(mf.avg_nav, "INR")}</Text>
                <Text style={[styles.tableCol, { flex: 1, textAlign: "right" }]}>{formatMoney(mf.current_nav, "INR")}</Text>
                <Text style={[styles.tableCol, { flex: 1.2, textAlign: "right", fontWeight: "bold" }]}>{formatMoney(mf.value, "INR")}</Text>
              </View>
            ))
          ) : (
            <View style={styles.tableRow}><Text style={[styles.tableCol, { flex: 1, textAlign: "center", color: "#94a3b8" }]}>No Mutual Funds units logged.</Text></View>
          )}
        </View>

        {/* USD Stocks */}
        <Text style={styles.sectionTitle}>US Equities Portfolio (USD)</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeaderRow]}>
            <Text style={[styles.tableColHeader, { flex: 1.2 }]}>Symbol</Text>
            <Text style={[styles.tableColHeader, { flex: 2 }]}>Company Name</Text>
            <Text style={[styles.tableColHeader, { flex: 0.8, textAlign: "right" }]}>Quantity</Text>
            <Text style={[styles.tableColHeader, { flex: 1, textAlign: "right" }]}>Avg Price</Text>
            <Text style={[styles.tableColHeader, { flex: 1, textAlign: "right" }]}>Current Price</Text>
            <Text style={[styles.tableColHeader, { flex: 1.2, textAlign: "right" }]}>Current Value</Text>
          </View>
          {usdStocks.length > 0 ? (
            usdStocks.map((stock, idx) => (
              <View key={idx} style={[styles.tableRow, idx === usdStocks.length - 1 ? { borderBottomWidth: 0 } : {}]}>
                <Text style={[styles.tableCol, { flex: 1.2 }]}>{stock.symbol}</Text>
                <Text style={[styles.tableCol, { flex: 2 }]}>{stock.name}</Text>
                <Text style={[styles.tableCol, { flex: 0.8, textAlign: "right" }]}>{stock.quantity}</Text>
                <Text style={[styles.tableCol, { flex: 1, textAlign: "right" }]}>{formatMoney(stock.buy_price, "USD")}</Text>
                <Text style={[styles.tableCol, { flex: 1, textAlign: "right" }]}>{formatMoney(stock.current_price, "USD")}</Text>
                <Text style={[styles.tableCol, { flex: 1.2, textAlign: "right", fontWeight: "bold" }]}>{formatMoney(stock.value, "USD")}</Text>
              </View>
            ))
          ) : (
            <View style={styles.tableRow}><Text style={[styles.tableCol, { flex: 1, textAlign: "center", color: "#94a3b8" }]}>No US Equities holdings logged.</Text></View>
          )}
        </View>

        {/* Cryptocurrencies */}
        <Text style={styles.sectionTitle}>Cryptocurrency Assets (USD)</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeaderRow]}>
            <Text style={[styles.tableColHeader, { flex: 1.2 }]}>Token</Text>
            <Text style={[styles.tableColHeader, { flex: 2 }]}>Asset Name</Text>
            <Text style={[styles.tableColHeader, { flex: 1, textAlign: "right" }]}>Quantity</Text>
            <Text style={[styles.tableColHeader, { flex: 1, textAlign: "right" }]}>Buy Price</Text>
            <Text style={[styles.tableColHeader, { flex: 1, textAlign: "right" }]}>Current Price</Text>
            <Text style={[styles.tableColHeader, { flex: 1.2, textAlign: "right" }]}>Current Value</Text>
          </View>
          {usdCrypto.length > 0 ? (
            usdCrypto.map((crypto, idx) => (
              <View key={idx} style={[styles.tableRow, idx === usdCrypto.length - 1 ? { borderBottomWidth: 0 } : {}]}>
                <Text style={[styles.tableCol, { flex: 1.2 }]}>{crypto.symbol}</Text>
                <Text style={[styles.tableCol, { flex: 2 }]}>{crypto.name}</Text>
                <Text style={[styles.tableCol, { flex: 1, textAlign: "right" }]}>{crypto.quantity}</Text>
                <Text style={[styles.tableCol, { flex: 1, textAlign: "right" }]}>{formatMoney(crypto.buy_price, "USD")}</Text>
                <Text style={[styles.tableCol, { flex: 1, textAlign: "right" }]}>{formatMoney(crypto.current_price, "USD")}</Text>
                <Text style={[styles.tableCol, { flex: 1.2, textAlign: "right", fontWeight: "bold" }]}>{formatMoney(crypto.value, "USD")}</Text>
              </View>
            ))
          ) : (
            <View style={styles.tableRow}><Text style={[styles.tableCol, { flex: 1, textAlign: "center", color: "#94a3b8" }]}>No Crypto tokens logged.</Text></View>
          )}
        </View>

        <View style={styles.footer}>
          <Text>Finance OS Wealth Report • Confidential</Text>
          <Text>Page 2 of 3</Text>
        </View>
      </Page>

      {/* PAGE 3: BONDS, LIABILITIES & LEDGER LOG */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoSection}>
            <Text style={styles.title}>FINANCE OS STATEMENT</Text>
            <Text style={styles.subtitle}>Bonds, Liabilities & Ledger Audit</Text>
          </View>
          <View style={styles.metaSection}>
            <Text>Prepared For: {userName}</Text>
            <Text>Statement Period: {statementPeriod}</Text>
          </View>
        </View>

        {/* INR Bonds */}
        <Text style={styles.sectionTitle}>Fixed Income & Bonds Portfolio (INR)</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeaderRow]}>
            <Text style={[styles.tableColHeader, { flex: 2 }]}>Bond Name</Text>
            <Text style={[styles.tableColHeader, { flex: 1.5 }]}>Issuer</Text>
            <Text style={[styles.tableColHeader, { flex: 0.8, textAlign: "right" }]}>Quantity</Text>
            <Text style={[styles.tableColHeader, { flex: 0.8, textAlign: "right" }]}>Coupon %</Text>
            <Text style={[styles.tableColHeader, { flex: 1, textAlign: "right" }]}>Face Value</Text>
            <Text style={[styles.tableColHeader, { flex: 1.2, textAlign: "right" }]}>Current Value</Text>
          </View>
          {inrBonds.length > 0 ? (
            inrBonds.map((bond, idx) => (
              <View key={idx} style={[styles.tableRow, idx === inrBonds.length - 1 ? { borderBottomWidth: 0 } : {}]}>
                <Text style={[styles.tableCol, { flex: 2 }]}>{bond.bond_name}</Text>
                <Text style={[styles.tableCol, { flex: 1.5 }]}>{bond.issuer}</Text>
                <Text style={[styles.tableCol, { flex: 0.8, textAlign: "right" }]}>{bond.quantity}</Text>
                <Text style={[styles.tableCol, { flex: 0.8, textAlign: "right" }]}>{bond.coupon_rate}%</Text>
                <Text style={[styles.tableCol, { flex: 1, textAlign: "right" }]}>{formatMoney(bond.purchase_price, "INR")}</Text>
                <Text style={[styles.tableCol, { flex: 1.2, textAlign: "right", fontWeight: "bold" }]}>{formatMoney(bond.value, "INR")}</Text>
              </View>
            ))
          ) : (
            <View style={styles.tableRow}><Text style={[styles.tableCol, { flex: 1, textAlign: "center", color: "#94a3b8" }]}>No Bond positions logged.</Text></View>
          )}
        </View>

        {/* Alternative Assets */}
        <Text style={styles.sectionTitle}>Alternative Assets (INR)</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeaderRow]}>
            <Text style={[styles.tableColHeader, { flex: 2 }]}>Asset Name</Text>
            <Text style={[styles.tableColHeader, { flex: 1.5 }]}>Category</Text>
            <Text style={[styles.tableColHeader, { flex: 1.2, textAlign: "right" }]}>Purchase Cost</Text>
            <Text style={[styles.tableColHeader, { flex: 1.2, textAlign: "right" }]}>Valuation</Text>
          </View>
          {inrAlternativeAssets.length > 0 ? (
            inrAlternativeAssets.map((asset, idx) => (
              <View key={idx} style={[styles.tableRow, idx === inrAlternativeAssets.length - 1 ? { borderBottomWidth: 0 } : {}]}>
                <Text style={[styles.tableCol, { flex: 2 }]}>{asset.name}</Text>
                <Text style={[styles.tableCol, { flex: 1.5 }]}>{asset.category}</Text>
                <Text style={[styles.tableCol, { flex: 1.2, textAlign: "right" }]}>{formatMoney(asset.purchase_price, "INR")}</Text>
                <Text style={[styles.tableCol, { flex: 1.2, textAlign: "right", fontWeight: "bold" }]}>{formatMoney(asset.current_value, "INR")}</Text>
              </View>
            ))
          ) : (
            <View style={styles.tableRow}><Text style={[styles.tableCol, { flex: 1, textAlign: "center", color: "#94a3b8" }]}>No Alternative Assets logged.</Text></View>
          )}
        </View>

        {/* Outstanding Liabilities */}
        <Text style={styles.sectionTitle}>Outstanding Loans & Liabilities</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeaderRow]}>
            <Text style={[styles.tableColHeader, { flex: 2 }]}>Liability Name</Text>
            <Text style={[styles.tableColHeader, { flex: 1.5 }]}>Category</Text>
            <Text style={[styles.tableColHeader, { flex: 0.8, textAlign: "right" }]}>Rate</Text>
            <Text style={[styles.tableColHeader, { flex: 1.2, textAlign: "right" }]}>Monthly EMI</Text>
            <Text style={[styles.tableColHeader, { flex: 1.2, textAlign: "right" }]}>Remaining Bal</Text>
          </View>
          {inrLiabilities.length > 0 ? (
            inrLiabilities.map((loan, idx) => (
              <View key={idx} style={[styles.tableRow, idx === inrLiabilities.length - 1 ? { borderBottomWidth: 0 } : {}]}>
                <Text style={[styles.tableCol, { flex: 2 }]}>{loan.name}</Text>
                <Text style={[styles.tableCol, { flex: 1.5 }]}>{loan.category}</Text>
                <Text style={[styles.tableCol, { flex: 0.8, textAlign: "right" }]}>{loan.interest_rate}%</Text>
                <Text style={[styles.tableCol, { flex: 1.2, textAlign: "right" }]}>{formatMoney(loan.monthly_payment, "INR")}</Text>
                <Text style={[styles.tableCol, { flex: 1.2, textAlign: "right", fontWeight: "bold" }]}>{formatMoney(loan.remaining_amount, "INR")}</Text>
              </View>
            ))
          ) : (
            <View style={styles.tableRow}><Text style={[styles.tableCol, { flex: 1, textAlign: "center", color: "#94a3b8" }]}>No liabilities logged.</Text></View>
          )}
        </View>

        {/* Transactions Ledger */}
        <Text style={styles.sectionTitle}>Cash Flow Audit Ledger (Current Month)</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeaderRow]}>
            <Text style={[styles.tableColHeader, { flex: 1 }]}>Date</Text>
            <Text style={[styles.tableColHeader, { flex: 2.2 }]}>Description</Text>
            <Text style={[styles.tableColHeader, { flex: 1 }]}>Category</Text>
            <Text style={[styles.tableColHeader, { flex: 1.5 }]}>Account Name</Text>
            <Text style={[styles.tableColHeader, { flex: 1.2, textAlign: "right" }]}>Amount</Text>
          </View>
          {transactions.length > 0 ? (
            transactions.map((txn, idx) => {
              const isExpense = txn.type === "expense";
              const isTransferOut = txn.type === "transfer_out";
              const sign = isExpense || isTransferOut ? "-" : "+";
              const color = isExpense || isTransferOut ? "#ef4444" : "#10b981";

              return (
                <View key={idx} style={[styles.tableRow, idx === transactions.length - 1 ? { borderBottomWidth: 0 } : {}]}>
                  <Text style={[styles.tableCol, { flex: 1 }]}>{txn.date}</Text>
                  <Text style={[styles.tableCol, { flex: 2.2 }]}>{txn.description}</Text>
                  <Text style={[styles.tableCol, { flex: 1 }]}>{txn.category || "—"}</Text>
                  <Text style={[styles.tableCol, { flex: 1.5 }]}>{txn.account_name || "—"}</Text>
                  <Text style={[styles.tableCol, { flex: 1.2, textAlign: "right", color, fontWeight: "bold" }]}>
                    {sign}
                    {formatMoney(txn.amount, txn.currency)}
                  </Text>
                </View>
              );
            })
          ) : (
            <View style={styles.tableRow}><Text style={[styles.tableCol, { flex: 1, textAlign: "center", color: "#94a3b8" }]}>No transactions logged for this period.</Text></View>
          )}
        </View>

        <View style={styles.footer}>
          <Text>Finance OS Wealth Report • Confidential</Text>
          <Text>Page 3 of 3</Text>
        </View>
      </Page>
    </Document>
  );
}
