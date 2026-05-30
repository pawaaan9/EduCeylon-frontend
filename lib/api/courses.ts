import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api/client";
import type { LecturerCourse } from "@/lib/courses/types";

export type CourseAssetKind =
  | "thumbnail"
  | "cover"
  | "lessonVideo"
  | "lessonPdf";

export async function listMyCourses(token: string): Promise<LecturerCourse[]> {
  return apiGet<LecturerCourse[]>("/lecturers/me/courses", { token });
}

export async function getMyCourse(
  token: string,
  id: string,
): Promise<LecturerCourse> {
  return apiGet<LecturerCourse>(`/lecturers/me/courses/${id}`, { token });
}

export async function createMyCourse(
  token: string,
  course: Partial<LecturerCourse>,
): Promise<LecturerCourse> {
  return apiPost<LecturerCourse>("/lecturers/me/courses", {
    token,
    json: { course },
  });
}

export async function updateMyCourse(
  token: string,
  id: string,
  course: Partial<LecturerCourse>,
): Promise<LecturerCourse> {
  return apiPatch<LecturerCourse>(`/lecturers/me/courses/${id}`, {
    token,
    json: { course },
  });
}

export async function deleteMyCourse(token: string, id: string): Promise<void> {
  await apiDelete<{ id: string }>(`/lecturers/me/courses/${id}`, { token });
}

export async function publishMyCourse(
  token: string,
  id: string,
): Promise<LecturerCourse> {
  return apiPost<LecturerCourse>(`/lecturers/me/courses/${id}/publish`, {
    token,
  });
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "/api";

export type UploadProgress = {
  phase: "preparing" | "uploading" | "complete";
  loaded: number;
  total: number;
  percent: number;
};

export type UploadCourseAssetOptions = {
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
};

async function fileToBase64(
  file: File,
  options?: Pick<UploadCourseAssetOptions, "onProgress" | "signal">,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    const onAbort = () => {
      reader.abort();
      reject(new DOMException("Upload cancelled", "AbortError"));
    };

    if (options?.signal?.aborted) {
      onAbort();
      return;
    }
    options?.signal?.addEventListener("abort", onAbort, { once: true });

    reader.onprogress = (event) => {
      if (!event.lengthComputable) return;
      options?.onProgress?.({
        phase: "preparing",
        loaded: event.loaded,
        total: event.total,
        percent: Math.round((event.loaded / event.total) * 20),
      });
    };

    reader.onload = () => {
      options?.signal?.removeEventListener("abort", onAbort);
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

    reader.onerror = () => {
      options?.signal?.removeEventListener("abort", onAbort);
      reject(reader.error ?? new Error("Could not read file"));
    };

    reader.readAsDataURL(file);
  });
}

async function postJsonWithUploadProgress<T>(
  path: string,
  token: string,
  json: unknown,
  options?: Pick<UploadCourseAssetOptions, "onProgress" | "signal">,
): Promise<T> {
  const body = JSON.stringify(json);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}${path}`);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Accept", "application/json");

    const onAbort = () => {
      xhr.abort();
      reject(new DOMException("Upload cancelled", "AbortError"));
    };

    if (options?.signal?.aborted) {
      onAbort();
      return;
    }
    options?.signal?.addEventListener("abort", onAbort, { once: true });

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      options?.onProgress?.({
        phase: "uploading",
        loaded: event.loaded,
        total: event.total,
        percent: Math.round(20 + (event.loaded / event.total) * 80),
      });
    };

    xhr.onload = () => {
      options?.signal?.removeEventListener("abort", onAbort);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const payload = JSON.parse(xhr.responseText) as { data: T };
          resolve(payload.data);
        } catch {
          reject(new Error("Invalid server response"));
        }
        return;
      }

      let message = `Request failed (${xhr.status})`;
      try {
        const errBody = JSON.parse(xhr.responseText) as {
          error?: string;
          detail?: string;
        };
        message = errBody.error ?? errBody.detail ?? message;
      } catch {
        if (xhr.responseText) message = xhr.responseText;
      }
      reject(new Error(`${message} (${API_BASE}${path})`));
    };

    xhr.onerror = () => {
      options?.signal?.removeEventListener("abort", onAbort);
      reject(new Error(`Network error (${API_BASE}${path})`));
    };

    xhr.onabort = () => {
      options?.signal?.removeEventListener("abort", onAbort);
      reject(new DOMException("Upload cancelled", "AbortError"));
    };

    xhr.send(body);
  });
}

export async function uploadCourseAsset(
  token: string,
  id: string,
  kind: CourseAssetKind,
  file: File,
  options?: UploadCourseAssetOptions,
): Promise<string> {
  const dataBase64 = await fileToBase64(file, options);
  const { url } = await postJsonWithUploadProgress<{ url: string }>(
    `/lecturers/me/courses/${id}/assets`,
    token,
    {
      kind,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      dataBase64,
    },
    options,
  );
  return url;
}
