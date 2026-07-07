import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SkipNavLink, SkipNavContent } from "@/components/ui/skip-nav";

describe("SkipNavLink", () => {
  it("renders with correct href anchor link target", () => {
    render(<SkipNavLink contentId="custom-target">Skip Now</SkipNavLink>);
    
    const link = screen.getByRole("link", { name: "Skip Now" });
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe("#custom-target");
  });

  it("renders SkipNavContent with correct id and role", () => {
    render(
      <SkipNavContent id="custom-target">
        <div>Main content</div>
      </SkipNavContent>
    );

    const main = screen.getByRole("main");
    expect(main).toBeDefined();
    expect(main.getAttribute("id")).toBe("custom-target");
    expect(main.getAttribute("tabIndex")).toBe("-1");
  });
});
