import type { Locale } from "@/lib/i18n/config";

export type Localized = Partial<Record<Locale, string>> & { en: string };

export type CategoryKey =
  | "ol"
  | "al"
  | "languages"
  | "university"
  | "skills"
  | "revision"
  | "seminars";

export type Level = "beginner" | "intermediate" | "advanced" | "allLevels";
export type CourseType = "recorded" | "live" | "hybrid";

export type Lesson = {
  id: string;
  title: Localized;
  durationMin: number;
  preview?: boolean;
};

export type StudyLesson = {
  id: string;
  type: "video" | "pdf" | "assignment" | "quiz" | "external" | "live";
  title: Localized;
  durationMin: number;
  videoURL?: string;
  pdfURL?: string;
  externalURL?: string;
  quiz?: import("@/lib/courses/quiz-student").StudyQuiz;
};

export type StudyModule = {
  id: string;
  title: Localized;
  lessons: StudyLesson[];
  quiz?: import("@/lib/courses/quiz-student").StudyQuiz;
};

export type StudyCourse = {
  id: string;
  slug: string;
  title: Localized;
  longDescription: Localized;
  thumbnailGradient: string;
  thumbnailURL?: string;
  lecturer: Pick<Lecturer, "id" | "slug" | "name" | "title" | "photoURL">;
  modules: StudyModule[];
  finalQuiz?: import("@/lib/courses/quiz-student").StudyQuiz;
};

export type QuizSubmitResult = import("@/lib/courses/quiz-student").QuizGradeResult & {
  submittedAt: string;
};

export type QuizAttemptSummary = {
  quizId: string;
  scorePercent: number;
  passed: boolean;
  submittedAt: string;
};

export type CourseStudyProgress = {
  completedLessonIds: string[];
  completedModuleIds: string[];
  updatedAt?: string;
  /** 0–100, set by API when total lesson count is known. */
  percent?: number;
  completedLessons?: number;
  totalLessons?: number;
};

export type StudyCourseWithProgress = StudyCourse & {
  progress: CourseStudyProgress;
  quizAttempts?: Record<string, QuizAttemptSummary>;
};

export type { StudyQuiz } from "@/lib/courses/quiz-student";

export type CourseModule = {
  id: string;
  title: Localized;
  lessons: Lesson[];
};

export type Lecturer = {
  id: string;
  slug: string;
  name: string;
  title: string;
  bio: Localized;
  qualifications: string[];
  experienceYears: number;
  rating: number;
  reviews: number;
  students: number;
  courses: number;
  subjects: string[];
  verified: boolean;
  coverGradient: string;
  photoURL?: string;
  coverURL?: string;
  district?: string;
  social?: { youtube?: string; facebook?: string; web?: string };
};

export type Course = {
  id: string;
  slug: string;
  title: Localized;
  shortDescription: Localized;
  longDescription: Localized;
  category: CategoryKey;
  level: Level;
  type: CourseType;
  language: Locale;
  price: number;
  rating: number;
  reviews: number;
  students: number;
  lessons: number;
  hours: number;
  featured?: boolean;
  trending?: boolean;
  thumbnailGradient: string;
  thumbnailURL?: string;
  lecturer: Pick<Lecturer, "id" | "slug" | "name" | "title" | "photoURL">;
  modules: CourseModule[];
  status?: "published" | "draft" | "pending" | "rejected";
  /** Enrollment progress 0–100 (student my-courses only). */
  progressPercent?: number;
};

export type CourseReview = {
  id: string;
  courseId: string;
  studentId: string;
  studentName: string;
  studentPhotoURL?: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
};

export type CourseReviewSummary = {
  averageRating: number;
  count: number;
};

export type CourseReviewsPayload = {
  reviews: CourseReview[];
  summary: CourseReviewSummary;
};

export type LiveSession = {
  id: string;
  courseId: string;
  courseTitle: Localized;
  lecturerName: string;
  startsAt: string; // ISO
  durationMin: number;
};
