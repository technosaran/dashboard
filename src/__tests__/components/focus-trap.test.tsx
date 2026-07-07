import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { FocusTrap } from "@/components/ui/focus-trap";

describe("FocusTrap", () => {
  it("traps focus and cycles through interactive elements", () => {
    const { container } = render(
      <FocusTrap>
        <div>
          <button id="btn1">Button 1</button>
          <input id="input1" placeholder="Input 1" />
          <button id="btn2">Button 2</button>
        </div>
      </FocusTrap>
    );

    const btn1 = container.querySelector("#btn1") as HTMLButtonElement;
    const input1 = container.querySelector("#input1") as HTMLInputElement;
    const btn2 = container.querySelector("#btn2") as HTMLButtonElement;

    // Initially focuses first focusable element
    expect(document.activeElement).toBe(btn1);

    // Simulate tab forward cycles
    btn1.focus();
    fireEvent.keyDown(btn1, { key: "Tab" });
    input1.focus();
    fireEvent.keyDown(input1, { key: "Tab" });
    btn2.focus();

    // Tab key on last element wraps focus back to the first element
    fireEvent.keyDown(btn2, { key: "Tab" });
    expect(document.activeElement).toBe(btn1);
  });

  it("invokes onEscape handler when Escape key is pressed", () => {
    const handleEscape = vi.fn();
    render(
      <FocusTrap onEscape={handleEscape}>
        <div>Modal Body</div>
      </FocusTrap>
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleEscape).toHaveBeenCalledTimes(1);
  });
});
