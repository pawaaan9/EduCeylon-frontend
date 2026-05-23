"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ImageCropModal } from "@/components/ImageCropModal";
import { CloseIcon, UploadIcon } from "@/components/icons";
import { uploadStudentPhoto } from "@/lib/api/students";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { IMAGE_CROP_PRESETS } from "@/lib/image/crop-presets";
import { useT } from "@/lib/i18n/I18nProvider";

export function StudentPhotoUpload({
  currentUrl,
  onChange,
}: {
  currentUrl?: string;
  onChange: (url: string | undefined) => void | Promise<void>;
}) {
  const t = useT();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [pendingName, setPendingName] = useState("photo.jpg");
  const preset = IMAGE_CROP_PRESETS.profile;

  useEffect(() => {
    return () => {
      if (cropSrc?.startsWith("blob:") && cropSrc !== currentUrl) {
        URL.revokeObjectURL(cropSrc);
      }
    };
  }, [cropSrc, currentUrl]);

  function closeCrop() {
    if (cropSrc?.startsWith("blob:") && cropSrc !== currentUrl) {
      URL.revokeObjectURL(cropSrc);
    }
    setCropSrc(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function uploadFile(file: File) {
    if (!user) {
      setErr("You must be signed in.");
      return;
    }
    setUploading(true);
    setErr(null);
    try {
      const token = await user.getIdToken();
      const url = await uploadStudentPhoto(token, file);
      if (currentUrl?.startsWith("blob:")) URL.revokeObjectURL(currentUrl);
      await onChange(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onFileChosen(file: File) {
    setErr(null);
    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    setPendingName(`${base}.jpg`);
    setCropSrc(URL.createObjectURL(file));
  }

  function handleRemove() {
    if (currentUrl?.startsWith("blob:")) URL.revokeObjectURL(currentUrl);
    void onChange(undefined);
    setErr(null);
  }

  return (
    <>
      <div>
        <div className="text-sm font-medium text-ink-700 mb-2">
          {t("student.settings.photo")}
        </div>
        <div
          className={`relative h-32 w-32 overflow-hidden rounded-2xl border-2 border-dashed border-ink-300 bg-ink-50 ${
            uploading ? "opacity-60" : "hover:border-brand-400"
          }`}
        >
          {currentUrl ? (
            <>
              <Image
                src={currentUrl}
                alt={t("student.settings.photo")}
                fill
                sizes="128px"
                className="object-cover"
                unoptimized
              />
              <button
                type="button"
                onClick={handleRemove}
                disabled={uploading || Boolean(cropSrc)}
                className="absolute top-2 right-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white shadow-sm hover:bg-black/80 disabled:opacity-50"
                aria-label={t("onboard.upload.remove")}
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading || Boolean(cropSrc)}
              className="absolute inset-0 flex flex-col items-center justify-center text-ink-500 hover:text-brand-700 transition-colors"
            >
              <UploadIcon className="h-7 w-7" />
              <span className="mt-1.5 text-xs font-medium">
                {uploading ? t("onboard.upload.uploading") : t("student.settings.uploadPhoto")}
              </span>
            </button>
          )}
        </div>
        {currentUrl && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading || Boolean(cropSrc)}
            className="btn btn-secondary btn-sm h-9 text-xs mt-3"
          >
            <UploadIcon className="h-4 w-4" />
            {uploading ? t("onboard.upload.uploading") : t("onboard.upload.replace")}
          </button>
        )}
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
        {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
      </div>

      {cropSrc && (
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
