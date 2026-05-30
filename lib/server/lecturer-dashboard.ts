import "server-only";

import type { CourseModule, LecturerCourse } from "@/lib/courses/types";
import type {
  LecturerDashboardCourseRow,
  LecturerDashboardData,
  LecturerDashboardTopStudent,
} from "@/lib/lecturer/dashboard";
import { COURSE_PROGRESS_COLLECTION } from "./course-progress";
import { ENROLLMENTS_COLLECTION } from "./enrollments";
import { listCoursesByLecturer } from "./courses";
import { getAdmin } from "./firebase-admin";
import { getStudentProfileByUid } from "./student-profile";

function timestampToIso(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    const ts = value as { toDate?: () => Date; seconds?: number };
    if (typeof ts.toDate === "function") return ts.toDate().toISOString();
    if (typeof ts.seconds === "number") {
      return new Date(ts.seconds * 1000).toISOString();
    }
  }
  return undefined;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function effectiveCoursePrice(course: LecturerCourse): number {
  if (course.accessType !== "paid") return 0;
  if (course.discountPrice != null && course.discountPrice > 0) {
    return course.discountPrice;
  }
  return course.price ?? 0;
}

function countLessons(modules: CourseModule[]): number {
  return modules.reduce((n, mod) => n + mod.lessons.length, 0);
}

function estimateHoursWatched(
  modules: CourseModule[],
  completedLessonIds: readonly string[],
): number {
  const done = new Set(completedLessonIds);
  let minutes = 0;
  for (const mod of modules) {
    for (const lesson of mod.lessons) {
      if (done.has(lesson.id)) {
        minutes += lesson.durationMinutes ?? 15;
      }
    }
  }
  return Math.round(minutes / 60);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayKey(date: Date): string {
  return startOfDay(date).toISOString().slice(0, 10);
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current > 0 ? 100 : null;
  }
  return Math.round(((current - previous) / previous) * 100);
}

type EnrollmentRow = {
  studentId: string;
  courseId: string;
  enrolledAt: string;
  revenue: number;
};

async function listEnrollmentsForCourses(
  courseMap: Map<string, LecturerCourse>,
): Promise<EnrollmentRow[]> {
  const courseIds = [...courseMap.keys()];
  if (courseIds.length === 0) return [];

  const { db } = getAdmin();
  const rows: EnrollmentRow[] = [];

  for (const batch of chunk(courseIds, 10)) {
    const snap = await db
      .collection(ENROLLMENTS_COLLECTION)
      .where("courseId", "in", batch)
      .get();

    for (const doc of snap.docs) {
      const data = doc.data() as Record<string, unknown>;
      const courseId = data.courseId as string;
      const studentId = data.studentId as string;
      const course = courseMap.get(courseId);
      if (!course || !studentId) continue;

      rows.push({
        studentId,
        courseId,
        enrolledAt:
          timestampToIso(data.enrolledAt) ?? new Date(0).toISOString(),
        revenue: effectiveCoursePrice(course),
      });
    }
  }

  return rows;
}

type ProgressRow = {
  studentId: string;
  courseId: string;
  completedLessonIds: string[];
};

async function listProgressForCourses(
  courseIds: string[],
): Promise<ProgressRow[]> {
  if (courseIds.length === 0) return [];

  const { db } = getAdmin();
  const rows: ProgressRow[] = [];

  for (const batch of chunk(courseIds, 10)) {
    const snap = await db
      .collection(COURSE_PROGRESS_COLLECTION)
      .where("courseId", "in", batch)
      .get();

    for (const doc of snap.docs) {
      const data = doc.data() as Record<string, unknown>;
      const courseId =
        typeof data.courseId === "string" ? data.courseId : "";
      const studentId =
        typeof data.studentId === "string" ? data.studentId : "";
      if (!courseId || !studentId) continue;

      const completedLessonIds = Array.isArray(data.completedLessonIds)
        ? data.completedLessonIds.filter(
            (v): v is string => typeof v === "string" && v.length > 0,
          )
        : [];

      rows.push({ studentId, courseId, completedLessonIds });
    }
  }

  return rows;
}

function emptyDashboard(courses: LecturerCourse[]): LecturerDashboardData {
  const today = startOfDay(new Date());
  const revenueLast7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return { date: dayKey(d), amount: 0 };
  });

  return {
    totalStudents: 0,
    studentsThisMonth: 0,
    activeCourses: courses.filter((c) => c.status === "published").length,
    totalRevenue: 0,
    revenueMoMPercent: null,
    averageRating: null,
    reviewCount: 0,
    revenueLast7Days,
    revenueWeekChangePercent: null,
    topStudents: [],
    courses: courses.map((course) => ({
      id: course.id,
      title: course.title,
      status: course.status,
      lessonCount: countLessons(course.modules),
      thumbnailURL: course.thumbnailURL,
      students: 0,
      rating:
        course.reviewCount && course.reviewCount > 0 && course.ratingSum != null
          ? course.ratingSum / course.reviewCount
          : null,
      reviewCount: course.reviewCount ?? 0,
      revenue: 0,
    })),
  };
}

