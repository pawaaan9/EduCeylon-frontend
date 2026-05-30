"use client";

import type { ReactNode } from "react";

type ConfirmDialogProps = {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
  confirmIcon?: ReactNode;
  confirmClassName?: string;
};

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel,
  onCancel,
  onConfirm,
  loading = false,
  confirmIcon,
  confirmClassName = "btn-primary",
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" aria-hidden onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-2xl border border-ink-200 bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
        <div className="mt-2 text-sm text-ink-600 leading-relaxed">{description}</div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="btn btn-secondary w-full sm:w-auto"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn w-full sm:w-auto ${confirmClassName} disabled:opacity-60`}
            onClick={onConfirm}
            disabled={loading}
          >
            {confirmIcon}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
