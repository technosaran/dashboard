import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Skeleton, TableSkeleton } from "@/components/ui/loading-skeleton";

describe("Skeleton Components", () => {
  it("renders base Skeleton with accessibility attributes", () => {
    render(<Skeleton data-testid="skeleton-block" />);

    const el = screen.getByTestId("skeleton-block");
    expect(el).toBeDefined();
    expect(el.getAttribute("role")).toBe("status");
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.className).toContain("animate-pulse");
  });

  it("renders correct number of rows in TableSkeleton", () => {
    const { container } = render(<TableSkeleton rows={3} columns={4} />);
    
    // Header block + 3 rows
    const rows = container.querySelectorAll(".border-b");
    expect(rows.length).toBe(4); 
  });
});
