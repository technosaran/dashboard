import { describe, it, expect } from 'vitest';
import { calculateZerodhaCharges } from '@/lib/investment-utils';

describe('calculateZerodhaCharges', () => {
  describe('Buy side calculations', () => {
    it('should calculate charges for a standard NSE buy order', () => {
      // Buy 100 shares @ ₹500 each (turnover = ₹50,000)
      const result = calculateZerodhaCharges(100, 500, 'NSE', true);

      expect(result.turnover).toBe(50000);
      expect(result.brokerage).toBe(0); // Free equity delivery
      expect(result.stt).toBe(50); // 0.1% of turnover
      expect(result.stampDuty).toBeGreaterThan(0); // 0.015% on buy only
      expect(result.netAmount).toBeGreaterThan(50000); // Buy = turnover + charges
    });

    it('should have zero brokerage for equity delivery', () => {
      const result = calculateZerodhaCharges(10, 1000, 'NSE', true);
      expect(result.brokerage).toBe(0);
    });

    it('should include stamp duty on buy side', () => {
      const result = calculateZerodhaCharges(100, 500, 'NSE', true);
      // 0.015% of ₹50,000 = ₹7.50
      expect(result.stampDuty).toBe(7.5);
    });

    it('should not include DP charges on buy side', () => {
      const result = calculateZerodhaCharges(100, 500, 'NSE', true);
      expect(result.dpCharges).toBe(0);
    });

    it('should calculate STT at 0.1%', () => {
      const result = calculateZerodhaCharges(200, 250, 'NSE', true);
      // 0.1% of ₹50,000 = ₹50
      expect(result.stt).toBe(50);
    });
  });

  describe('Sell side calculations', () => {
    it('should calculate charges for a standard NSE sell order', () => {
      const result = calculateZerodhaCharges(100, 500, 'NSE', false);

      expect(result.turnover).toBe(50000);
      expect(result.netAmount).toBeLessThan(50000); // Sell = turnover - charges
    });

    it('should not include stamp duty on sell side', () => {
      const result = calculateZerodhaCharges(100, 500, 'NSE', false);
      expect(result.stampDuty).toBe(0);
    });

    it('should include DP charges on sell side', () => {
      const result = calculateZerodhaCharges(100, 500, 'NSE', false);
      // ₹13.5 + 18% GST = ₹15.93
      expect(result.dpCharges).toBeCloseTo(15.93, 1);
    });
  });

  describe('Exchange-specific calculations', () => {
    it('should use different transaction charge rates for NSE vs BSE', () => {
      const nse = calculateZerodhaCharges(100, 500, 'NSE', true);
      const bse = calculateZerodhaCharges(100, 500, 'BSE', true);

      // BSE has higher txn charge rate (0.0000375 vs 0.0000297)
      expect(bse.txnCharge).toBeGreaterThan(nse.txnCharge);
    });
  });

  describe('Edge cases', () => {
    it('should handle zero quantity', () => {
      const result = calculateZerodhaCharges(0, 500, 'NSE', true);
      expect(result.turnover).toBe(0);
      expect(result.totalCharges).toBe(0);
      expect(result.netAmount).toBe(0);
    });

    it('should handle very large orders', () => {
      // 10,000 shares @ ₹5,000 (turnover = ₹5 crore)
      const result = calculateZerodhaCharges(10000, 5000, 'NSE', true);
      expect(result.turnover).toBe(50000000);
      expect(result.stt).toBe(50000); // 0.1% of ₹5cr
      expect(result.totalCharges).toBeGreaterThan(0);
    });

    it('should ensure totalCharges is the sum of all individual charges', () => {
      const result = calculateZerodhaCharges(100, 500, 'NSE', true);
      const expectedTotal = Number(
        (result.stt + result.txnCharge + result.sebiCharge + result.stampDuty + result.gst + result.dpCharges).toFixed(2)
      );
      expect(result.totalCharges).toBeCloseTo(expectedTotal, 2);
    });

    it('should ensure netAmount = turnover + charges for buy', () => {
      const result = calculateZerodhaCharges(100, 500, 'NSE', true);
      expect(result.netAmount).toBe(result.turnover + result.totalCharges);
    });

    it('should ensure netAmount = turnover - charges for sell', () => {
      const result = calculateZerodhaCharges(100, 500, 'NSE', false);
      expect(result.netAmount).toBe(result.turnover - result.totalCharges);
    });
  });
});
