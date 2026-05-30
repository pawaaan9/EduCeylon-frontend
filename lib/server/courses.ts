import "server-only";
import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdmin, getStorageBucketName } from "./firebase-admin";
import { coursePublicSlug } from "@/lib/courses/slug";
import { normalizeVisibility, normalizeCourseType, type LecturerCourse } from "@/lib/courses/types";

export const LECTURER_COURSES = "lecturerCourses";

export type CourseAssetKind =
  | "thumbnail"
  | "cover"
  | "lessonVideo"
  | "lessonPdf";

const ALLOWED_KINDS: CourseAssetKind[] = [
  "thumbnail",
  "cover",
  "lessonVideo",
  "lessonPdf",
];

export function isCourseAssetKind(value: unknown): value is CourseAssetKind {
  return typeof value === "string" && ALLOWED_KINDS.includes(value as CourseAssetKind);
}

function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function deepStripUndefined<T>(value: T): T {
  if (value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => deepStripUndefined(item)) as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = deepStripUndefined(v);
    }
    return out as T;
  }
  return value;
}

function prepareCourseWritePayload(
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const base = stripUndefined(patch);
  if (Array.isArray(base.modules)) {
    base.modules = deepStripUndefined(base.modules);
  }
  if (Array.isArray(base.weeklySchedule)) {
    base.weeklySchedule = deepStripUndefined(base.weeklySchedule);
  }
  return base;
}

