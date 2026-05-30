import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import type {
  Course,
  CourseStudyProgress,
  StudyCourseWithProgress,
} from "@/lib/data/types";

export type EnrollmentRecord = {
  id: string;
  studentId: string;
  courseId: string;
  enrolledAt: string;
};

export async function fetchMyEnrolledCourses(token: string): Promise<Course[]> {
  return apiGet<Course[]>("/students/me/enrollments", { token });
}

export async function enrollInCourse(
  token: string,
  courseId: string,
): Promise<EnrollmentRecord> {
  return apiPost<EnrollmentRecord>("/students/me/enrollments", {
    token,
    json: { courseId },
  });
}

export async function checkMyEnrollment(
  token: string,
  courseId: string,
): Promise<boolean> {
  const { enrolled } = await apiGet<{ enrolled: boolean }>(
    `/students/me/enrollments/check?courseId=${encodeURIComponent(courseId)}`,
    { token },
  );
  return enrolled;
}

export async function fetchStudyCourse(
  token: string,
  slug: string,
): Promise<StudyCourseWithProgress> {
  return apiGet<StudyCourseWithProgress>(
    `/students/me/courses/${encodeURIComponent(slug)}`,
    { token },
  );
}

export async function updateStudyProgress(
  token: string,
  slug: string,
  payload:
    | { lessonId: string; completed: boolean }
    | { moduleId: string; completed: boolean },
): Promise<CourseStudyProgress> {
  return apiPatch<CourseStudyProgress>(
    `/students/me/courses/${encodeURIComponent(slug)}/progress`,
    { token, json: payload },
  );
}
