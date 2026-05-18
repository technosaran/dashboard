import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

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
