/** Lecturer-owned course shape — used by both client and (re-exported in) server. */

export type CourseStatus = "draft" | "pending" | "published" | "archived";

export type CourseVisibility = "draft" | "publish";

export type CourseAccessType = "free" | "paid";

export type CourseType = "recorded" | "live" | "hybrid";

export type CourseLanguage = "si" | "ta" | "en";

export type CourseTeachingLevel =
  | "ol"
  | "al"
  | "university"
  | "language"
  | "professional";

export type LessonType =
  | "video"
  | "pdf"
  | "assignment"
  | "quiz"
  | "external"
  | "live";

export type Lesson = {
  id: string;
  type: LessonType;
  title: string;
  description?: string;
  /** Recorded video URL (Firebase Storage). */
  videoURL?: string;
  /** PDF / notes URL. */
  pdfURL?: string;
  /** External link (for `external` lessons). */
  externalURL?: string;
  /** Minutes. */
  durationMinutes?: number;
  freePreview?: boolean;
  liveSession?: LiveSession;
};

export type LiveSession = {
  title?: string;
  /** ISO date string, e.g. 2026-06-01. */
  date?: string;
  /** 24h time, e.g. "18:30". */
  time?: string;
  /** Minutes. */
  durationMinutes?: number;
  meetingURL?: string;
  description?: string;
};

export type CourseModule = {
  id: string;
  title: string;
  lessons: Lesson[];
};

export type WeeklyDay =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export const WEEKLY_DAY_OPTIONS: WeeklyDay[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export type WeeklyScheduleSlot = {
  id: string;
  day: WeeklyDay;
  /** 24h "HH:MM" */
  startTime: string;
  /** 24h "HH:MM" */
  endTime: string;
  /** e.g. "Theory class", "Paper class" */
  title: string;
  description?: string;
  meetingURL?: string;
};

export type LecturerCourse = {
  id: string;
  lecturerId: string;
  /** Public URL segment — set when published. */
  slug?: string;

  title: string;
  subtitle?: string;
  description?: string;

  mainCategory?: string;
  subCategory?: string;
  language?: CourseLanguage;
  teachingLevel?: CourseTeachingLevel;
  tags: string[];

  courseType: CourseType;
  visibility: CourseVisibility;
  accessType: CourseAccessType;

  thumbnailURL?: string;
  coverURL?: string;

  modules: CourseModule[];
  /** Weekly recurring schedule (live / hybrid courses). */
  weeklySchedule?: WeeklyScheduleSlot[];

  price?: number;
  discountPrice?: number;
  startDate?: string;
  endDate?: string;

  status: CourseStatus;
  publishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminCourseRow = {
  id: string;
  title: string;
  lecturerId: string;
  lecturerName: string;
  status: CourseStatus;
  accessType: CourseAccessType;
  price: number;
  thumbnailURL?: string;
  updatedAt?: string;
};

export const TEACHING_LEVEL_OPTIONS: CourseTeachingLevel[] = [
  "ol",
  "al",
  "university",
  "language",
  "professional",
];

export const COURSE_LANGUAGE_OPTIONS: CourseLanguage[] = ["si", "ta", "en"];

export const COURSE_TYPE_OPTIONS: CourseType[] = [
  "recorded",
  "live",
  "hybrid",
];

export const COURSE_VISIBILITY_OPTIONS: CourseVisibility[] = [
  "draft",
  "publish",
];

/** Map legacy Firestore values to the current draft / publish model. */
export function normalizeVisibility(value: unknown): CourseVisibility {
  if (value === "publish" || value === "public") return "publish";
  return "draft";
}

export function isPublishedVisibility(value: unknown): boolean {
  return value === "publish" || value === "public";
}

export const COURSE_ACCESS_OPTIONS: CourseAccessType[] = ["free", "paid"];

export const LESSON_TYPE_OPTIONS: LessonType[] = [
  "video",
  "pdf",
  "assignment",
  "quiz",
  "external",
  "live",
];

/** Main categories — aligned with existing `category.*` i18n keys. */
export const MAIN_CATEGORY_OPTIONS = [
  "ol",
  "al",
  "languages",
  "university",
  "professional",
  "revision",
  "seminars",
  "skills",
] as const;

export type MainCategoryOption = (typeof MAIN_CATEGORY_OPTIONS)[number];

export function emptyCourse(uid: string): Omit<LecturerCourse, "id"> {
  return {
    lecturerId: uid,
    title: "",
    tags: [],
    courseType: "recorded",
    visibility: "draft",
    accessType: "free",
    modules: [],
    weeklySchedule: [],
    status: "draft",
  };
}

export function newClientId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
