import type { PlannerStatusTone } from "./StatusGlyph";
import { StatusGlyph } from "./StatusGlyph";

export interface DependencyLegendItem {
  id: string;
  label: string;
  tone: PlannerStatusTone;
  description?: string;
}

export interface DependencyLegendProps {
  title?: string;
  items: DependencyLegendItem[];
}

export function DependencyLegend({
  title = "Legenda de dependencias",
  items,
}: DependencyLegendProps) {
  return (
    <section aria-label={title}>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <StatusGlyph status={item.tone} label={item.label} size={16} />
            <span>{item.label}</span>
            {item.description ? <small>{item.description}</small> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
