import "server-only";

import type { CourseModule, LecturerCourse } from "@/lib/courses/types";
import { isPublishedVisibility } from "@/lib/courses/types";
import { countCompletedLessons } from "@/lib/courses/progress";
import type {
  StudentProgressCourseRow,
  StudentProgressData,
  StudentProgressQuizResult,
} from "@/lib/student/progress-page";
import {
  enrichCourseProgress,
  listStudentCourseProgressMap,
} from "./course-progress";
import { getAdmin } from "./firebase-admin";
import { ENROLLMENTS_COLLECTION } from "./enrollments";
import { normalizeCourse, LECTURER_COURSES } from "./courses";
import { approvedLecturerMap } from "./approved-lecturers";
import { lecturerCourseToPublic } from "./public-courses";
import {
  listLatestQuizAttemptRows,
  type QuizAttemptRow,
  type QuizScope,
} from "./quiz-attempts";

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

type QuizMeta = {
  title: string;
  scope: QuizScope;
  scopeLabel: string;
};

function indexCourseQuizzes(course: LecturerCourse): Map<string, QuizMeta> {
  const map = new Map<string, QuizMeta>();

  for (const mod of course.modules) {
    for (const lesson of mod.lessons) {
      if ((lesson.quiz?.questions.length ?? 0) > 0 && lesson.quiz) {
        map.set(lesson.quiz.id, {
          title:
            lesson.quiz.title?.trim() ||
            lesson.title.trim() ||
            "Lesson quiz",
          scope: "lesson",
          scopeLabel: lesson.title.trim() || "Lesson",
        });
      }
    }
    if ((mod.quiz?.questions.length ?? 0) > 0 && mod.quiz) {
      map.set(mod.quiz.id, {
        title: mod.quiz.title?.trim() || mod.title.trim() || "Module quiz",
        scope: "module",
        scopeLabel: mod.title.trim() || "Module",
      });
    }
  }

  if ((course.finalQuiz?.questions.length ?? 0) > 0 && course.finalQuiz) {
    map.set(course.finalQuiz.id, {
      title: course.finalQuiz.title?.trim() || "Final course quiz",
      scope: "course",
      scopeLabel: "Final assessment",
    });
  }

  return map;
}

function mapQuizResults(
  course: LecturerCourse,
  attempts: QuizAttemptRow[],
): StudentProgressQuizResult[] {
  const quizIndex = indexCourseQuizzes(course);
  const courseAttempts = attempts.filter((a) => a.courseId === course.id);

  return courseAttempts
    .map((attempt) => {
      const meta = quizIndex.get(attempt.quizId);
      return {
        quizId: attempt.quizId,
        title: meta?.title ?? "Quiz",
        scope: attempt.scope,
        scopeLabel: meta?.scopeLabel ?? attempt.scope,
        scorePercent: attempt.scorePercent,
        passed: attempt.passed,
        correctCount: attempt.correctCount,
        totalQuestions: attempt.totalQuestions,
        submittedAt: attempt.submittedAt,
      };
    })
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export async function getStudentProgress(
  studentId: string,
): Promise<StudentProgressData> {
  const { db } = getAdmin();
  const [enrollmentSnap, progressMap, quizAttempts, lecturers] =
    await Promise.all([
      db
        .collection(ENROLLMENTS_COLLECTION)
        .where("studentId", "==", studentId)
        .get(),
      listStudentCourseProgressMap(studentId),
      listLatestQuizAttemptRows(studentId),
      approvedLecturerMap(),
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

  const activityDays = new Set<string>();
  let lessonsCompleted = 0;
  let completedCourses = 0;
  let hoursThisWeek = 0;
  const weekStart = startOfDay(new Date());
  weekStart.setDate(weekStart.getDate() - 6);

  for (const attempt of quizAttempts) {
    activityDays.add(dayKey(new Date(attempt.submittedAt)));
    if (new Date(attempt.submittedAt) >= weekStart) {
      hoursThisWeek += 0.25;
    }
  }

  const courses: StudentProgressCourseRow[] = [];

  for (const row of enrolledRows) {
    const raw = await getPublishedCourse(row.courseId);
    if (!raw) continue;

    const totalLessons = countLessons(raw.modules);
    const progress = progressMap.get(raw.id);
    const completedLessonIds = progress?.completedLessonIds ?? [];
    const completedLessonCount = countCompletedLessons(
      totalLessons,
      completedLessonIds,
    );

    if (progress?.updatedAt) {
      activityDays.add(dayKey(new Date(progress.updatedAt)));
    }

    lessonsCompleted += completedLessonCount;

    const progressPercent = progress
      ? (enrichCourseProgress(totalLessons, progress).percent ?? 0)
      : 0;
    const completed = progressPercent >= 100;
    if (completed) completedCourses++;

    const lecturer = lecturers.get(raw.lecturerId) ?? null;
    const publicCourse = lecturerCourseToPublic(raw, lecturer);

    courses.push({
      id: raw.id,
      slug: publicCourse.slug,
      title: raw.title.trim() || "Course",
      lecturerName: lecturer?.name?.trim() || "Lecturer",
      thumbnailGradient: publicCourse.thumbnailGradient,
      thumbnailURL: raw.thumbnailURL,
      progressPercent,
      completedLessons: completedLessonCount,
      totalLessons,
      hoursWatched: estimateHoursWatched(raw.modules, completedLessonIds),
      completed,
      enrolledAt: row.enrolledAt,
      quizzes: mapQuizResults(raw, quizAttempts),
    });
  }

  const quizScores = quizAttempts.map((a) => a.scorePercent);
  const averageQuizScore =
    quizScores.length > 0
      ? Math.round(
          quizScores.reduce((sum, score) => sum + score, 0) / quizScores.length,
        )
      : null;

  hoursThisWeek = Math.round(hoursThisWeek);

  return {
    stats: {
      hoursThisWeek,
      lessonsCompleted,
      streakDays: computeStreak(activityDays),
      averageQuizScore,
      completedCourses,
      enrolledCount: courses.length,
    },
    courses,
  };
}
