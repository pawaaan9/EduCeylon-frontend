import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import type { Course } from "@/lib/data/types";
import { isPublishedVisibility } from "@/lib/courses/types";
import {
  LECTURER_COURSES,
  normalizeCourse,
} from "./courses";
import { getAdmin } from "./firebase-admin";
import { approvedLecturerMap } from "./approved-lecturers";
import {
  enrichCourseProgress,
  listStudentCourseProgressMap,
} from "./course-progress";
import { lecturerCourseToPublic } from "./public-courses";

export const ENROLLMENTS_COLLECTION = "enrollments";

export type Enrollment = {
  id: string;
  studentId: string;
  courseId: string;
  enrolledAt: string;
};

function enrollmentDocId(studentId: string, courseId: string): string {
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

async function getPublishedCourse(courseId: string) {
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

export async function countEnrollmentsForCourse(courseId: string): Promise<number> {
  const { db } = getAdmin();
  const snap = await db
    .collection(ENROLLMENTS_COLLECTION)
    .where("courseId", "==", courseId)
    .get();
  return snap.size;
}

export async function isStudentEnrolled(
  studentId: string,
  courseId: string,
): Promise<boolean> {
  const { db } = getAdmin();
  const snap = await db
    .collection(ENROLLMENTS_COLLECTION)
    .doc(enrollmentDocId(studentId, courseId))
    .get();
  return snap.exists;
}

export async function enrollStudent(
  studentId: string,
  courseId: string,
): Promise<Enrollment> {
  const course = await getPublishedCourse(courseId);
  if (!course) {
    throw new Error("Course not found or not available for enrollment");
  }

  const { db } = getAdmin();
  const ref = db
    .collection(ENROLLMENTS_COLLECTION)
    .doc(enrollmentDocId(studentId, courseId));
  const existing = await ref.get();
  if (existing.exists) {
    const data = existing.data() as Record<string, unknown>;
    return {
      id: existing.id,
      studentId,
      courseId,
      enrolledAt: timestampToIso(data.enrolledAt) ?? new Date().toISOString(),
    };
  }

  if (
    course.courseType === "live" &&
    course.enrollmentSlots != null &&
    course.enrollmentSlots > 0
  ) {
    const count = await countEnrollmentsForCourse(courseId);
    if (count >= course.enrollmentSlots) {
      throw new Error("This live class is full — no enrollment slots left");
    }
  }

  const now = FieldValue.serverTimestamp();
  await ref.set({
    studentId,
    courseId,
    enrolledAt: now,
  });

  const created = await ref.get();
  const data = created.data() as Record<string, unknown>;
  return {
    id: created.id,
    studentId,
    courseId,
    enrolledAt: timestampToIso(data.enrolledAt) ?? new Date().toISOString(),
  };
}

export async function listEnrolledPublicCourses(
  studentId: string,
): Promise<Course[]> {
  const { db } = getAdmin();
  const snap = await db
    .collection(ENROLLMENTS_COLLECTION)
    .where("studentId", "==", studentId)
    .get();

  if (snap.empty) return [];

  const rows = snap.docs
    .map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        courseId: data.courseId as string,
        enrolledAt: timestampToIso(data.enrolledAt) ?? "",
      };
    })
    .sort((a, b) => b.enrolledAt.localeCompare(a.enrolledAt));

  const lecturers = await approvedLecturerMap();
  const progressMap = await listStudentCourseProgressMap(studentId);
  const courses: Course[] = [];

  for (const row of rows) {
    const raw = await getPublishedCourse(row.courseId);
    if (!raw) continue;
    const course = lecturerCourseToPublic(raw, lecturers.get(raw.lecturerId) ?? null);
    const progress = progressMap.get(raw.id);
    if (progress) {
      course.progressPercent = enrichCourseProgress(
        course.lessons,
        progress,
      ).percent;
    } else {
      course.progressPercent = 0;
    }
    courses.push(course);
  }

  return courses;
}
