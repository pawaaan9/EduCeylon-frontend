"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircleIcon } from "@/components/icons";
import {
  AL_STUDY_SUBJECTS,
  type StudentJournalDay,
} from "@/lib/student/journal";
import { useI18n } from "@/lib/i18n/I18nProvider";

function hoursFromMinutes(minutes: number): string {
  const h = minutes / 60;
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
}

function minutesFromHoursInput(value: string): number {
  const parsed = parseFloat(value.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(Math.min(24, parsed) * 60);
}

export function StudyLogForm({
  date,
  day,
  dailyGoalMinutes,
  saving,
  onSave,
  onGoalChange,
}: {
  date: string;
  day: StudentJournalDay | undefined;
  dailyGoalMinutes: number;
  saving: boolean;
  onSave: (payload: {
    minutesStudied: number;
    subjects: string[];
    note: string;
  }) => void;
  onGoalChange: (minutes: number) => void;
}) {
  const { t, locale } = useI18n();
  const [hours, setHours] = useState("0");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [goalHours, setGoalHours] = useState(hoursFromMinutes(dailyGoalMinutes));

  useEffect(() => {
    setHours(hoursFromMinutes(day?.minutesStudied ?? 0));
    setSubjects(day?.subjects ?? []);
    setNote(day?.note ?? "");
  }, [date, day]);

  useEffect(() => {
    setGoalHours(hoursFromMinutes(dailyGoalMinutes));
  }, [dailyGoalMinutes]);

  const dateLabel = useMemo(() => {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(locale, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, [date, locale]);

  const minutesPreview = minutesFromHoursInput(hours);
  const metGoal = minutesPreview >= dailyGoalMinutes;

  function toggleSubject(id: string) {
    setSubjects((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  return (
    <div className="card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-ink-900">
          {t("student.journal.logTitle")}
        </h3>
        <p className="mt-0.5 text-xs text-ink-500">{dateLabel}</p>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-ink-700">
          {t("student.journal.hoursStudied")}
        </span>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={24}
            step={0.5}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="input-base w-28"
          />
          <span className="text-sm text-ink-500">{t("student.journal.hoursUnit")}</span>
        </div>
        <p className="mt-1 text-xs text-ink-500">
          {t("student.journal.goalHint").replace(
            "{hours}",
            hoursFromMinutes(dailyGoalMinutes),
          )}
          {minutesPreview > 0 ? (
            <span
              className={`ml-2 font-medium ${metGoal ? "text-emerald-700" : "text-amber-700"}`}
            >
              {metGoal
                ? t("student.journal.goalMet")
                : t("student.journal.goalRemaining").replace(
                    "{minutes}",
                    String(Math.max(0, dailyGoalMinutes - minutesPreview)),
                  )}
            </span>
          ) : null}
        </p>
      </label>

      <div className="mt-4">
        <span className="text-sm font-medium text-ink-700">
          {t("student.journal.subjectsLabel")}
        </span>
        <div className="mt-2 flex flex-wrap gap-2">
          {AL_STUDY_SUBJECTS.map((id) => {
            const on = subjects.includes(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggleSubject(id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  on
                    ? "bg-brand-600 text-white shadow-sm"
                    : "bg-ink-100 text-ink-700 hover:bg-ink-200"
                }`}
              >
                {t(`student.journal.subjects.${id}`)}
              </button>
            );
          })}
        </div>
      </div>

      <label className="mt-4 block">
        <span className="text-sm font-medium text-ink-700">
          {t("student.journal.noteLabel")}
        </span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("student.journal.notePlaceholder")}
          className="textarea-base mt-1.5 min-h-[88px]"
          maxLength={500}
        />
      </label>

      <div className="mt-4 rounded-xl border border-ink-100 bg-ink-50/60 px-3 py-3">
        <label className="block">
          <span className="text-xs font-medium text-ink-600">
            {t("student.journal.dailyGoal")}
          </span>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              min={0.5}
              max={12}
              step={0.5}
              value={goalHours}
              onChange={(e) => setGoalHours(e.target.value)}
              onBlur={() =>
                onGoalChange(minutesFromHoursInput(goalHours || "0") || dailyGoalMinutes)
              }
              className="input-base w-24 text-sm"
            />
            <span className="text-xs text-ink-500">{t("student.journal.hoursUnit")}</span>
          </div>
        </label>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() =>
          onSave({
            minutesStudied: minutesFromHoursInput(hours),
            subjects,
            note: note.trim(),
          })
        }
        className="btn btn-primary mt-5 w-full justify-center"
      >
        <CheckCircleIcon className="h-4 w-4" />
        {saving ? t("student.settings.saving") : t("student.journal.saveLog")}
      </button>
    </div>
  );
}
