import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSubmitLock } from '@/hooks/use-submit-lock';

describe('useSubmitLock', () => {
  it('should initialize with submitting as false', () => {
    const { result } = renderHook(() => useSubmitLock());
    const [submitting] = result.current;
    
    expect(submitting).toBe(false);
  });

  it('should execute the handler and return its result', async () => {
    const { result } = renderHook(() => useSubmitLock<string>());
    const [_, withLock] = result.current;
    
    const handler = vi.fn().mockResolvedValue('success');
    
    let returnValue;
    await act(async () => {
      returnValue = await withLock(handler);
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(returnValue).toBe('success');
  });

  it('should toggle submitting state during execution', async () => {
    const { result } = renderHook(() => useSubmitLock());
    
    let resolveHandler: (value: void | PromiseLike<void>) => void;
    const promise = new Promise<void>((resolve) => {
      resolveHandler = resolve;
    });
    
    const handler = vi.fn().mockReturnValue(promise);

    act(() => {
      result.current[1](handler);
    });

    // Should be true while executing
    expect(result.current[0]).toBe(true);

    await act(async () => {
      resolveHandler!();
      await promise;
    });

    // Should be false after execution
    expect(result.current[0]).toBe(false);
  });

  it('should prevent concurrent executions', async () => {
    const { result } = renderHook(() => useSubmitLock());
    const [_, withLock] = result.current;
    
    let resolveHandler: (value: void | PromiseLike<void>) => void;
    const promise = new Promise<void>((resolve) => {
      resolveHandler = resolve;
    });
    
    const handler1 = vi.fn().mockReturnValue(promise);
    const handler2 = vi.fn().mockResolvedValue('ignored');

    // Start first execution
    let call1Promise;
    act(() => {
      call1Promise = withLock(handler1);
    });

    // Attempt second execution while first is running
    let call2Result;
    await act(async () => {
      call2Result = await withLock(handler2);
    });

    // The second call should be ignored and return undefined
    expect(handler2).not.toHaveBeenCalled();
    expect(call2Result).toBeUndefined();

    // Finish first execution
    await act(async () => {
      resolveHandler!();
      await call1Promise;
    });
  });

  it('should release lock even if handler throws an error', async () => {
    const { result } = renderHook(() => useSubmitLock());
    const [_, withLock] = result.current;
    
    const handler = vi.fn().mockRejectedValue(new Error('Test error'));

    try {
      await act(async () => {
        await withLock(handler);
      });
    } catch (e) {
      // Expected error
    }

    // Submitting should be reset to false
    expect(result.current[0]).toBe(false);

    // Should be able to execute again
    const secondHandler = vi.fn().mockResolvedValue('success');
    let secondResult;
    
    await act(async () => {
      secondResult = await result.current[1](secondHandler);
    });

    expect(secondHandler).toHaveBeenCalled();
    expect(secondResult).toBe('success');
  });
});
