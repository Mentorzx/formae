import { render, screen } from "@testing-library/react";

import { CatalogPage } from "./CatalogPage";

describe("CatalogPage", () => {
  it("renders snapshot provenance and preserved seed curricula", () => {
    render(<CatalogPage />);

    expect(
      screen.getByText(/snapshot publico versionado para mostrar origem/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Proveniencia do snapshot/i)).toBeInTheDocument();
    expect(screen.getByText(/Cobertura por fonte/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Curriculos publicos detalhados/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Curriculos seed preservados/i),
    ).toBeInTheDocument();
    expect(screen.getByText("sigaa-public-turmas.html")).toBeInTheDocument();
    expect(screen.getByText("Trilha base UFBA seed local")).toBeInTheDocument();
  });
});
