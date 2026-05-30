import { apiGet } from "@/lib/api/client";
import type { StudentProgressData } from "@/lib/student/progress-page";

export type { StudentProgressData };

export async function fetchStudentProgress(
  token: string,
): Promise<StudentProgressData> {
  return apiGet<StudentProgressData>("/students/me/progress", { token });
}
