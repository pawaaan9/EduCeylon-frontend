import "server-only";
import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import {
  DEFAULT_NOTIFICATION_PREFS,
  emptyStudentProfile,
  type StudentNotificationPrefs,
  type StudentProfile,
} from "@/lib/student/types";
import { getAdmin, getStorageBucketName } from "./firebase-admin";

export const STUDENTS_COLLECTION = "students";

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

function normalizeNotificationPrefs(
  value: unknown,
): StudentNotificationPrefs {
  const raw = (value ?? {}) as Partial<StudentNotificationPrefs>;
  return {
    liveReminders:
      typeof raw.liveReminders === "boolean"
        ? raw.liveReminders
        : DEFAULT_NOTIFICATION_PREFS.liveReminders,
    courseAnnouncements:
      typeof raw.courseAnnouncements === "boolean"
        ? raw.courseAnnouncements
        : DEFAULT_NOTIFICATION_PREFS.courseAnnouncements,
    weeklyProgress:
      typeof raw.weeklyProgress === "boolean"
        ? raw.weeklyProgress
        : DEFAULT_NOTIFICATION_PREFS.weeklyProgress,
    promotions:
      typeof raw.promotions === "boolean"
        ? raw.promotions
        : DEFAULT_NOTIFICATION_PREFS.promotions,
  };
}

export function mergeStudentProfileDoc(
  uid: string,
  data: Record<string, unknown>,
): StudentProfile {
  const base = emptyStudentProfile(
    uid,
    (data.email as string | undefined) ?? "",
    (data.name as string | undefined) ?? "",
  );
  return {
    ...base,
    photoURL: (data.photoURL as string | undefined) ?? undefined,
    phone: (data.phone as string | undefined) ?? undefined,
    district: (data.district as string | undefined) ?? undefined,
    studyLevel: (data.studyLevel as StudentProfile["studyLevel"]) ?? undefined,
    schoolName: (data.schoolName as string | undefined) ?? undefined,
    bio: (data.bio as string | undefined) ?? undefined,
    notificationPrefs: normalizeNotificationPrefs(data.notificationPrefs),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

export async function getStudentProfileByUid(
  uid: string,
): Promise<StudentProfile | null> {
  const { db } = getAdmin();
  const snap = await db.collection(STUDENTS_COLLECTION).doc(uid).get();
  if (!snap.exists) return null;
  return mergeStudentProfileDoc(uid, snap.data() as Record<string, unknown>);
}

export async function saveStudentProfile(
  uid: string,
  patch: Partial<StudentProfile>,
): Promise<StudentProfile> {
  const { db } = getAdmin();
  const ref = db.collection(STUDENTS_COLLECTION).doc(uid);
  const existing = await getStudentProfileByUid(uid);
  const next: StudentProfile = {
    ...(existing ?? emptyStudentProfile(uid)),
    ...patch,
    uid,
    notificationPrefs: patch.notificationPrefs
      ? normalizeNotificationPrefs(patch.notificationPrefs)
      : (existing?.notificationPrefs ?? { ...DEFAULT_NOTIFICATION_PREFS }),
  };

  const payload: Record<string, unknown> = {
    uid: next.uid,
    email: next.email,
    name: next.name.trim(),
    photoURL: next.photoURL ?? FieldValue.delete(),
    phone: next.phone?.trim() || FieldValue.delete(),
    district: next.district?.trim() || FieldValue.delete(),
    studyLevel: next.studyLevel ?? FieldValue.delete(),
    schoolName: next.schoolName?.trim() || FieldValue.delete(),
    bio: next.bio?.trim() || FieldValue.delete(),
    notificationPrefs: next.notificationPrefs,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (!existing) {
    payload.createdAt = FieldValue.serverTimestamp();
    payload.role = "student";
  }

  await ref.set(payload, { merge: true });
  const saved = await getStudentProfileByUid(uid);
  if (!saved) throw new Error("Failed to read student profile after save");
  return saved;
}

export async function uploadStudentPhoto(
  uid: string,
  fileName: string,
  contentType: string,
  buffer: Buffer,
): Promise<string> {
  const ext = fileName.split(".").pop() ?? "jpg";
  const path = `students/${uid}/photo-${Date.now()}.${ext}`;

  const bucketName = getStorageBucketName();
  if (!bucketName) {
    throw new Error(
      "Storage bucket is not configured. Set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET in .env.local.",
    );
  }

  const { storage } = getAdmin();
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(path);
  const downloadToken = randomUUID();

  await file.save(buffer, {
    metadata: {
      contentType,
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
      },
    },
    resumable: false,
  });

  const encodedPath = encodeURIComponent(path);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`;
}
