import { buildProgressArcMetrics } from "./progressMath";

export interface ProgressRingProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  title?: string;
  trackColor?: string;
  progressColor?: string;
}

export function ProgressRing({
  value,
  max = 100,
  size = 28,
  strokeWidth = 4,
  title,
  trackColor = "#e2e8f0",
  progressColor = "#4d5d9c",
}: ProgressRingProps) {
  const metrics = buildProgressArcMetrics(value, max, strokeWidth, size);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={title ?? `${Math.round(metrics.percent * 100)}%`}
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
    </svg>
  );
}
