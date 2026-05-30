"use client";

import { StarIcon } from "./icons";

export function StarRating({
  value,
  onChange,
  size = "md",
  readOnly = false,
  label,
}: {
  value: number;
  onChange?: (rating: number) => void;
  size?: "sm" | "md" | "lg";
  readOnly?: boolean;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(5, Math.round(value)));
  const iconClass =
    size === "sm" ? "h-4 w-4" : size === "lg" ? "h-7 w-7" : "h-5 w-5";
  const gapClass = size === "lg" ? "gap-1.5" : "gap-0.5";

  return (
    <div
      className={`inline-flex items-center ${gapClass}`}
      role={readOnly ? "img" : "radiogroup"}
      aria-label={label ?? `${clamped} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= clamped;
        if (readOnly) {
          return (
            <StarIcon
              key={star}
              className={`${iconClass} ${
                filled ? "text-amber-500" : "text-ink-200"
              }`}
              aria-hidden
            />
          );
        }

        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={star === clamped}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            onClick={() => onChange?.(star)}
            className={`rounded p-0.5 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
              filled ? "text-amber-500" : "text-ink-300 hover:text-amber-400"
            }`}
          >
            <StarIcon className={iconClass} />
          </button>
        );
      })}
    </div>
  );
}
