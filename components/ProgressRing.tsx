"use client";

export function ProgressRing({
  percent,
  size = 56,
  stroke = 4,
  className = "",
  label,
  variant = "dark",
  hideCenter = false,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  className?: string;
  label?: string;
  variant?: "dark" | "light";
  /** Omit inner % text (use with external label, e.g. course cards). */
  hideCenter?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const center = size / 2;
  const trackClass = variant === "light" ? "text-ink-200" : "text-white/20";
  const fillClass =
    clamped >= 100
      ? "text-emerald-500"
      : variant === "light"
        ? "text-brand-600"
        : "text-white";
  const textClass = variant === "light" ? "text-brand-700" : "text-white";
  const valueClass = size <= 40 ? "text-xs" : "text-sm";
  const suffixClass = size <= 40 ? "text-[7px]" : "text-[9px]";

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `${clamped}%`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className={trackClass}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`transition-all duration-500 ${fillClass}`}
        />
      </svg>
      {!hideCenter && (
        <span className={`absolute text-center font-bold leading-none ${textClass}`}>
          <span className={valueClass}>{clamped}</span>
          <span className={`${suffixClass} opacity-80`}>%</span>
        </span>
      )}
    </div>
  );
}
