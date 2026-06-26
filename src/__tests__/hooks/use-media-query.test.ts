import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery } from '@/hooks/use-media-query';

describe('useMediaQuery', () => {
  let listeners: ((e: any) => void)[] = [];
  let matchesOverride: boolean | null = null;

  beforeEach(() => {
    listeners = [];
    matchesOverride = null;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: matchesOverride !== null ? matchesOverride : query === '(min-width: 768px)',
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn((event, callback) => {
          if (event === 'change') {
            listeners.push(callback);
          }
        }),
        removeEventListener: vi.fn((event, callback) => {
          if (event === 'change') {
            listeners = listeners.filter(l => l !== callback);
          }
        }),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('should return true if media query matches', () => {
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(true);
  });

  it('should return false if media query does not match', () => {
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
    expect(result.current).toBe(false);
  });

  it('should update when media query changes', () => {
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(true);

    // Simulate window resizing / query change
    act(() => {
      matchesOverride = false;
      listeners.forEach(listener => listener({ matches: false } as any));
    });

    expect(result.current).toBe(false);
  });
});
