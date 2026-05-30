"use client";

import { useRef, useState } from "react";
import { CheckCircleIcon, CloseIcon, UploadIcon } from "@/components/icons";
import {
  uploadCourseAsset,
  type CourseAssetKind,
  type UploadProgress,
} from "@/lib/api/courses";
import { formatBytes } from "@/lib/format/bytes";
import { getVideoDurationMinutes } from "@/lib/media/video-duration";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useT } from "@/lib/i18n/I18nProvider";

export function CourseFileUpload({
  courseId,
  kind,
  label,
  accept,
  currentUrl,
  onChange,
  onUploaded,
  disabled,
  disabledHint,
}: {
  courseId?: string | null;
  kind: CourseAssetKind;
  label: string;
  accept: string;
  currentUrl?: string;
  onChange: (url: string | undefined) => void;
  /** Called after a file is uploaded successfully (includes video duration when available). */
  onUploaded?: (result: {
    url: string;
    durationMinutes?: number;
  }) => void | Promise<void>;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const t = useT();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function cancelUpload() {
    abortRef.current?.abort();
    abortRef.current = null;
    setUploading(false);
    setProgress(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFile(file: File) {
    if (disabled || !courseId) return;
    if (!user) {
      setErr("You must be signed in.");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setUploading(true);
    setProgress({
      phase: "preparing",
      loaded: 0,
      total: file.size,
      percent: 0,
    });
    setErr(null);

    try {
      const token = await user.getIdToken();
      const durationMinutes =
        kind === "lessonVideo" ? await getVideoDurationMinutes(file) : undefined;
      const url = await uploadCourseAsset(token, courseId, kind, file, {
        signal: controller.signal,
        onProgress: setProgress,
      });
      setProgress({
        phase: "complete",
        loaded: file.size,
        total: file.size,
        percent: 100,
      });
      onChange(url);
      await onUploaded?.({ url, durationMinutes });
      await new Promise((resolve) => setTimeout(resolve, 450));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      abortRef.current = null;
      setUploading(false);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <div className="text-sm font-medium text-ink-700 mb-1.5">{label}</div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />

      {uploading && progress ? (
        <UploadProgressPanel
          progress={progress}
          onCancel={cancelUpload}
          preparingLabel={t("onboard.upload.preparing")}
          completeLabel={t("onboard.upload.complete")}
          cancelLabel={t("action.cancel")}
        />
      ) : currentUrl ? (
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800 max-w-full">
            <CheckCircleIcon className="h-4 w-4 shrink-0" />
            <span className="truncate font-medium">{decodeFileName(currentUrl)}</span>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="btn btn-secondary btn-sm h-9 text-xs"
          >
            <UploadIcon className="h-4 w-4" />
            {t("onboard.upload.replace")}
          </button>
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-rose-600"
            aria-label="Remove"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
      ) : disabled ? (
        <p className="text-xs text-ink-500">{disabledHint}</p>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="btn btn-secondary"
        >
          <UploadIcon className="h-4 w-4" />
          {t("onboard.upload.selectFile")}
        </button>
      )}

      {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
    </div>
  );
}

function UploadProgressPanel({
  progress,
  onCancel,
  preparingLabel,
  completeLabel,
  cancelLabel,
}: {
  progress: UploadProgress;
  onCancel: () => void;
  preparingLabel: string;
  completeLabel: string;
  cancelLabel: string;
}) {
  if (progress.phase === "complete" || progress.percent >= 100) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircleIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink-900">100%</div>
            <div className="text-xs text-emerald-700 mt-0.5">{completeLabel}</div>
          </div>
        </div>
      </div>
    );
  }

  const statusLabel =
    progress.phase === "preparing"
      ? preparingLabel
      : `${progress.percent}%`;

  return (
    <div className="rounded-lg border border-brand-200 bg-brand-50/50 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-ink-900">{statusLabel}</div>
          <div className="text-xs text-ink-500 tabular-nums mt-0.5">
            {formatBytes(progress.loaded)} / {formatBytes(progress.total)}
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary btn-sm h-8 shrink-0 text-xs"
        >
          {cancelLabel}
        </button>
      </div>
      <div
        className="h-1.5 rounded-full bg-white overflow-hidden"
        role="progressbar"
        aria-valuenow={progress.percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-brand-600 transition-[width] duration-150 ease-out"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
    </div>
  );
}

function decodeFileName(url: string): string {
  try {
    const u = new URL(url);
    const path = decodeURIComponent(u.pathname);
    return path.split("/").pop() || url;
  } catch {
    return url;
  }
}