export function normalizeCourse(id: string, data: Record<string, unknown>): LecturerCourse {
  const base: LecturerCourse = {
    id,
    lecturerId: (data.lecturerId as string) ?? "",
    slug: (data.slug as string | undefined) ?? undefined,
    title: (data.title as string) ?? "",
    subtitle: (data.subtitle as string | undefined) ?? undefined,
    description: (data.description as string | undefined) ?? undefined,
    mainCategory: (data.mainCategory as string | undefined) ?? undefined,
    subCategory: (data.subCategory as string | undefined) ?? undefined,
    language: (data.language as LecturerCourse["language"]) ?? undefined,
    teachingLevel:
      (data.teachingLevel as LecturerCourse["teachingLevel"]) ?? undefined,
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    courseType: normalizeCourseType(data.courseType),
    visibility: normalizeVisibility(data.visibility),
    accessType:
      (data.accessType as LecturerCourse["accessType"]) ?? "free",
    thumbnailURL: (data.thumbnailURL as string | undefined) ?? undefined,
    coverURL: (data.coverURL as string | undefined) ?? undefined,
    modules: Array.isArray(data.modules)
      ? (data.modules as LecturerCourse["modules"])
      : [],
    weeklySchedule: Array.isArray(data.weeklySchedule)
      ? (data.weeklySchedule as LecturerCourse["weeklySchedule"])
      : [],
    price: typeof data.price === "number" ? data.price : undefined,
    discountPrice:
      typeof data.discountPrice === "number" ? data.discountPrice : undefined,
    startDate: (data.startDate as string | undefined) ?? undefined,
    endDate: (data.endDate as string | undefined) ?? undefined,
    enrollmentSlots:
      typeof data.enrollmentSlots === "number" && data.enrollmentSlots > 0
        ? Math.floor(data.enrollmentSlots)
        : undefined,
    status: (data.status as LecturerCourse["status"]) ?? "draft",
    publishedAt: timestampToIso(data.publishedAt),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
    reviewCount:
      typeof data.reviewCount === "number" && data.reviewCount >= 0
        ? Math.floor(data.reviewCount)
        : undefined,
    ratingSum:
      typeof data.ratingSum === "number" && data.ratingSum >= 0
        ? data.ratingSum
        : undefined,
  };
  return base;
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

export async function listCoursesByLecturer(
  uid: string,
): Promise<LecturerCourse[]> {
  const { db } = getAdmin();
  const snap = await db
    .collection(LECTURER_COURSES)
    .where("lecturerId", "==", uid)
    .get();
  const rows = snap.docs.map((d) => normalizeCourse(d.id, d.data()));
  rows.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  return rows;
}

/** Admin: all courses across lecturers. */
export async function listAllCourses(): Promise<LecturerCourse[]> {
  const { db } = getAdmin();
  const snap = await db.collection(LECTURER_COURSES).get();
  const rows = snap.docs.map((d) =>
    normalizeCourse(d.id, d.data() as Record<string, unknown>),
  );
  rows.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  return rows;
}

export async function getCourseById(
  uid: string,
  courseId: string,
): Promise<LecturerCourse | null> {
  const { db } = getAdmin();
  const snap = await db.collection(LECTURER_COURSES).doc(courseId).get();
  if (!snap.exists) return null;
  const data = snap.data() as Record<string, unknown>;
  if (data.lecturerId !== uid) return null;
  return normalizeCourse(snap.id, data);
}

export async function createCourse(
  uid: string,
  patch: Partial<LecturerCourse>,
): Promise<LecturerCourse> {
  const { db } = getAdmin();
  const ref = db.collection(LECTURER_COURSES).doc();
  const now = FieldValue.serverTimestamp();
  const payload = prepareCourseWritePayload({
    ...patch,
    id: ref.id,
    lecturerId: uid,
    title: patch.title ?? "",
    tags: patch.tags ?? [],
    courseType: patch.courseType ?? "recorded",
    visibility: patch.visibility ?? "draft",
    accessType: patch.accessType ?? "free",
    modules: patch.modules ?? [],
    weeklySchedule: patch.weeklySchedule ?? [],
    status: patch.status ?? "draft",
    createdAt: now,
    updatedAt: now,
  });
  await ref.set(payload);
  const created = await getCourseById(uid, ref.id);
  if (!created) throw new Error("Failed to read course after create");
  return created;
}

export async function updateCourse(
  uid: string,
  courseId: string,
  patch: Partial<LecturerCourse>,
): Promise<LecturerCourse> {
  const current = await getCourseById(uid, courseId);
  if (!current) throw new Error("Course not found");

  const { db } = getAdmin();
  const ref = db.collection(LECTURER_COURSES).doc(courseId);
  const payload = prepareCourseWritePayload({
    ...patch,
    lecturerId: uid,
    updatedAt: FieldValue.serverTimestamp(),
  });
  // Don't let clients overwrite id / createdAt / lecturerId via patch.
  delete (payload as Record<string, unknown>).id;
  delete (payload as Record<string, unknown>).createdAt;
  await ref.set(payload, { merge: true });
  const updated = await getCourseById(uid, courseId);
  if (!updated) throw new Error("Failed to read course after update");
  return updated;
}

export async function deleteCourse(
  uid: string,
  courseId: string,
): Promise<void> {
  const current = await getCourseById(uid, courseId);
  if (!current) return;
  const { db } = getAdmin();
  await db.collection(LECTURER_COURSES).doc(courseId).delete();
}

export async function publishCourse(
  uid: string,
  courseId: string,
): Promise<LecturerCourse> {
  const current = await getCourseById(uid, courseId);
  if (!current) throw new Error("Course not found");
  const slug =
    current.slug?.trim() ||
    coursePublicSlug(current.title || "course", courseId);
  return updateCourse(uid, courseId, {
    status: "published",
    visibility: "publish",
    publishedAt: new Date().toISOString(),
    slug,
  });
}

export async function uploadCourseAsset(
  uid: string,
  courseId: string,
  kind: CourseAssetKind,
  fileName: string,
  contentType: string,
  buffer: Buffer,
): Promise<string> {
  const bucketName = getStorageBucketName();
  if (!bucketName) {
    throw new Error(
      "Storage bucket is not configured. Set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET in .env.local.",
    );
  }

  const ext = fileName.split(".").pop() || "bin";
  const safeKind = kind.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
  const path = `lecturers/${uid}/courses/${courseId}/${safeKind}-${Date.now()}.${ext}`;

  const { storage } = getAdmin();
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(path);
  const downloadToken = randomUUID();

  await file.save(buffer, {
    metadata: {
      contentType,
      metadata: { firebaseStorageDownloadTokens: downloadToken },
    },
    resumable: false,
  });

  const encodedPath = encodeURIComponent(path);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`;
}
