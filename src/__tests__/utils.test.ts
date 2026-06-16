import { describe, it, expect } from 'vitest';
import { cn, parseToISODate } from '@/lib/utils';

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
});

