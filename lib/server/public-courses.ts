import "server-only";

import { resolveCourseSlug } from "@/lib/courses/slug";
import {
  MAIN_CATEGORY_OPTIONS,
  isPublishedVisibility,
  type CourseModule,
  type CourseTeachingLevel,
  type LecturerCourse,
} from "@/lib/courses/types";
import type {
  CategoryKey,
  Course,
  CourseModule as PublicModule,
  Level,
  Lecturer,
  Localized,
} from "@/lib/data/types";
import { listAllLecturerProfiles } from "./admin-lecturers";
import { LECTURER_COURSES, normalizeCourse } from "./courses";
import { getAdmin } from "./firebase-admin";
import { profileToPublicLecturer } from "./public-lecturers";

const THUMBNAIL_GRADIENTS = [
  "linear-gradient(135deg,#1e3a8a,#2563eb 70%,#60a5fa)",
  "linear-gradient(135deg,#7c3aed,#a78bfa 70%,#c4b5fd)",
  "linear-gradient(135deg,#0d9488,#14b8a6 70%,#5eead4)",
  "linear-gradient(135deg,#b45309,#f59e0b 70%,#fcd34d)",
  "linear-gradient(135deg,#be123c,#fb7185 70%,#fda4af)",
  "linear-gradient(135deg,#0369a1,#0ea5e9 70%,#7dd3fc)",
  "linear-gradient(135deg,#4338ca,#818cf8 70%,#c7d2fe)",
];

const VALID_CATEGORIES = new Set<string>(MAIN_CATEGORY_OPTIONS);

function gradientForId(id: string): string {
  const hash = id.split("").reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 0);
  return THUMBNAIL_GRADIENTS[hash % THUMBNAIL_GRADIENTS.length]!;
}

function teachingLevelToLevel(level?: CourseTeachingLevel): Level {
  switch (level) {
    case "ol":
      return "beginner";
    case "al":
      return "intermediate";
    case "university":
    case "professional":
      return "advanced";
    default:
      return "allLevels";
  }
}

function asCategoryKey(value?: string): CategoryKey {
  if (value && VALID_CATEGORIES.has(value)) return value as CategoryKey;
  return "skills";
}

function localized(text: string): Localized {
  return { en: text, si: text, ta: text };
}

function courseStats(modules: CourseModule[]) {
  let lessons = 0;
  let minutes = 0;
  for (const mod of modules) {
    lessons += mod.lessons.length;
    for (const lesson of mod.lessons) {
      minutes += lesson.durationMinutes ?? 0;
    }
  }
  const hours = minutes > 0 ? Math.max(1, Math.round(minutes / 60)) : 1;
  return { lessons, hours };
}

function mapModules(modules: CourseModule[]): PublicModule[] {
  return modules.map((mod) => ({
    id: mod.id,
    title: localized(mod.title || "Module"),
    lessons: mod.lessons.map((lesson) => ({
      id: lesson.id,
      title: localized(lesson.title || "Lesson"),
      durationMin: lesson.durationMinutes ?? 0,
      preview: lesson.freePreview,
    })),
  }));
}

async function approvedLecturerMap(): Promise<Map<string, Lecturer>> {
  const profiles = await listAllLecturerProfiles();
  const map = new Map<string, Lecturer>();
  for (const profile of profiles) {
    if (profile.approvalStatus !== "approved") continue;
    map.set(profile.uid, profileToPublicLecturer(profile));
  }
  return map;
}

export async function listPublishedCoursesRaw(): Promise<LecturerCourse[]> {
  const { db } = getAdmin();
  const snap = await db
    .collection(LECTURER_COURSES)
    .where("status", "==", "published")
    .get();

  return snap.docs
    .map((d) => normalizeCourse(d.id, d.data() as Record<string, unknown>))
    .filter((c) => isPublishedVisibility(c.visibility) && c.title.trim().length > 0)
    .sort((a, b) =>
      (b.publishedAt ?? b.updatedAt ?? "").localeCompare(
        a.publishedAt ?? a.updatedAt ?? "",
      ),
    );
}

export function lecturerCourseToPublic(
  course: LecturerCourse,
  lecturer: Lecturer | null,
): Course {
  const { lessons, hours } = courseStats(course.modules);
  const description =
    course.description?.trim() || course.subtitle?.trim() || "";
  const slug = resolveCourseSlug(course);
  const price =
    course.accessType === "free" ? 0 : Math.max(0, course.price ?? 0);

  return {
    id: course.id,
    slug,
    title: localized(course.title.trim()),
    shortDescription: localized(description.slice(0, 220)),
    longDescription: localized(description),
    category: asCategoryKey(course.mainCategory),
    level: teachingLevelToLevel(course.teachingLevel),
    type: course.courseType,
    language: course.language ?? "en",
    price,
    rating: 0,
    reviews: 0,
    students: 0,
    lessons,
    hours,
    thumbnailGradient: gradientForId(course.id),
    thumbnailURL: course.thumbnailURL,
    lecturer: lecturer
      ? {
          id: lecturer.id,
          slug: lecturer.slug,
          name: lecturer.name,
          title: lecturer.title,
        }
      : {
          id: course.lecturerId,
          slug: "",
          name: "Lecturer",
          title: "",
        },
    modules: mapModules(course.modules),
    status: "published",
  };
}

export async function listPublishedCoursesByLecturer(
  lecturerId: string,
): Promise<LecturerCourse[]> {
  const { db } = getAdmin();
  const snap = await db
    .collection(LECTURER_COURSES)
    .where("lecturerId", "==", lecturerId)
    .where("status", "==", "published")
    .get();

  return snap.docs
    .map((d) => normalizeCourse(d.id, d.data() as Record<string, unknown>))
    .filter((c) => isPublishedVisibility(c.visibility) && c.title.trim().length > 0)
    .sort((a, b) =>
      (b.publishedAt ?? b.updatedAt ?? "").localeCompare(
        a.publishedAt ?? a.updatedAt ?? "",
      ),
    );
}

export async function listPublicCoursesByLecturer(
  lecturerId: string,
  lecturer: Lecturer,
): Promise<Course[]> {
  const raw = await listPublishedCoursesByLecturer(lecturerId);
  return raw.map((c) => lecturerCourseToPublic(c, lecturer));
}

export async function listPublicCourses(): Promise<Course[]> {
  const [courses, lecturers] = await Promise.all([
    listPublishedCoursesRaw(),
    approvedLecturerMap(),
  ]);
  return courses.map((c) =>
    lecturerCourseToPublic(c, lecturers.get(c.lecturerId) ?? null),
  );
}

export async function getPublicCourseBySlug(
  slug: string,
): Promise<{ course: Course; lecturer: Lecturer | null } | null> {
  const [courses, lecturers] = await Promise.all([
    listPublishedCoursesRaw(),
    approvedLecturerMap(),
  ]);
  const raw = courses.find((c) => resolveCourseSlug(c) === slug);
  if (!raw) return null;
  const lecturer = lecturers.get(raw.lecturerId) ?? null;
  return {
    course: lecturerCourseToPublic(raw, lecturer),
    lecturer,
  };
}
