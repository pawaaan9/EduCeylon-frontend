import type { Course, LiveSession } from "@/lib/data/types";

export type StudentDashboardStats = {
  enrolledCount: number;
  hoursLearned: number;
  hoursThisWeek: number;
  completedCourses: number;
  streakDays: number;
};

export type StudentDashboardData = {
  stats: StudentDashboardStats;
  continueLearning: Course[];
  upcomingLive: LiveSession[];
  recommended: Course[];
};
