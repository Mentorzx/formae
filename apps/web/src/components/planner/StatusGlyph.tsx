export type PlannerStatusTone =
  | "done"
  | "active"
  | "blocked"
  | "queued"
  | "neutral";

export interface StatusGlyphProps {
  status: PlannerStatusTone;
  size?: number;
  label?: string;
  title?: string;
}

const DEFAULT_SIZE = 18;

export function StatusGlyph({
  status,
  size = DEFAULT_SIZE,
  label,
  title,
}: StatusGlyphProps) {
  const ariaLabel = label ?? formatStatusLabel(status);
  const viewBox = "0 0 18 18";
  const commonProps = {
    width: size,
    height: size,
    viewBox,
    role: "img" as const,
    "aria-label": ariaLabel,
  };

  return (
    <svg {...commonProps} focusable="false">
      <title>{title ?? ariaLabel}</title>
      <circle cx="9" cy="9" r="8" fill={toneFill(status)} opacity="0.16" />
      <circle
        cx="9"
        cy="9"
        r="7.2"
        fill="none"
        stroke={toneStroke(status)}
        strokeWidth="1.4"
      />
      {status === "done" ? (
        <path
          d="M5.3 9.4 7.6 11.7 12.3 6.8"
          fill="none"
          stroke={toneStroke(status)}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      ) : status === "active" ? (
        <path
          d="M9 4.9v4.1l2.5 1.5"
          fill="none"
          stroke={toneStroke(status)}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      ) : status === "blocked" ? (
        <path
          d="M9 5.1v4.3M9 11.5h.01"
          fill="none"
          stroke={toneStroke(status)}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      ) : status === "queued" ? (
        <circle cx="9" cy="9" r="2.5" fill={toneStroke(status)} />
      ) : (
        <circle cx="9" cy="9" r="1.8" fill={toneStroke(status)} />
      )}
    </svg>
  );
}

function formatStatusLabel(status: PlannerStatusTone): string {
  switch (status) {
    case "done":
      return "Concluido";
    case "active":
      return "Em andamento";
    case "blocked":
      return "Bloqueado";
    case "queued":
      return "Na fila";
    case "neutral":
      return "Neutro";
    default:
      return status;
  }
}

function toneFill(status: PlannerStatusTone): string {
  switch (status) {
    case "done":
      return "#1b7f4a";
    case "active":
      return "#3252c3";
    case "blocked":
      return "#b24c00";
    case "queued":
      return "#6b7280";
    case "neutral":
      return "#94a3b8";
    default:
      return "#94a3b8";
  }
}

function toneStroke(status: PlannerStatusTone): string {
  switch (status) {
    case "done":
      return "#1f9d5d";
    case "active":
      return "#4d5d9c";
    case "blocked":
      return "#d97706";
    case "queued":
      return "#64748b";
    case "neutral":
      return "#94a3b8";
    default:
      return "#94a3b8";
  }
}
