"use client";

import { useMemo } from "react";
import {
  BoltIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  StarIcon,
} from "@/components/icons";
import type { StudentJournalSummary } from "@/lib/student/journal";
import { useI18n } from "@/lib/i18n/I18nProvider";

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function heatClass(level: number, selected: boolean, today: boolean, metGoal: boolean): string {
  if (selected) {
    return metGoal
      ? "ring-2 ring-emerald-600 ring-offset-2 bg-emerald-600 text-white shadow-md"
      : "ring-2 ring-brand-600 ring-offset-2 bg-brand-600 text-white shadow-md";
  }
  if (today) {
    return metGoal
      ? "ring-2 ring-emerald-300 ring-offset-1"
      : "ring-2 ring-brand-300 ring-offset-1";
  }
  if (level <= 0) {
    return "bg-ink-50 text-ink-400 border border-ink-100";
  }
  if (metGoal) {
    return "bg-emerald-500 text-white border border-emerald-600 shadow-sm";
  }
  if (level < 50) {
    return "bg-brand-100 text-brand-900 border border-brand-200";
  }
  return "bg-brand-400 text-brand-950 border border-brand-500";
}

function formatHours(minutes: number): string {
  const h = minutes / 60;
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
}

export function LearningJournalCalendar({
  journal,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
}: {
  journal: StudentJournalSummary;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const { t, locale } = useI18n();

  const monthLabel = useMemo(() => {
    const d = new Date(journal.year, journal.month - 1, 1);
    return d.toLocaleDateString(locale, { month: "long", year: "numeric" });
  }, [journal.year, journal.month, locale]);

  const todayKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);

  const firstWeekday = new Date(journal.year, journal.month - 1, 1).getDay();
  const leadingBlanks = Array.from({ length: firstWeekday }, (_, i) => i);
  const goalDaysThisMonth = journal.days.filter((d) => d.metGoal).length;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={onPrevMonth}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-ink-100"
          aria-label={t("student.journal.prevMonth")}
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-ink-900">{monthLabel}</p>
          <p className="text-xs text-ink-500">
            {journal.activeDaysThisMonth} {t("student.journal.activeDays")}
            {goalDaysThisMonth > 0 ? (
              <span className="text-emerald-700">
                {" "}
                · {goalDaysThisMonth} {t("student.journal.goalDaysHit")}
              </span>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={onNextMonth}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-ink-100"
          aria-label={t("student.journal.nextMonth")}
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 px-3 pt-3 sm:gap-1.5 sm:px-4">
        {WEEKDAY_KEYS.map((key) => (
          <div
            key={key}
            className="pb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-ink-400 sm:text-xs"
          >
            {t(`student.journal.weekday.${key}`)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 p-3 sm:gap-1.5 sm:p-4">
        {leadingBlanks.map((i) => (
          <div key={`blank-${i}`} className="aspect-square" aria-hidden />
        ))}
        {journal.days.map((day) => {
          const dayNum = Number(day.date.slice(-2));
          const isSelected = selectedDate === day.date;
          const isToday = day.date === todayKey;
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onSelectDate(day.date)}
              title={
                day.active
                  ? t("student.journal.dayTooltip")
                      .replace("{hours}", formatHours(day.minutesStudied))
                      .replace(
                        "{goal}",
                        day.metGoal ? t("student.journal.goalMetShort") : "",
                      )
                  : undefined
              }
              className={`relative aspect-square rounded-xl text-sm font-semibold transition-all hover:scale-[1.03] ${heatClass(day.activityLevel, isSelected, isToday && !isSelected, day.metGoal)}`}
            >
              {dayNum}
              {day.metGoal ? (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] leading-none">
                  ★
                </span>
              ) : day.active ? (
                <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-current opacity-80" />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-ink-100 px-4 py-3 text-[11px] text-ink-500 sm:px-5">
        <span>{t("student.journal.legend")}</span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-ink-50 border border-ink-100" />
          {t("student.journal.legendNone")}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-brand-100 border border-brand-200" />
          {t("student.journal.legendLow")}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-brand-400 border border-brand-500" />
          {t("student.journal.legendMid")}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-emerald-500 border border-emerald-600" />
          {t("student.journal.legendGoal")}
        </span>
      </div>
    </div>
  );
}

export function JournalSummaryStrip({
  journal,
}: {
  journal: StudentJournalSummary;
}) {
  const { t } = useI18n();
  const totalHours = formatHours(journal.totalMinutesThisMonth);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <SummaryChip
        icon={<BoltIcon className="h-4 w-4" />}
        label={t("student.journal.studyStreak")}
        value={t("student.stats.streakDays").replace(
          "{days}",
          String(journal.streakDays),
        )}
      />
      <SummaryChip
        icon={<StarIcon className="h-4 w-4" />}
        label={t("student.journal.goalStreak")}
        value={t("student.stats.streakDays").replace(
          "{days}",
          String(journal.goalStreakDays),
        )}
      />
      <SummaryChip
        icon={<CheckCircleIcon className="h-4 w-4" />}
        label={t("student.journal.activeDays")}
        value={String(journal.activeDaysThisMonth)}
      />
      <SummaryChip
        icon={<ClockIcon className="h-4 w-4" />}
        label={t("student.journal.hoursThisMonth")}
        value={`${totalHours} ${t("student.journal.hoursUnit")}`}
      />
    </div>
  );
}

function SummaryChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-2 text-white/80">{icon}</div>
      <p className="mt-1 text-xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-white/70">{label}</p>
    </div>
  );
}
