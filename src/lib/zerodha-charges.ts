/**
 * Zerodha Charges & Tax Calculator Utility
 * Implements real-world Indian Stock Market Statutory Taxes & Zerodha Brokerage Rates.
 */

export interface ZerodhaChargeBreakdown {
  brokerage: number;
  stt: number;
  transactionFee: number;
  gst: number;
  sebiCharges: number;
  stampDuty: number;
  dpCharges: number;
  totalCharges: number;
}

/**
 * 1. Equity Delivery (Stocks Delivery Buy/Sell)
 * - Brokerage: ₹0
 * - STT: 0.1% on Buy & Sell
 * - NSE Txn Fee: 0.00297%
 * - GST: 18% on (Brokerage + Txn Fee)
 * - SEBI: 0.0001% (₹10/crore)
 * - Stamp Duty: 0.015% (Buy only)
 * - DP Charges: ₹15.93 (Sell only, per scrip)
 */
export function calculateEquityDeliveryCharges(turnover: number, isBuy: boolean): ZerodhaChargeBreakdown {
  if (turnover <= 0) {
    return { brokerage: 0, stt: 0, transactionFee: 0, gst: 0, sebiCharges: 0, stampDuty: 0, dpCharges: 0, totalCharges: 0 };
  }

  const brokerage = 0;
  const stt = Math.round(turnover * 0.001 * 100) / 100;
  const transactionFee = Math.round(turnover * 0.0000297 * 100) / 100;
  const sebiCharges = Math.round(turnover * 0.000001 * 100) / 100;
  const stampDuty = isBuy ? Math.round(turnover * 0.00015 * 100) / 100 : 0;
  const dpCharges = !isBuy ? 15.93 : 0;
  const gst = Math.round((brokerage + transactionFee) * 0.18 * 100) / 100;

  const totalCharges = Math.round((brokerage + stt + transactionFee + gst + sebiCharges + stampDuty + dpCharges) * 100) / 100;

  return { brokerage, stt, transactionFee, gst, sebiCharges, stampDuty, dpCharges, totalCharges };
}

/**
 * 2. Equity Intraday (Stocks Intraday Buy/Sell)
 * - Brokerage: Min(0.03%, ₹20)
 * - STT: 0.025% (Sell side only)
 * - NSE Txn Fee: 0.00297%
 * - GST: 18% on (Brokerage + Txn Fee)
 * - SEBI: 0.0001%
 * - Stamp Duty: 0.003% (Buy side only)
 */
export function calculateEquityIntradayCharges(turnover: number, isBuy: boolean): ZerodhaChargeBreakdown {
  if (turnover <= 0) {
    return { brokerage: 0, stt: 0, transactionFee: 0, gst: 0, sebiCharges: 0, stampDuty: 0, dpCharges: 0, totalCharges: 0 };
  }

  const brokerage = Math.min(20, Math.round(turnover * 0.0003 * 100) / 100);
  const stt = !isBuy ? Math.round(turnover * 0.00025 * 100) / 100 : 0;
  const transactionFee = Math.round(turnover * 0.0000297 * 100) / 100;
  const sebiCharges = Math.round(turnover * 0.000001 * 100) / 100;
  const stampDuty = isBuy ? Math.round(turnover * 0.00003 * 100) / 100 : 0;
  const gst = Math.round((brokerage + transactionFee) * 0.18 * 100) / 100;

  const totalCharges = Math.round((brokerage + stt + transactionFee + gst + sebiCharges + stampDuty) * 100) / 100;

  return { brokerage, stt, transactionFee, gst, sebiCharges, stampDuty, dpCharges: 0, totalCharges };
}

/**
 * 3. Direct Mutual Funds (Zerodha Coin)
 * - Brokerage: ₹0
 * - Stamp Duty: 0.005% (Buy / Purchase only)
 * - STT: 0.001% (Sell / Redemption only)
 */
export function calculateMutualFundCharges(turnover: number, isBuy: boolean): ZerodhaChargeBreakdown {
  if (turnover <= 0) {
    return { brokerage: 0, stt: 0, transactionFee: 0, gst: 0, sebiCharges: 0, stampDuty: 0, dpCharges: 0, totalCharges: 0 };
  }

  const stampDuty = isBuy ? Math.round(turnover * 0.00005 * 100) / 100 : 0;
  const stt = !isBuy ? Math.round(turnover * 0.00001 * 100) / 100 : 0;

  const totalCharges = Math.round((stampDuty + stt) * 100) / 100;

  return { brokerage: 0, stt, transactionFee: 0, gst: 0, sebiCharges: 0, stampDuty, dpCharges: 0, totalCharges };
}

/**
 * 4. F&O Futures (Zerodha Kite Derivatives - Futures)
 * - Brokerage: Min(0.03%, ₹20)
 * - STT: 0.0125% (Sell side only)
 * - NSE Txn Fee: 0.00173%
 * - GST: 18% on (Brokerage + Txn Fee)
 * - SEBI: 0.0001%
 * - Stamp Duty: 0.002% (Buy side only)
 */
export function calculateFnoFuturesCharges(turnover: number, isBuy: boolean): ZerodhaChargeBreakdown {
  if (turnover <= 0) {
    return { brokerage: 0, stt: 0, transactionFee: 0, gst: 0, sebiCharges: 0, stampDuty: 0, dpCharges: 0, totalCharges: 0 };
  }

  const brokerage = Math.min(20, Math.round(turnover * 0.0003 * 100) / 100);
  const stt = !isBuy ? Math.round(turnover * 0.000125 * 100) / 100 : 0;
  const transactionFee = Math.round(turnover * 0.0000173 * 100) / 100;
  const sebiCharges = Math.round(turnover * 0.000001 * 100) / 100;
  const stampDuty = isBuy ? Math.round(turnover * 0.00002 * 100) / 100 : 0;
  const gst = Math.round((brokerage + transactionFee) * 0.18 * 100) / 100;

  const totalCharges = Math.round((brokerage + stt + transactionFee + gst + sebiCharges + stampDuty) * 100) / 100;

  return { brokerage, stt, transactionFee, gst, sebiCharges, stampDuty, dpCharges: 0, totalCharges };
}

/**
 * 5. F&O Options (Zerodha Kite Derivatives - Options)
 * - Brokerage: Flat ₹20 per order
 * - STT: 0.0625% (Sell side on premium)
 * - NSE Txn Fee: 0.0355% (on premium)
 * - GST: 18% on (Brokerage + Txn Fee)
 * - SEBI: 0.0001%
 * - Stamp Duty: 0.003% (Buy side on premium)
 */
export function calculateFnoOptionsCharges(turnover: number, isBuy: boolean): ZerodhaChargeBreakdown {
  if (turnover <= 0) {
    return { brokerage: 0, stt: 0, transactionFee: 0, gst: 0, sebiCharges: 0, stampDuty: 0, dpCharges: 0, totalCharges: 0 };
  }

  const brokerage = 20;
  const stt = !isBuy ? Math.round(turnover * 0.000625 * 100) / 100 : 0;
  const transactionFee = Math.round(turnover * 0.000355 * 100) / 100;
  const sebiCharges = Math.round(turnover * 0.000001 * 100) / 100;
  const stampDuty = isBuy ? Math.round(turnover * 0.00003 * 100) / 100 : 0;
  const gst = Math.round((brokerage + transactionFee) * 0.18 * 100) / 100;

  const totalCharges = Math.round((brokerage + stt + transactionFee + gst + sebiCharges + stampDuty) * 100) / 100;

  return { brokerage, stt, transactionFee, gst, sebiCharges, stampDuty, dpCharges: 0, totalCharges };
}
