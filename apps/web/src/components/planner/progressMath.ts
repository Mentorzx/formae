export interface ProgressArcMetrics {
  percent: number;
  safeValue: number;
  safeMax: number;
  radius: number;
  circumference: number;
  dashArray: string;
  dashOffset: number;
  center: number;
}

export function buildProgressArcMetrics(
  value: number,
  max: number,
  strokeWidth: number,
  size: number,
): ProgressArcMetrics {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 0;
  const safeValue = safeMax === 0 ? 0 : clamp(value, 0, safeMax);
  const percent = safeMax === 0 ? 0 : safeValue / safeMax;
  const radius = Math.max((size - strokeWidth) / 2, 0);
  const circumference = 2 * Math.PI * radius;
  const dashArray = circumference.toFixed(3);
  const dashOffset = circumference * (1 - percent);
  const center = size / 2;

  return {
    percent,
    safeValue,
    safeMax,
    radius,
    circumference,
    dashArray,
    dashOffset,
    center,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
