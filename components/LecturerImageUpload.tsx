"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ImageCropModal } from "@/components/ImageCropModal";
import { UploadIcon } from "@/components/icons";
import { useT } from "@/lib/i18n/I18nProvider";
import {
  IMAGE_CROP_PRESETS,
  type ImageCropPresetKey,
} from "@/lib/image/crop-presets";
import { uploadLecturerAsset, type UploadKey } from "@/lib/api/lecturers";
import { useAuth } from "@/lib/firebase/AuthProvider";

type PreviewAspect = "square" | "cover";

const PREVIEW_CLASS: Record<PreviewAspect, string> = {
  square: "h-32 w-32",
  cover: "h-32 w-full max-w-md",
};

export function LecturerImageUpload({
  uid,
  label,
  helper,
  currentUrl,
  uploadKey,
  onChange,
  previewAspect,
  cropPreset,
}: {
  uid: string;
  label: string;
  helper?: string;
  currentUrl?: string;
  uploadKey: UploadKey;
  onChange: (url: string) => void | Promise<void>;
  previewAspect: PreviewAspect;
  /** When set, opens a crop step before upload. */
  cropPreset?: ImageCropPresetKey;
}) {
  const t = useT();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [pendingName, setPendingName] = useState("image.jpg");

  useEffect(() => {
    return () => {
      if (cropSrc?.startsWith("blob:")) URL.revokeObjectURL(cropSrc);
    };
  }, [cropSrc]);

  function closeCrop() {
    if (cropSrc?.startsWith("blob:")) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function onFileChosen(file: File) {
    setErr(null);
    const base = file.name.replace(/\.[^.]+$/, "") || uploadKey;
    setPendingName(`${base}.jpg`);

    if (cropPreset) {
      const url = URL.createObjectURL(file);
      setCropSrc(url);
      return;
    }
    void uploadFile(file);
  }

  async function uploadFile(file: File) {
    if (!user) {
      setErr("You must be signed in to upload.");
      return;
    }
    setUploading(true);
    try {
      const token = await user.getIdToken();
      const url = await uploadLecturerAsset(token, uploadKey, file);
      await onChange(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const preset = cropPreset ? IMAGE_CROP_PRESETS[cropPreset] : null;

  return (
    <>
      <div>
        <div className="text-sm font-medium text-ink-700 mb-1.5">{label}</div>
        <div className="flex items-start gap-4">
          <div
            className={`relative overflow-hidden rounded-xl border border-dashed border-ink-300 bg-ink-50 ${PREVIEW_CLASS[previewAspect]}`}
          >
            {currentUrl ? (
              <Image
                src={currentUrl}
                alt={label}
                fill
                sizes="200px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center text-ink-400">
                <UploadIcon className="h-6 w-6" />
                <span className="mt-1 text-[11px]">{t("onboard.upload.empty")}</span>
              </div>
            )}
          </div>
          <div className="flex-1">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFileChosen(f);
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading || Boolean(cropSrc)}
              className="btn btn-secondary"
            >
              <UploadIcon className="h-4 w-4" />
              {uploading
                ? t("onboard.upload.uploading")
                : currentUrl
                ? t("onboard.upload.replace")
                : t("onboard.upload.select")}
            </button>
            {helper && <p className="mt-2 text-xs text-ink-500">{helper}</p>}
            {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
          </div>
        </div>
      </div>

      {preset && cropSrc && (
        <ImageCropModal
          open
          imageSrc={cropSrc}
          preset={preset}
          fileName={pendingName}
          onClose={closeCrop}
          onConfirm={uploadFile}
        />
      )}
    </>
  );
}
