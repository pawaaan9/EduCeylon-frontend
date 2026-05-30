import type { CourseStatus } from "@/lib/courses/types";

export type LecturerDashboardCourseRow = {
  id: string;
  title: string;
  status: CourseStatus;
  lessonCount: number;
  thumbnailURL?: string;
  students: number;
  rating: number | null;
  reviewCount: number;
  revenue: number;
};

export type LecturerDashboardTopStudent = {
  studentId: string;
  name: string;
  hoursWatched: number;
  lessonsCompleted: number;
};

export type LecturerDashboardData = {
  totalStudents: number;
  studentsThisMonth: number;
  activeCourses: number;
  totalRevenue: number;
  revenueMoMPercent: number | null;
  averageRating: number | null;
  reviewCount: number;
  revenueLast7Days: { date: string; amount: number }[];
  revenueWeekChangePercent: number | null;
  topStudents: LecturerDashboardTopStudent[];
  courses: LecturerDashboardCourseRow[];
};
