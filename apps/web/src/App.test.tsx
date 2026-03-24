import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("./localStudentSnapshot", () => ({
  loadLatestProjectedStudentSnapshot: vi.fn(async () => ({
    bundle: null,
    source: "none",
  })),
}));

import App from "./App";

describe("App", () => {
  it("renders the core schedule parsing example", async () => {
    render(<App />);

    expect(await screen.findByText("Formaê")).toBeInTheDocument();
    expect(await screen.findByText(/35N12/)).toBeInTheDocument();
    expect(await screen.findByText(/18:30 a 20:20/i)).toBeInTheDocument();
    expect(
      await screen.findByText(/Nenhuma projecao local foi salva ainda/i),
    ).toBeInTheDocument();
  });
});
