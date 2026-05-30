export type StudentStudyLevel =
  | "ol"
  | "al"
  | "university"
  | "language"
  | "professional"
  | "other";

export type StudentNotificationPrefs = {
  liveReminders: boolean;
  courseAnnouncements: boolean;
  weeklyProgress: boolean;
  promotions: boolean;
};

export type StudentProfile = {
  uid: string;
  email: string;
  name: string;
  photoURL?: string;
  phone?: string;
  district?: string;
  studyLevel?: StudentStudyLevel;
  schoolName?: string;
  bio?: string;
  notificationPrefs: StudentNotificationPrefs;
  /** Personal study target for the learning journal (minutes). */
  dailyStudyGoalMinutes?: number;
  createdAt?: string;
  updatedAt?: string;
};

export const STUDENT_STUDY_LEVELS: StudentStudyLevel[] = [
  "ol",
  "al",
  "university",
  "language",
  "professional",
  "other",
];

export const DEFAULT_NOTIFICATION_PREFS: StudentNotificationPrefs = {
  liveReminders: true,
  courseAnnouncements: true,
  weeklyProgress: true,
  promotions: false,
};

export function emptyStudentProfile(
  uid: string,
  email = "",
  name = "",
): StudentProfile {
  return {
    uid,
    email,
    name,
    notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS },
  };
}
