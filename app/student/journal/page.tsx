"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GradientHeader } from "@/components/GradientHeader";
import {
  JournalSummaryStrip,
  LearningJournalCalendar,
} from "@/components/student/LearningJournalCalendar";
import { StudyLogForm } from "@/components/student/StudyLogForm";
import {
  fetchStudentJournal,
  saveStudentStudyLog,
} from "@/lib/api/student-journal";
import { saveMyStudentProfile } from "@/lib/api/students";
import type { StudentJournalSummary } from "@/lib/student/journal";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatHours(minutes: number): string {
  const h = minutes / 60;
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
}

export default function StudentJournalPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [journal, setJournal] = useState<StudentJournalSummary | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(todayKey());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const loadJournal = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const data = await fetchStudentJournal(token, year, month);
      setJournal(data);
      setError(null);
      setSelectedDate((current) => {
        if (current && data.days.some((d) => d.date === current)) {
          return current;
        }
        const today = todayKey();
        const nowDate = new Date();
        if (
          data.year === nowDate.getFullYear() &&
          data.month === nowDate.getMonth() + 1 &&
          data.days.some((d) => d.date === today)
        ) {
          return today;
        }
        return data.days[0]?.date ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load journal");
      setJournal(null);
    }
  }, [user, year, month]);

  useEffect(() => {
    void loadJournal();
  }, [loadJournal]);

  const loading = user != null && journal == null && error == null;

  const selectedDay = useMemo(
    () => journal?.days.find((d) => d.date === selectedDate),
    [journal, selectedDate],
  );

  const goalDaysThisMonth = useMemo(
    () => journal?.days.filter((d) => d.metGoal).length ?? 0,
    [journal],
  );

  async function handleSaveLog(payload: {
    minutesStudied: number;
    subjects: string[];
    note: string;
  }) {
    if (!user || !selectedDate) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const token = await user.getIdToken();
      await saveStudentStudyLog(token, {
        date: selectedDate,
        ...payload,
      });
      await loadJournal();
      setSaveMessage(t("student.journal.saved"));
    } catch (e) {
      setSaveMessage(e instanceof Error ? e.message : t("student.journal.saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleGoalChange(minutes: number) {
    if (!user || !journal) return;
    if (minutes === journal.dailyGoalMinutes) return;
    try {
      const token = await user.getIdToken();
      await saveMyStudentProfile(token, { dailyStudyGoalMinutes: minutes });
      await loadJournal();
    } catch {
      /* keep current goal on profile save failure */
    }
  }

  function goPrevMonth() {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function goNextMonth() {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (error || !journal) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-rose-600" role="alert">
          {error ?? t("student.journal.loadError")}
        </p>
      </div>
    );
  }

  return (
    <>
      <GradientHeader
        title={t("student.journal.title")}
        subtitle={t("student.journal.subtitle")}
      >
        <div className="mt-6 max-w-3xl">
          <JournalSummaryStrip journal={journal} />
        </div>
      </GradientHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <LearningJournalCalendar
          journal={journal}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onPrevMonth={goPrevMonth}
          onNextMonth={goNextMonth}
        />

        <aside className="flex flex-col gap-4">
          {selectedDate ? (
            <>
              <StudyLogForm
                date={selectedDate}
                day={selectedDay}
                dailyGoalMinutes={journal.dailyGoalMinutes}
                saving={saving}
                onSave={handleSaveLog}
                onGoalChange={handleGoalChange}
              />
              {saveMessage ? (
                <p
                  className={`text-sm ${saveMessage === t("student.journal.saved") ? "text-emerald-700" : "text-rose-600"}`}
                  role="status"
                >
                  {saveMessage}
                </p>
              ) : null}
            </>
          ) : null}

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-ink-900">
              {t("student.journal.tipsTitle")}
            </h3>
            <p className="mt-2 text-sm text-ink-600 leading-relaxed">
              {t("student.journal.tipsBody")}
            </p>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-ink-900">
              {t("student.journal.monthHighlights")}
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-ink-600">
              <li>
                {formatHours(journal.totalMinutesThisMonth)}{" "}
                {t("student.journal.hoursLogged")}
              </li>
              <li>
                {journal.activeDaysThisMonth} {t("student.journal.daysStudied")}
              </li>
              <li>
                {goalDaysThisMonth} {t("student.journal.goalDaysHitLong")}
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}
