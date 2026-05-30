import { apiGet } from "@/lib/api/client";
import type { LecturerDashboardData } from "@/lib/lecturer/dashboard";

export type { LecturerDashboardData };

export async function fetchLecturerDashboard(
  token: string,
): Promise<LecturerDashboardData> {
  return apiGet<LecturerDashboardData>("/lecturers/me/dashboard", { token });
}