export async function getLecturerDashboard(
  lecturerId: string,
): Promise<LecturerDashboardData> {
  const courses = await listCoursesByLecturer(lecturerId);
  if (courses.length === 0) {
    return emptyDashboard([]);
  }

  const courseMap = new Map(courses.map((c) => [c.id, c]));
  const courseIds = courses.map((c) => c.id);

  const [enrollments, progressRows] = await Promise.all([
    listEnrollmentsForCourses(courseMap),
    listProgressForCourses(courseIds),
  ]);

  const studentsByCourse = new Map<string, number>();
  const revenueByCourse = new Map<string, number>();
  const uniqueStudents = new Set<string>();

  const now = new Date();
  const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const studentsThisMonth = new Set<string>();
  let revenueThisMonth = 0;
  let revenueLastMonth = 0;

  const today = startOfDay(now);
  const dailyRevenue = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dailyRevenue.set(dayKey(d), 0);
  }

  for (const row of enrollments) {
    uniqueStudents.add(row.studentId);
    studentsByCourse.set(row.courseId, (studentsByCourse.get(row.courseId) ?? 0) + 1);
    revenueByCourse.set(
      row.courseId,
      (revenueByCourse.get(row.courseId) ?? 0) + row.revenue,
    );

    const enrolledAt = new Date(row.enrolledAt);
    if (enrolledAt >= startThisMonth) {
      studentsThisMonth.add(row.studentId);
      revenueThisMonth += row.revenue;
    } else if (enrolledAt >= startLastMonth && enrolledAt < startThisMonth) {
      revenueLastMonth += row.revenue;
    }

    const key = dayKey(enrolledAt);
    if (dailyRevenue.has(key)) {
      dailyRevenue.set(key, (dailyRevenue.get(key) ?? 0) + row.revenue);
    }
  }

  let totalReviewCount = 0;
  let totalRatingSum = 0;
  for (const course of courses) {
    totalReviewCount += course.reviewCount ?? 0;
    totalRatingSum += course.ratingSum ?? 0;
  }

  const studentActivity = new Map<
    string,
    { hoursWatched: number; lessonsCompleted: number }
  >();

  for (const row of progressRows) {
    const course = courseMap.get(row.courseId);
    if (!course) continue;

    const hours = estimateHoursWatched(course.modules, row.completedLessonIds);
    const lessons = row.completedLessonIds.length;
    const current = studentActivity.get(row.studentId) ?? {
      hoursWatched: 0,
      lessonsCompleted: 0,
    };
    studentActivity.set(row.studentId, {
      hoursWatched: current.hoursWatched + hours,
      lessonsCompleted: current.lessonsCompleted + lessons,
    });
  }

  const rankedStudents = [...studentActivity.entries()]
    .sort((a, b) => {
      if (b[1].lessonsCompleted !== a[1].lessonsCompleted) {
        return b[1].lessonsCompleted - a[1].lessonsCompleted;
      }
      return b[1].hoursWatched - a[1].hoursWatched;
    })
    .slice(0, 5);

  const topStudents: LecturerDashboardTopStudent[] = [];
  for (const [studentId, stats] of rankedStudents) {
    const profile = await getStudentProfileByUid(studentId);
    topStudents.push({
      studentId,
      name: profile?.name?.trim() || profile?.email || "Student",
      hoursWatched: stats.hoursWatched,
      lessonsCompleted: stats.lessonsCompleted,
    });
  }

  const revenueLast7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    const key = dayKey(d);
    return { date: key, amount: dailyRevenue.get(key) ?? 0 };
  });

  const last7Total = revenueLast7Days.reduce((sum, d) => sum + d.amount, 0);
  let prev7Total = 0;
  for (let i = 7; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    prev7Total += dailyRevenue.get(dayKey(d)) ?? 0;
  }

  const courseRows: LecturerDashboardCourseRow[] = courses.map((course) => {
    const reviewCount = course.reviewCount ?? 0;
    return {
      id: course.id,
      title: course.title,
      status: course.status,
      lessonCount: countLessons(course.modules),
      thumbnailURL: course.thumbnailURL,
      students: studentsByCourse.get(course.id) ?? 0,
      rating:
        reviewCount > 0 && course.ratingSum != null
          ? course.ratingSum / reviewCount
          : null,
      reviewCount,
      revenue: revenueByCourse.get(course.id) ?? 0,
    };
  });

  const totalRevenue = [...revenueByCourse.values()].reduce(
    (sum, value) => sum + value,
    0,
  );

  return {
    totalStudents: uniqueStudents.size,
    studentsThisMonth: studentsThisMonth.size,
    activeCourses: courses.filter((c) => c.status === "published").length,
    totalRevenue,
    revenueMoMPercent: percentChange(revenueThisMonth, revenueLastMonth),
    averageRating:
      totalReviewCount > 0 ? totalRatingSum / totalReviewCount : null,
    reviewCount: totalReviewCount,
    revenueLast7Days,
    revenueWeekChangePercent: percentChange(last7Total, prev7Total),
    topStudents,
    courses: courseRows,
  };
}
