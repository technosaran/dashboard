import React from "react";
import { render, screen } from "@testing-library/react";
import { AdminGuard } from "@/components/admin-guard";

// Mock user context
jest.mock("@/context/user-context", () => ({
  useUser: jest.fn(() => ({
    user: { id: "admin-1", email: "iamsaran.ai@gmail.com", user_metadata: { role: "admin", is_admin: true } },
    loading: false,
  })),
}));

describe("Super Admin Control Panel Guard", () => {
  it("renders protected admin children for authorized Super Admin users", async () => {
    render(
      <AdminGuard>
        <div data-testid="admin-content">Super Admin Studio Content</div>
      </AdminGuard>
    );

    expect(await screen.findByTestId("admin-content")).toBeInTheDocument();
  });
});
