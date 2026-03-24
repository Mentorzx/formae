import { buildProgressArcMetrics } from "./progressMath";

export interface ProgressDonutProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  title?: string;
  progressColor?: string;
  trackColor?: string;
}

export function ProgressDonut({
  value,
  max = 100,
  size = 104,
  strokeWidth = 12,
  label,
  title,
  progressColor = "#4d5d9c",
  trackColor = "#e2e8f0",
}: ProgressDonutProps) {
  const metrics = buildProgressArcMetrics(value, max, strokeWidth, size);
  const accessibleLabel = title ?? buildAccessibleLabel(metrics.percent, label);
  const centerLabel = label ?? `${Math.round(metrics.percent * 100)}%`;
  const valueNow = Math.round(metrics.percent * 100);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="progressbar"
      aria-label={accessibleLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={valueNow}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <circle
        cx={metrics.center}
        cy={metrics.center}
        r={metrics.radius}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
      />
      <circle
        cx={metrics.center}
        cy={metrics.center}
        r={metrics.radius}
        fill="none"
        stroke={progressColor}
        strokeDasharray={metrics.dashArray}
        strokeDashoffset={metrics.dashOffset}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
        transform={`rotate(-90 ${metrics.center} ${metrics.center})`}
      />
      <text
        x="50%"
        y="50%"
        fill="currentColor"
        fontSize={size * 0.18}
        fontWeight="700"
        dominantBaseline="middle"
        textAnchor="middle"
      >
        {centerLabel}
      </text>
    </svg>
  );
}

function buildAccessibleLabel(percent: number, label?: string): string {
  const percentage = `${Math.round(percent * 100)}%`;

  if (!label) {
    return percentage;
  }

  return `${label} - ${percentage}`;
}
