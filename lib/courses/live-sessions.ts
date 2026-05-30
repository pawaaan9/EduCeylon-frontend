import type { LecturerCourse, WeeklyDay, WeeklyScheduleSlot } from "@/lib/courses/types";

const DAY_ORDER: Record<WeeklyDay, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

export type LecturerLiveSessionRow = {
  courseId: string;
  courseTitle: string;
  courseStatus: LecturerCourse["status"];
  slot: WeeklyScheduleSlot | null;
};

export type UpcomingLiveSession = {
  id: string;
  courseId: string;
  courseTitle: string;
  lecturerName: string;
  startsAt: string;
  durationMin: number;
  sessionTitle: string;
};

const JS_DAY: Record<WeeklyDay, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function parseTimeMinutes(time: string): number {
  const [h, m] = time.split(":").map((part) => parseInt(part, 10));
  return (h ?? 0) * 60 + (m ?? 0);
}

function slotDurationMinutes(slot: WeeklyScheduleSlot): number {
  const diff = parseTimeMinutes(slot.endTime) - parseTimeMinutes(slot.startTime);
  return diff > 0 ? diff : 60;
}

export function nextWeeklySlotOccurrence(
  slot: WeeklyScheduleSlot,
  from: Date = new Date(),
): Date {
  const targetDay = JS_DAY[slot.day];
  const [hours, minutes] = slot.startTime.split(":").map((part) =>
    parseInt(part, 10),
  );

  const candidate = new Date(from);
  candidate.setSeconds(0, 0);
  candidate.setHours(hours ?? 0, minutes ?? 0, 0, 0);

  let daysAhead = (targetDay - candidate.getDay() + 7) % 7;
  if (daysAhead === 0 && candidate.getTime() <= from.getTime()) {
    daysAhead = 7;
  }
  candidate.setDate(candidate.getDate() + daysAhead);
  return candidate;
}

export function listUpcomingLiveSessions(
  courses: Array<{
    id: string;
    title: string;
    courseType: LecturerCourse["courseType"];
    weeklySchedule?: WeeklyScheduleSlot[];
    lecturerName: string;
  }>,
  limit = 5,
  from: Date = new Date(),
): UpcomingLiveSession[] {
  const sessions: UpcomingLiveSession[] = [];

  for (const course of courses) {
    if (course.courseType !== "live") continue;
    for (const slot of course.weeklySchedule ?? []) {
      const startsAt = nextWeeklySlotOccurrence(slot, from);
      sessions.push({
        id: `${course.id}_${slot.id}`,
        courseId: course.id,
        courseTitle: course.title.trim() || "Untitled course",
        lecturerName: course.lecturerName,
        startsAt: startsAt.toISOString(),
        durationMin: slotDurationMinutes(slot),
        sessionTitle: slot.title,
      });
    }
  }

  return sessions
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, limit);
}

export function listLecturerLiveSessionRows(
  courses: LecturerCourse[],
): LecturerLiveSessionRow[] {
  const rows: LecturerLiveSessionRow[] = [];

  for (const course of courses) {
    if (course.courseType !== "live") continue;
    const title = course.title.trim() || "Untitled course";
    const slots = course.weeklySchedule ?? [];

    if (slots.length === 0) {
      rows.push({
        courseId: course.id,
        courseTitle: title,
        courseStatus: course.status,
        slot: null,
      });
      continue;
    }

    for (const slot of slots) {
      rows.push({
        courseId: course.id,
        courseTitle: title,
        courseStatus: course.status,
        slot,
      });
    }
  }

  return rows.sort((a, b) => {
    if (!a.slot && !b.slot) return a.courseTitle.localeCompare(b.courseTitle);
    if (!a.slot) return 1;
    if (!b.slot) return -1;
    const dayDiff = DAY_ORDER[a.slot.day] - DAY_ORDER[b.slot.day];
    if (dayDiff !== 0) return dayDiff;
    return a.slot.startTime.localeCompare(b.slot.startTime);
  });
}
