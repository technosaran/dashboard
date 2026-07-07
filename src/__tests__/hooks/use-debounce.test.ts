import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebounce, useDebouncedCallback } from "@/hooks/useDebounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return the initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("initial", 500));
    expect(result.current).toBe("initial");
  });

  it("should update the value only after the specified delay", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "initial", delay: 500 } }
    );

    expect(result.current).toBe("initial");

    // Rerender with a new value
    rerender({ value: "updated", delay: 500 });
    expect(result.current).toBe("initial"); // Still initial

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current).toBe("initial"); // Still initial

    act(() => {
      vi.advanceTimersByTime(250); // Total 500ms passed
    });
    expect(result.current).toBe("updated"); // Updated!
  });
});

describe("useDebouncedCallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should debounce callback executions", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 300));

    // Call multiple times rapidly
    act(() => {
      result.current("arg1");
      result.current("arg2");
      result.current("arg3");
    });

    expect(callback).not.toHaveBeenCalled();

    // Advance timer slightly
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(callback).not.toHaveBeenCalled();

    // Pass the delay
    act(() => {
      vi.advanceTimersByTime(100); // 300ms total
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("arg3");
  });
});
