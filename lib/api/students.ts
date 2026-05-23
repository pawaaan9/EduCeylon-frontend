import type { User } from "firebase/auth";
import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import type { StudentProfile } from "@/lib/student/types";

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

export async function fetchMyStudentProfile(
  token: string,
): Promise<StudentProfile | null> {
  return apiGet<StudentProfile | null>("/students/me", { token });
}

export async function fetchMyStudentProfileForUser(
  user: User,
): Promise<StudentProfile | null> {
  const token = await user.getIdToken();
  return fetchMyStudentProfile(token);
}

export async function saveMyStudentProfile(
  token: string,
  patch: Partial<StudentProfile>,
): Promise<StudentProfile> {
  return apiPatch<StudentProfile>("/students/me/profile", {
    token,
    json: { profile: patch },
  });
}

export async function uploadStudentPhoto(
  token: string,
  file: File,
): Promise<string> {
  const dataBase64 = await fileToBase64(file);
  const result = await apiPost<{ url: string }>("/students/me/assets", {
    token,
    json: {
      fileName: file.name,
      contentType: file.type || "image/jpeg",
      dataBase64,
    },
  });
  return result.url;
}
