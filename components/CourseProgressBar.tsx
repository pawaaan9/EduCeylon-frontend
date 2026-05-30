"use client";

import { useT } from "@/lib/i18n/I18nProvider";

export function CourseProgressBar({
  percent,
  size = "md",
  showLabel = true,
  variant = "light",
}: {
  percent: number;
  size?: "sm" | "md";
  showLabel?: boolean;
  variant?: "light" | "dark";
}) {
  const t = useT();
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const barH = size === "sm" ? "h-1.5" : "h-2";
  const track =
    variant === "dark" ? "bg-white/15" : "bg-ink-100";
  const fill = clamped >= 100 ? "bg-emerald-500" : "brand-gradient";

  return (
    <div className="w-full">
      {showLabel && (
        <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
          <span
            className={
              variant === "dark" ? "text-ink-300" : "font-medium text-ink-600"
            }
          >
            {t("student.study.progress")}
          </span>
          <span
            className={
              variant === "dark"
                ? "font-semibold text-white"
                : "font-semibold text-brand-700"
            }
          >
            {clamped}% {t("student.study.complete")}
          </span>
        </div>
      )}
      <div
        className={`w-full overflow-hidden rounded-full ${track} ${barH}`}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${clamped}% ${t("student.study.complete")}`}
      >
        <div
          className={`${barH} rounded-full transition-all duration-300 ${fill}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
