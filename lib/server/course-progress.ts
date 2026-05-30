import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import type { CourseModule, CourseQuiz } from "@/lib/courses/types";
import {
  canMarkLessonComplete,
  canMarkModuleComplete,
} from "@/lib/courses/quiz-requirements";
import { listLatestQuizAttempts } from "./quiz-attempts";
import {
  computeProgressPercent,
  countCompletedLessons,
} from "@/lib/courses/progress";
import type { CourseStudyProgress } from "@/lib/data/types";
import { getAdmin } from "./firebase-admin";
import { isStudentEnrolled } from "./enrollments";

export const COURSE_PROGRESS_COLLECTION = "courseProgress";

export type { CourseStudyProgress };

function progressDocId(studentId: string, courseId: string): string {
  return `${studentId}_${courseId}`;
}

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

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
}

function syncModuleCompletion(
  modules: CourseModule[],
  lessonIds: Set<string>,
  moduleIds: Set<string>,
): void {
  for (const mod of modules) {
    if (mod.lessons.length === 0) continue;
    const allDone = mod.lessons.every((l) => lessonIds.has(l.id));
    if (allDone) moduleIds.add(mod.id);
    else moduleIds.delete(mod.id);
  }
}

function emptyProgress(): CourseStudyProgress {
  return { completedLessonIds: [], completedModuleIds: [] };
}

export async function getCourseProgress(
  studentId: string,
  courseId: string,
): Promise<CourseStudyProgress> {
  const { db } = getAdmin();
  const snap = await db
    .collection(COURSE_PROGRESS_COLLECTION)
    .doc(progressDocId(studentId, courseId))
    .get();

  if (!snap.exists) return emptyProgress();

  const data = snap.data() as Record<string, unknown>;
  return {
    completedLessonIds: normalizeStringArray(data.completedLessonIds),
    completedModuleIds: normalizeStringArray(data.completedModuleIds),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

async function saveProgress(
  studentId: string,
  courseId: string,
  progress: CourseStudyProgress,
): Promise<CourseStudyProgress> {
  const { db } = getAdmin();
  const ref = db
    .collection(COURSE_PROGRESS_COLLECTION)
    .doc(progressDocId(studentId, courseId));

  await ref.set(
    {
      studentId,
      courseId,
      completedLessonIds: progress.completedLessonIds,
      completedModuleIds: progress.completedModuleIds,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  const saved = await ref.get();
  const data = saved.data() as Record<string, unknown>;
  return {
    completedLessonIds: normalizeStringArray(data.completedLessonIds),
    completedModuleIds: normalizeStringArray(data.completedModuleIds),
    updatedAt: timestampToIso(data.updatedAt) ?? new Date().toISOString(),
  };
}

async function assertEnrolled(studentId: string, courseId: string) {
  const enrolled = await isStudentEnrolled(studentId, courseId);
  if (!enrolled) {
    throw new Error("Not enrolled in this course");
  }
}

export async function setLessonProgress(
  studentId: string,
  courseId: string,
  lessonId: string,
  completed: boolean,
  modules: CourseModule[],
  finalQuiz?: CourseQuiz,
): Promise<CourseStudyProgress> {
  await assertEnrolled(studentId, courseId);

  const lessonExists = modules.some((m) =>
    m.lessons.some((l) => l.id === lessonId),
  );
  if (!lessonExists) {
    throw new Error("Lesson not found in this course");
  }

  if (completed) {
    const attempts = await listLatestQuizAttempts(studentId, courseId);
    if (!canMarkLessonComplete(modules, finalQuiz, lessonId, attempts)) {
      throw new Error(
        "Complete all quizzes for this lesson before marking it done",
      );
    }
  }

  const current = await getCourseProgress(studentId, courseId);
  const lessonIds = new Set(current.completedLessonIds);
  const moduleIds = new Set(current.completedModuleIds);

  if (completed) lessonIds.add(lessonId);
  else lessonIds.delete(lessonId);

  syncModuleCompletion(modules, lessonIds, moduleIds);

  const saved = await saveProgress(studentId, courseId, {
    completedLessonIds: [...lessonIds],
    completedModuleIds: [...moduleIds],
  });

  return saved;
}

export async function setModuleProgress(
  studentId: string,
  courseId: string,
  moduleId: string,
  completed: boolean,
  modules: CourseModule[],
  finalQuiz?: CourseQuiz,
): Promise<CourseStudyProgress> {
  await assertEnrolled(studentId, courseId);

  const mod = modules.find((m) => m.id === moduleId);
  if (!mod) {
    throw new Error("Module not found in this course");
  }

  if (completed) {
    const attempts = await listLatestQuizAttempts(studentId, courseId);
    if (!canMarkModuleComplete(modules, finalQuiz, moduleId, attempts)) {
      throw new Error(
        "Complete all quizzes in this module before marking it done",
      );
    }
  }

  const current = await getCourseProgress(studentId, courseId);
  const lessonIds = new Set(current.completedLessonIds);
  const moduleIds = new Set(current.completedModuleIds);

  if (completed) {
    moduleIds.add(moduleId);
    for (const lesson of mod.lessons) {
      lessonIds.add(lesson.id);
    }
  } else {
    moduleIds.delete(moduleId);
    for (const lesson of mod.lessons) {
      lessonIds.delete(lesson.id);
    }
  }

  return saveProgress(studentId, courseId, {
    completedLessonIds: [...lessonIds],
    completedModuleIds: [...moduleIds],
  });
}

export function countCompletedLessonsInModules(
  modules: CourseModule[],
  completedLessonIds: string[],
): { completed: number; total: number } {
  const done = new Set(completedLessonIds);
  let total = 0;
  let completed = 0;
  for (const mod of modules) {
    total += mod.lessons.length;
    completed += mod.lessons.filter((l) => done.has(l.id)).length;
  }
  return { completed, total };
}

export function enrichCourseProgress(
  totalLessons: number,
  progress: CourseStudyProgress,
): CourseStudyProgress {
  const completedLessons = countCompletedLessons(
    totalLessons,
    progress.completedLessonIds,
  );
  return {
    ...progress,
    totalLessons,
    completedLessons,
    percent: computeProgressPercent(totalLessons, progress.completedLessonIds),
  };
}

export async function listStudentCourseProgressMap(
  studentId: string,
): Promise<Map<string, CourseStudyProgress>> {
  const { db } = getAdmin();
  const snap = await db
    .collection(COURSE_PROGRESS_COLLECTION)
    .where("studentId", "==", studentId)
    .get();

  const map = new Map<string, CourseStudyProgress>();
  for (const doc of snap.docs) {
    const data = doc.data() as Record<string, unknown>;
    const courseId =
      typeof data.courseId === "string" ? data.courseId : "";
    if (!courseId) continue;
    map.set(courseId, {
      completedLessonIds: normalizeStringArray(data.completedLessonIds),
      completedModuleIds: normalizeStringArray(data.completedModuleIds),
      updatedAt: timestampToIso(data.updatedAt),
    });
  }
  return map;
}
