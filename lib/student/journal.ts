/** Personal study log — not tied to EduCeylon course activity. */

export const DEFAULT_DAILY_STUDY_GOAL_MINUTES = 120;

export const AL_STUDY_SUBJECTS = [
  "physics",
  "chemistry",
  "biology",
  "combined_maths",
  "ict",
  "english",
  "sinhala",
  "tamil",
  "other",
] as const;

export type AlStudySubject = (typeof AL_STUDY_SUBJECTS)[number];

export type StudentStudyLogEntry = {
  date: string;
  minutesStudied: number;
  subjects: string[];
  note?: string;
  updatedAt?: string;
};

export type StudentJournalDay = {
  date: string;
  minutesStudied: number;
  subjects: string[];
  note?: string;
  /** 0–100 heatmap intensity vs daily goal */
  activityLevel: number;
  active: boolean;
  metGoal: boolean;
};

export type StudentJournalSummary = {
  year: number;
  month: number;
  streakDays: number;
  goalStreakDays: number;
  activeDaysThisMonth: number;
  totalMinutesThisMonth: number;
  dailyGoalMinutes: number;
  days: StudentJournalDay[];
};

export type SaveStudyLogPayload = {
  date: string;
  minutesStudied: number;
  subjects?: string[];
  note?: string;
};
