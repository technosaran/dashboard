/**
 * Zerodha Equity Delivery Charges Calculation (NSE)
 * Based on Zerodha's official brokerage calculator as of 2024-2025
 */

interface ZerodhaCharges {
  brokerage: number;
  stt: number;
  txnCharge: number;
  sebiCharge: number;
  stampDuty: number;
  gst: number;
  totalCharges: number;
  netAmount: number; // Total cost (Investment + Charges)
}

export function calculateZerodhaCharges(
  quantity: number,
  price: number,
  exchange: "NSE" | "BSE" = "NSE",
  isBuy: boolean = true
): ZerodhaCharges & { turnover: number; dpCharges: number } {
  const turnover = quantity * price;
  
  // 1. Brokerage (Free for Equity Delivery)
  const brokerage = 0;

  // 2. STT/CTT (0.1% on Buy & Sell)
  const stt = Math.round(turnover * 0.001);

  // 3. Transaction Charges
  const txnChargeRate = exchange === "NSE" ? 0.0000297 : 0.0000375;
  const txnCharge = Number((turnover * txnChargeRate).toFixed(2));

  // 4. SEBI Charges (₹10 / Crore)
  const sebiCharge = Number((turnover * 0.0000001).toFixed(2));

  // 5. Stamp Duty (0.015% on Buy Side only)
  const stampDuty = isBuy ? Number((turnover * 0.00015).toFixed(2)) : 0;

  // 6. DP Charges (₹13.5 + 18% GST = ₹15.93 per scrip per day - ONLY ON SELL)
  const dpBase = !isBuy ? 13.5 : 0;
  const dpGst = Number((dpBase * 0.18).toFixed(2));
  const dpCharges = dpBase + dpGst;

  // 7. GST (18% on Brokerage + Txn Charge + SEBI Charge)
  const gst = Number(((brokerage + txnCharge + sebiCharge) * 0.18).toFixed(2));

  const totalCharges = Number((stt + txnCharge + sebiCharge + stampDuty + gst + dpCharges).toFixed(2));
  
  const netAmount = isBuy ? (turnover + totalCharges) : (turnover - totalCharges);

  return {
    turnover,
    brokerage,
    stt,
    txnCharge,
    sebiCharge,
    stampDuty,
    gst,
    dpCharges,
    totalCharges,
    netAmount
  };
}
