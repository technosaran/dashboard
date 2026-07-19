import { describe, it, expect } from 'vitest';
import { cn, parseToISODate, getExchangeRate } from '@/lib/utils';

describe('cn (class name merger)', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should handle conditional classes', () => {
    const isActive = true;
    expect(cn('base', isActive && 'active')).toBe('base active');
  });

  it('should filter out falsy values', () => {
    expect(cn('base', false, null, undefined, 'end')).toBe('base end');
  });

  it('should merge conflicting Tailwind classes', () => {
    // twMerge should resolve conflicts: later class wins
    expect(cn('px-4', 'px-6')).toBe('px-6');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('should handle empty inputs', () => {
    expect(cn()).toBe('');
    expect(cn('')).toBe('');
  });
});

describe('parseToISODate', () => {

  it('should parse YYYY-MM-DD format directly', () => {
    expect(parseToISODate('2026-05-31')).toBe('2026-05-31');
  });

  it('should parse DD-MM-YYYY format and convert to YYYY-MM-DD', () => {
    expect(parseToISODate('31-05-2026')).toBe('2026-05-31');
  });

  it('should parse DD/MM/YYYY format and convert to YYYY-MM-DD', () => {
    expect(parseToISODate('31/05/2026')).toBe('2026-05-31');
  });

  it('should pad single digits properly', () => {
    expect(parseToISODate('1/2/2025')).toBe('2025-02-01');
    expect(parseToISODate('01-02-2025')).toBe('2025-02-01');
  });

  it('should handle whitespaces', () => {
    expect(parseToISODate('  31-05-2026  ')).toBe('2026-05-31');
  });

  it('should parse US MM/DD/YYYY format when day component > 12', () => {
    expect(parseToISODate('12/31/2025')).toBe('2025-12-31');
    expect(parseToISODate('05-13-2026')).toBe('2026-05-13');
  });

  it('should fallback to current date for null/undefined/empty string', () => {
    const today = new Date().toISOString().split('T')[0];
    expect(parseToISODate(null)).toBe(today);
    expect(parseToISODate(undefined)).toBe(today);
    expect(parseToISODate('')).toBe(today);
    expect(parseToISODate('   ')).toBe(today);
  });

  it('should parse 2-digit year DD-MM-YY format correctly', () => {
    expect(parseToISODate('31-05-26')).toBe('2026-05-31');
    expect(parseToISODate('15/08/25')).toBe('2025-08-15');
  });
});

describe('getExchangeRate', () => {
  it('should return 1.0 when base currency matches target currency', async () => {
    expect(await getExchangeRate('INR', 'INR')).toBe(1.0);
    expect(await getExchangeRate('usd', 'USD')).toBe(1.0);
  });

  it('should return default exchange rate for known major currencies to INR', async () => {
    expect(await getExchangeRate('USD', 'INR')).toBe(85.0);
    expect(await getExchangeRate('EUR', 'INR')).toBe(92.0);
    expect(await getExchangeRate('GBP', 'INR')).toBe(108.0);
    expect(await getExchangeRate('AED', 'INR')).toBe(23.1);
  });

  it('should return clean fallback rate for unknown currencies', async () => {
    expect(await getExchangeRate('XYZ', 'INR')).toBe(85.0);
  });
});

