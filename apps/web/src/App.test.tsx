import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  it("renders the core schedule parsing example", () => {
    render(<App />);

    expect(screen.getByText("Formaê")).toBeInTheDocument();
    expect(screen.getByText(/35N12/)).toBeInTheDocument();
    expect(screen.getByText(/18:30 a 20:20/i)).toBeInTheDocument();
  });
});
