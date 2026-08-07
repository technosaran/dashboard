import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("Button UI Component", () => {
  it("renders button with children text", () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByRole("button", { name: "Click Me" })).toBeInTheDocument();
  });

  it("renders spinner when isLoading is true", () => {
    const { container } = render(<Button isLoading>Submit</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    expect(screen.queryByText("Submit")).not.toBeInTheDocument();
  });

  it("disables button when disabled prop is set", () => {
    const handleClick = jest.fn();
    render(<Button disabled onClick={handleClick}>Disabled</Button>);
    const btn = screen.getByRole("button", { name: "Disabled" });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("handles click event when enabled", () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Active</Button>);
    const btn = screen.getByRole("button", { name: "Active" });
    fireEvent.click(btn);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
