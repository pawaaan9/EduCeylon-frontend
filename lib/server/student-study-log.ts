import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import {
  DEFAULT_DAILY_STUDY_GOAL_MINUTES,
  type StudentJournalDay,
  type StudentJournalSummary,
  type StudentStudyLogEntry,
  type SaveStudyLogPayload,
} from "@/lib/student/journal";
import { getAdmin } from "./firebase-admin";
import { getStudentProfileByUid } from "./student-profile";

export const STUDENT_STUDY_LOGS_COLLECTION = "studentStudyLogs";

function logDocId(studentId: string, dateKey: string): string {
  return `${studentId}_${dateKey}`;
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

export function dayKey(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
    .toISOString()
    .slice(0, 10);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function normalizeSubjects(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function parseLogDoc(
  studentId: string,
  data: Record<string, unknown>,
  dateFallback: string,
): StudentStudyLogEntry {
  return {
    date: typeof data.date === "string" ? data.date : dateFallback,
    minutesStudied: Math.max(0, Number(data.minutesStudied) || 0),
    subjects: normalizeSubjects(data.subjects),
    note: typeof data.note === "string" ? data.note.trim() || undefined : undefined,
    updatedAt: timestampToIso(data.updatedAt),
  };
}

function activityLevel(minutesStudied: number, dailyGoalMinutes: number): number {
  if (minutesStudied <= 0 || dailyGoalMinutes <= 0) return 0;
  return Math.min(100, Math.round((minutesStudied / dailyGoalMinutes) * 100));
}

function toJournalDay(
  date: string,
  log: StudentStudyLogEntry | undefined,
  dailyGoalMinutes: number,
): StudentJournalDay {
  const minutesStudied = log?.minutesStudied ?? 0;
  const active = minutesStudied > 0;
  return {
    date,
    minutesStudied,
    subjects: log?.subjects ?? [],
    note: log?.note,
    activityLevel: activityLevel(minutesStudied, dailyGoalMinutes),
    active,
    metGoal: minutesStudied >= dailyGoalMinutes,
  };
}

function computeStreak(
  activeDays: Set<string>,
  predicate: (date: string) => boolean,
): number {
  if (activeDays.size === 0) return 0;

  const today = startOfDay(new Date());
  const cursor = new Date(today);

  const key = dayKey(cursor);
  if (!activeDays.has(key) || !predicate(key)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (activeDays.has(dayKey(cursor)) && predicate(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function monthBounds(year: number, month: number) {
  const end = new Date(year, month, 0);
  return { daysInMonth: end.getDate() };
}

async function resolveDailyGoalMinutes(studentId: string): Promise<number> {
  const profile = await getStudentProfileByUid(studentId);
  const goal = profile?.dailyStudyGoalMinutes;
  if (typeof goal === "number" && goal > 0 && goal <= 24 * 60) {
    return Math.round(goal);
  }
  return DEFAULT_DAILY_STUDY_GOAL_MINUTES;
}

async function getLogsForMonth(
  studentId: string,
  year: number,
  month: number,
  daysInMonth: number,
): Promise<Map<string, StudentStudyLogEntry>> {
  const { db } = getAdmin();
  const map = new Map<string, StudentStudyLogEntry>();

  const refs = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    const date = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return db.collection(STUDENT_STUDY_LOGS_COLLECTION).doc(logDocId(studentId, date));
  });

  const snaps = await db.getAll(...refs);
  for (const snap of snaps) {
    if (!snap.exists) continue;
    const data = snap.data() as Record<string, unknown>;
    const entry = parseLogDoc(studentId, data, snap.id.split("_").slice(1).join("_"));
    map.set(entry.date, entry);
  }
  return map;
}

async function listAllLogDays(studentId: string): Promise<Map<string, StudentStudyLogEntry>> {
  const { db } = getAdmin();
  const snap = await db
    .collection(STUDENT_STUDY_LOGS_COLLECTION)
    .where("studentId", "==", studentId)
    .get();

  const map = new Map<string, StudentStudyLogEntry>();
  for (const doc of snap.docs) {
    const data = doc.data() as Record<string, unknown>;
    const entry = parseLogDoc(studentId, data, "");
    if (entry.date) map.set(entry.date, entry);
  }
  return map;
}

export async function saveStudentStudyLog(
  studentId: string,
  payload: SaveStudyLogPayload,
): Promise<StudentStudyLogEntry> {
  const date = payload.date.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Invalid date");
  }

  const minutesStudied = Math.max(
    0,
    Math.min(24 * 60, Math.round(Number(payload.minutesStudied) || 0)),
  );
  const subjects = normalizeSubjects(payload.subjects).slice(0, 12);
  const note =
    typeof payload.note === "string" ? payload.note.trim().slice(0, 500) : undefined;

  const { db } = getAdmin();
  const ref = db.collection(STUDENT_STUDY_LOGS_COLLECTION).doc(logDocId(studentId, date));

  await ref.set(
    {
      studentId,
      date,
      minutesStudied,
      subjects,
      note: note || FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  const saved = await ref.get();
  return parseLogDoc(studentId, saved.data() as Record<string, unknown>, date);
}

export async function getStudentJournal(
  studentId: string,
  year: number,
  month: number,
): Promise<StudentJournalSummary> {
  const { daysInMonth } = monthBounds(year, month);
  const dailyGoalMinutes = await resolveDailyGoalMinutes(studentId);

  const [monthLogs, allLogs] = await Promise.all([
    getLogsForMonth(studentId, year, month, daysInMonth),
    listAllLogDays(studentId),
  ]);

  const days: StudentJournalDay[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push(toJournalDay(date, monthLogs.get(date), dailyGoalMinutes));
  }

  const activeDayKeys = new Set(
    [...allLogs.values()]
      .filter((log) => log.minutesStudied > 0)
      .map((log) => log.date),
  );

  const goalDayKeys = new Set(
    [...allLogs.values()]
      .filter((log) => log.minutesStudied >= dailyGoalMinutes)
      .map((log) => log.date),
  );

  return {
    year,
    month,
    streakDays: computeStreak(activeDayKeys, () => true),
    goalStreakDays: computeStreak(goalDayKeys, (date) => goalDayKeys.has(date)),
    activeDaysThisMonth: days.filter((d) => d.active).length,
    totalMinutesThisMonth: days.reduce((sum, d) => sum + d.minutesStudied, 0),
    dailyGoalMinutes,
    days,
  };
}
