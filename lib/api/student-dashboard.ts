import { apiGet } from "@/lib/api/client";
import type { StudentDashboardData } from "@/lib/student/dashboard";

export type { StudentDashboardData };

export async function fetchStudentDashboard(
  token: string,
): Promise<StudentDashboardData> {
  return apiGet<StudentDashboardData>("/students/me/dashboard", { token });
}
