import "server-only";

import type { CourseModule, LecturerCourse } from "@/lib/courses/types";
import { isPublishedVisibility } from "@/lib/courses/types";
import { listUpcomingLiveSessions } from "@/lib/courses/live-sessions";
import type { Course, LiveSession } from "@/lib/data/types";
import type { StudentDashboardData } from "@/lib/student/dashboard";
import {
  enrichCourseProgress,
  listStudentCourseProgressMap,
} from "./course-progress";
import { getAdmin } from "./firebase-admin";
import { ENROLLMENTS_COLLECTION } from "./enrollments";
import { normalizeCourse, LECTURER_COURSES } from "./courses";
import { approvedLecturerMap } from "./approved-lecturers";
import {
  lecturerCourseToPublic,
  listPublishedCoursesRaw,
} from "./public-courses";
import { QUIZ_ATTEMPTS_COLLECTION } from "./quiz-attempts";

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

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayKey(date: Date): string {
  return startOfDay(date).toISOString().slice(0, 10);
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

function computeStreak(activityDays: Set<string>): number {
  if (activityDays.size === 0) return 0;

  const today = startOfDay(new Date());
  const cursor = new Date(today);

  if (!activityDays.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (activityDays.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function localizedTitle(title: string) {
  const text = title.trim() || "Course";
  return { en: text, si: text, ta: text };
}

async function getPublishedCourse(
  courseId: string,
): Promise<LecturerCourse | null> {
  const { db } = getAdmin();
  const snap = await db.collection(LECTURER_COURSES).doc(courseId).get();
  if (!snap.exists) return null;
  const course = normalizeCourse(snap.id, snap.data() as Record<string, unknown>);
  if (course.status !== "published" || !isPublishedVisibility(course.visibility)) {
    return null;
  }
  if (!course.title.trim()) return null;
  return course;
}

async function listStudentQuizAttemptDays(
  studentId: string,
): Promise<Set<string>> {
  const { db } = getAdmin();
  const snap = await db
    .collection(QUIZ_ATTEMPTS_COLLECTION)
    .where("studentId", "==", studentId)
    .get();

  const days = new Set<string>();
  for (const doc of snap.docs) {
    const data = doc.data() as Record<string, unknown>;
    const submittedAt = timestampToIso(data.submittedAt);
    if (submittedAt) {
      days.add(dayKey(new Date(submittedAt)));
    }
  }
  return days;
}

async function countQuizAttemptsThisWeek(
  studentId: string,
  weekStart: Date,
): Promise<number> {
  const { db } = getAdmin();
  const snap = await db
    .collection(QUIZ_ATTEMPTS_COLLECTION)
    .where("studentId", "==", studentId)
    .get();

  let count = 0;
  for (const doc of snap.docs) {
    const data = doc.data() as Record<string, unknown>;
    const submittedAt = timestampToIso(data.submittedAt);
    if (!submittedAt) continue;
    if (new Date(submittedAt) >= weekStart) count++;
  }
  return count;
}

function pickContinueLearning(courses: Course[]): Course[] {
  const incomplete = courses.filter((c) => (c.progressPercent ?? 0) < 100);
  const sorted = [...incomplete].sort((a, b) => {
    const pa = a.progressPercent ?? 0;
    const pb = b.progressPercent ?? 0;
    if (pa !== pb) return pb - pa;
    return a.title.en.localeCompare(b.title.en);
  });
  return sorted.slice(0, 3);
}

function pickRecommended(
  published: Course[],
  enrolledIds: Set<string>,
): Course[] {
  return published
    .filter((c) => !enrolledIds.has(c.id))
    .sort((a, b) => {
      const scoreA = a.rating * Math.log10(a.reviews + 1);
      const scoreB = b.rating * Math.log10(b.reviews + 1);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.students - a.students;
    })
    .slice(0, 3);
}

function toLiveSessions(
  rows: ReturnType<typeof listUpcomingLiveSessions>,
): LiveSession[] {
  return rows.map((row) => ({
    id: row.id,
    courseId: row.courseId,
    courseTitle: localizedTitle(row.courseTitle),
    lecturerName: row.lecturerName,
    startsAt: row.startsAt,
    durationMin: row.durationMin,
  }));
}

export async function getStudentDashboard(
  studentId: string,
): Promise<StudentDashboardData> {
  const { db } = getAdmin();
  const [enrollmentSnap, progressMap, quizActivityDays, lecturers, publishedRaw] =
    await Promise.all([
      db
        .collection(ENROLLMENTS_COLLECTION)
        .where("studentId", "==", studentId)
        .get(),
      listStudentCourseProgressMap(studentId),
      listStudentQuizAttemptDays(studentId),
      approvedLecturerMap(),
      listPublishedCoursesRaw(),
    ]);

  const enrolledRows = enrollmentSnap.docs
    .map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        courseId: data.courseId as string,
        enrolledAt: timestampToIso(data.enrolledAt) ?? "",
      };
    })
    .sort((a, b) => b.enrolledAt.localeCompare(a.enrolledAt));

  const enrolledIds = new Set<string>();
  const enrolledCourses: Course[] = [];
  const rawById = new Map<string, LecturerCourse>();

  let hoursLearned = 0;
  let completedCourses = 0;
  const activityDays = new Set(quizActivityDays);

  for (const row of enrolledRows) {
    const raw = await getPublishedCourse(row.courseId);
    if (!raw) continue;

    enrolledIds.add(raw.id);
    rawById.set(raw.id, raw);

    const course = lecturerCourseToPublic(
      raw,
      lecturers.get(raw.lecturerId) ?? null,
    );
    const progress = progressMap.get(raw.id);
    const totalLessons = course.lessons;

    if (progress) {
      if (progress.updatedAt) {
        activityDays.add(dayKey(new Date(progress.updatedAt)));
      }
      course.progressPercent = enrichCourseProgress(totalLessons, progress).percent;
      hoursLearned += estimateHoursWatched(raw.modules, progress.completedLessonIds);
      if ((course.progressPercent ?? 0) >= 100) {
        completedCourses++;
      }
    } else {
      course.progressPercent = 0;
    }

    enrolledCourses.push(course);
  }

  const now = new Date();
  const weekStart = startOfDay(now);
  weekStart.setDate(weekStart.getDate() - 6);

  const quizAttemptsThisWeek = await countQuizAttemptsThisWeek(
    studentId,
    weekStart,
  );
  const hoursThisWeek = Math.round(quizAttemptsThisWeek * 0.25);

  const liveCourseInputs = [...rawById.values()].map((raw) => ({
    id: raw.id,
    title: raw.title,
    courseType: raw.courseType,
    weeklySchedule: raw.weeklySchedule,
    lecturerName: lecturers.get(raw.lecturerId)?.name?.trim() || "Lecturer",
  }));

  const upcomingLive = toLiveSessions(
    listUpcomingLiveSessions(liveCourseInputs, 5),
  );

  const published = publishedRaw.map((raw) =>
    lecturerCourseToPublic(raw, lecturers.get(raw.lecturerId) ?? null),
  );

  return {
    stats: {
      enrolledCount: enrolledCourses.length,
      hoursLearned,
      hoursThisWeek,
      completedCourses,
      streakDays: computeStreak(activityDays),
    },
    continueLearning: pickContinueLearning(enrolledCourses),
    upcomingLive,
    recommended: pickRecommended(published, enrolledIds),
  };
}
