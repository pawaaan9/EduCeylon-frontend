import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import type {
  LecturerProfile,
  LecturerProfileResponse,
  OnboardingMeta,
  UploadKey,
} from "@/lib/api/types";

export type QualificationSuggestions = {
  titles: string[];
  institutes: string[];
};

export async function fetchQualificationSuggestions(): Promise<QualificationSuggestions> {
  return apiGet<QualificationSuggestions>(
    "/lecturers/qualification-suggestions",
  );
}

export async function fetchMyLecturerProfile(
  token: string,
): Promise<LecturerProfileResponse | null> {
  return apiGet<LecturerProfileResponse | null>("/lecturers/me", { token });
}

export async function saveMyLecturerProfile(
  token: string,
  patch: Partial<LecturerProfile>,
): Promise<LecturerProfileResponse> {
  return apiPatch<LecturerProfileResponse>("/lecturers/me/profile", {
    token,
    json: { profile: patch },
  });
}

export async function evaluateMyLecturerProfile(
  token: string,
  profile: Partial<LecturerProfile>,
): Promise<LecturerProfileResponse> {
  return apiPost<LecturerProfileResponse>("/lecturers/me/profile/evaluate", {
    token,
    json: { profile },
  });
}

export async function submitMyLecturerProfile(
  token: string,
): Promise<LecturerProfileResponse> {
  return apiPost<LecturerProfileResponse>("/lecturers/me/profile/submit", {
    token,
  });
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read file"));
        return;
      }
      const base64 = result.split(",")[1];
      if (!base64) {
        reject(new Error("Could not encode file"));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export async function uploadLecturerAsset(
  token: string,
  key: UploadKey,
  file: File,
): Promise<string> {
  const dataBase64 = await fileToBase64(file);
  const { url } = await apiPost<{ url: string }>("/lecturers/me/assets", {
    token,
    json: {
      key,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      dataBase64,
    },
  });
  return url;
}

export type { LecturerProfile, OnboardingMeta, UploadKey };
