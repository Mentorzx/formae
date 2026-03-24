import { render, screen } from "@testing-library/react";

import { DependencyLegend } from "./DependencyLegend";
import { ProgressDonut } from "./ProgressDonut";
import { ProgressRing } from "./ProgressRing";
import { StatusGlyph } from "./StatusGlyph";

describe("planner primitives", () => {
  it("renders a compact status glyph with accessible label", () => {
    render(<StatusGlyph status="blocked" label="Bloqueado na matriz" />);

    expect(
      screen.getByRole("img", { name: "Bloqueado na matriz" }),
    ).toBeInTheDocument();
  });

  it("renders a donut progress indicator with computed percentage", () => {
    render(<ProgressDonut value={3} max={4} label="Concluicao" />);

    const progress = screen.getByRole("progressbar", {
      name: "Concluicao - 75%",
    });

    expect(progress).toHaveAttribute("aria-valuenow", "75");
    expect(screen.getByText("Concluicao")).toBeInTheDocument();
  });

  it("renders a compact progress ring without center label", () => {
    render(<ProgressRing value={1} max={2} title="Metade concluida" />);

    expect(
      screen.getByRole("img", { name: "Metade concluida" }),
    ).toBeInTheDocument();
  });

  it("renders a small dependency legend with glyphs and descriptions", () => {
    render(
      <DependencyLegend
        items={[
          {
            id: "required",
            label: "Obrigatoria",
            tone: "done",
            description: "Necessaria para seguir na trilha.",
          },
          {
            id: "elective",
            label: "Opcional",
            tone: "neutral",
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /legenda de dependencias/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Obrigatoria", { selector: "span" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Necessaria para seguir na trilha."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Opcional", { selector: "span" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(2);
  });
});
