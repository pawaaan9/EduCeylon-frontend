import type { QuizScope } from "@/lib/server/quiz-attempts";

export type StudentProgressQuizResult = {
  quizId: string;
  title: string;
  scope: QuizScope;
  scopeLabel: string;
  scorePercent: number;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
  submittedAt: string;
};

export type StudentProgressCourseRow = {
  id: string;
  slug: string;
  title: string;
  lecturerName: string;
  thumbnailGradient: string;
  thumbnailURL?: string;
  progressPercent: number;
  completedLessons: number;
  totalLessons: number;
  hoursWatched: number;
  completed: boolean;
  enrolledAt: string;
  quizzes: StudentProgressQuizResult[];
};

export type StudentProgressStats = {
  hoursThisWeek: number;
  lessonsCompleted: number;
  streakDays: number;
  averageQuizScore: number | null;
  completedCourses: number;
  enrolledCount: number;
};

export type StudentProgressData = {
  stats: StudentProgressStats;
  courses: StudentProgressCourseRow[];
};
