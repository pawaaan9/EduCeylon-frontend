import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { resolveCourseSlug } from "@/lib/courses/slug";
import { isPublishedVisibility } from "@/lib/courses/types";
import type {
  CourseReview,
  CourseReviewSummary,
  CourseReviewsPayload,
} from "@/lib/data/types";
import { LECTURER_COURSES, normalizeCourse } from "./courses";
import { isStudentEnrolled } from "./enrollments";
import { getAdmin } from "./firebase-admin";
import { getStudentProfileByUid } from "./student-profile";

export const COURSE_REVIEWS_COLLECTION = "courseReviews";

const MIN_COMMENT_LENGTH = 10;
const MAX_COMMENT_LENGTH = 2000;

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

function mapReview(
  id: string,
  data: Record<string, unknown>,
): CourseReview {
  return {
    id,
    courseId: (data.courseId as string) ?? "",
    studentId: (data.studentId as string) ?? "",
    studentName: (data.studentName as string) ?? "Student",
    studentPhotoURL: (data.studentPhotoURL as string | undefined) ?? undefined,
    rating: Math.max(1, Math.min(5, Math.round(Number(data.rating) || 1))),
    comment: (data.comment as string) ?? "",
    createdAt: timestampToIso(data.createdAt) ?? new Date().toISOString(),
    updatedAt: timestampToIso(data.updatedAt) ?? new Date().toISOString(),
  };
}

function summaryFromStats(
  reviewCount: number,
  ratingSum: number,
): CourseReviewSummary {
  if (reviewCount <= 0) {
    return { averageRating: 0, count: 0 };
  }
  const averageRating =
    Math.round((ratingSum / reviewCount) * 10) / 10;
  return { averageRating, count: reviewCount };
}

export function validateReviewInput(input: {
  rating?: unknown;
  comment?: unknown;
}): { rating: number; comment: string } {
  const rating = Math.round(Number(input.rating));
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new Error("Rating must be between 1 and 5 stars");
  }

  const comment =
    typeof input.comment === "string" ? input.comment.trim() : "";
  if (comment.length < MIN_COMMENT_LENGTH) {
    throw new Error(
      `Review comment must be at least ${MIN_COMMENT_LENGTH} characters`,
    );
  }
  if (comment.length > MAX_COMMENT_LENGTH) {
    throw new Error(
      `Review comment must be at most ${MAX_COMMENT_LENGTH} characters`,
    );
  }

  return { rating, comment };
}

export async function getPublishedCourseIdBySlug(
  slug: string,
): Promise<string | null> {
  const { db } = getAdmin();
  const snap = await db
    .collection(LECTURER_COURSES)
    .where("status", "==", "published")
    .get();

  for (const doc of snap.docs) {
    const course = normalizeCourse(doc.id, doc.data() as Record<string, unknown>);
    if (
      isPublishedVisibility(course.visibility) &&
      course.title.trim() &&
      resolveCourseSlug(course) === slug
    ) {
      return course.id;
    }
  }
  return null;
}

async function getPublishedCourseById(courseId: string) {
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

export async function listCourseReviews(
  courseId: string,
): Promise<CourseReviewsPayload> {
  const { db } = getAdmin();
  const course = await getPublishedCourseById(courseId);
  if (!course) {
    throw new Error("Course not found");
  }

  const snap = await db
    .collection(COURSE_REVIEWS_COLLECTION)
    .where("courseId", "==", courseId)
    .get();

  const reviews = snap.docs
    .map((doc) => mapReview(doc.id, doc.data() as Record<string, unknown>))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const reviewCount = course.reviewCount ?? reviews.length;
  const ratingSum =
    course.ratingSum ??
    reviews.reduce((sum, review) => sum + review.rating, 0);

  return {
    reviews,
    summary: summaryFromStats(reviewCount, ratingSum),
  };
}

export async function listStudentCourseReviews(
  studentId: string,
  courseId: string,
): Promise<CourseReview[]> {
  const { db } = getAdmin();
  const snap = await db
    .collection(COURSE_REVIEWS_COLLECTION)
    .where("courseId", "==", courseId)
    .where("studentId", "==", studentId)
    .get();

  return snap.docs
    .map((doc) => mapReview(doc.id, doc.data() as Record<string, unknown>))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createStudentCourseReview(
  studentId: string,
  courseId: string,
  input: { rating: number; comment: string },
  fallbackName?: string | null,
): Promise<CourseReview> {
  const enrolled = await isStudentEnrolled(studentId, courseId);
  if (!enrolled) {
    throw new Error("You must be enrolled in this course to leave a review");
  }

  const course = await getPublishedCourseById(courseId);
  if (!course) {
    throw new Error("Course not found");
  }

  const profile = await getStudentProfileByUid(studentId);
  const studentName =
    profile?.name?.trim() ||
    fallbackName?.trim() ||
    "Student";
  const studentPhotoURL = profile?.photoURL;

  const { db } = getAdmin();
  const reviewRef = db.collection(COURSE_REVIEWS_COLLECTION).doc();
  const courseRef = db.collection(LECTURER_COURSES).doc(courseId);

  await db.runTransaction(async (tx) => {
    const courseSnap = await tx.get(courseRef);
    if (!courseSnap.exists) {
      throw new Error("Course not found");
    }

    const courseData = courseSnap.data() as Record<string, unknown>;
    const reviewCount =
      (typeof courseData.reviewCount === "number" ? courseData.reviewCount : 0) +
      1;
    const ratingSum =
      (typeof courseData.ratingSum === "number" ? courseData.ratingSum : 0) +
      input.rating;

    tx.set(reviewRef, {
      studentId,
      courseId,
      rating: input.rating,
      comment: input.comment,
      studentName,
      studentPhotoURL: studentPhotoURL ?? null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(
      courseRef,
      {
        reviewCount,
        ratingSum,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  const saved = await reviewRef.get();
  return mapReview(saved.id, saved.data() as Record<string, unknown>);
}
