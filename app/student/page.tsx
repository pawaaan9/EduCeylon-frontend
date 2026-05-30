"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GradientHeader } from "@/components/GradientHeader";
import { ProgressRing } from "@/components/ProgressRing";
import { StatCard } from "@/components/StatCard";
import { CourseCard } from "@/components/CourseCard";
import {
  BookIcon,
  ChartIcon,
  CheckCircleIcon,
  BoltIcon,
  PlayCircleIcon,
  ArrowRightIcon,
  CalendarIcon,
} from "@/components/icons";
import { fetchStudentDashboard } from "@/lib/api/student-dashboard";
import type { Course } from "@/lib/data/types";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { firstName, resolveDisplayName } from "@/lib/user/display-name";
import { formatLiveSessionStart } from "@/lib/format-live-session-start";
import type { StudentDashboardData } from "@/lib/student/dashboard";

const NUMBER = new Intl.NumberFormat("en-LK");

export default function StudentDashboardPage() {
  const { t, locale } = useI18n();
  const { user, profile } = useAuth();
  const greetingName = firstName(resolveDisplayName(profile, user));
  const [dashboard, setDashboard] = useState<StudentDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await user.getIdToken();
        const data = await fetchStudentDashboard(token);
        if (!cancelled) {
          setDashboard(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load dashboard");
          setDashboard(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const loading = user != null && dashboard == null && error == null;

  const stats = dashboard?.stats;
  const continueLearning = dashboard?.continueLearning ?? [];
  const upcomingLive = dashboard?.upcomingLive ?? [];
  const recommended = dashboard?.recommended ?? [];

  const hoursTrend = useMemo(() => {
    if (!stats || stats.hoursThisWeek <= 0) return undefined;
    return {
      value: t("student.stats.hoursWeekTrend").replace(
        "{hours}",
        String(stats.hoursThisWeek),
      ),
      positive: true,
    };
  }, [stats, t]);

  const streakTrend = useMemo(() => {
    if (!stats || stats.streakDays <= 0) return undefined;
    return {
      value: t("student.stats.streakEncourage"),
      positive: true,
    };
  }, [stats, t]);

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      </div>
    );
  }

  const enrolledCount = stats?.enrolledCount ?? 0;
  const hoursLearned = stats?.hoursLearned ?? 0;
  const completedCourses = stats?.completedCourses ?? 0;
  const streakDays = stats?.streakDays ?? 0;

  return (
    <>
      <GradientHeader
        title={`${t("dashboard.welcome")}, ${greetingName} 👋`}
        subtitle={t("dashboard.subtitle")}
        actions={
          <Link href="/courses" className="btn bg-white text-brand-700 hover:bg-white/90">
            {t("student.courses.browse")}
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        }
      >
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl">
          <HeroStat
            value={String(enrolledCount)}
            label={t("student.stats.enrolled")}
          />
          <HeroStat
            value={`${hoursLearned}h`}
            label={t("student.stats.hours")}
          />
          <HeroStat
            value={String(completedCourses)}
            label={t("student.stats.completed")}
          />
          <HeroStat
            value={String(streakDays)}
            label={t("student.stats.streak")}
          />
        </div>
      </GradientHeader>

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t("student.stats.enrolled")}
          value={enrolledCount}
          icon={<BookIcon className="h-5 w-5" />}
        />
        <StatCard
          label={t("student.stats.hours")}
          value={NUMBER.format(hoursLearned)}
          icon={<ChartIcon className="h-5 w-5" />}
          tint="emerald"
          trend={hoursTrend}
        />
        <StatCard
          label={t("student.stats.completed")}
          value={completedCourses}
          icon={<CheckCircleIcon className="h-5 w-5" />}
          tint="amber"
        />
        <StatCard
          label={t("student.stats.streak")}
          value={
            streakDays > 0
              ? t("student.stats.streakDays").replace("{days}", String(streakDays))
              : "0"
          }
          icon={<BoltIcon className="h-5 w-5" />}
          tint="rose"
          trend={streakTrend}
        />
      </section>

      <section className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-ink-900 text-lg">
              {t("student.continue.title")}
            </h2>
            {continueLearning.length > 0 && (
              <Link
                href="/student/courses"
                className="text-sm font-semibold text-brand-700 hover:text-brand-900 inline-flex items-center gap-1"
              >
                {t("action.viewAll")} <ArrowRightIcon className="h-4 w-4" />
              </Link>
            )}
          </div>
          {continueLearning.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-sm text-ink-500">{t("student.courses.empty.subtitle")}</p>
              <Link href="/courses" className="btn btn-primary mt-4 inline-flex">
                {t("student.courses.browse")}
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {continueLearning.map((c) => (
                <ContinueCourseRow key={c.id} course={c} locale={locale} t={t} />
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="font-semibold text-ink-900 text-lg mb-4">
            {t("student.upcoming.title")}
          </h2>
          <div className="card p-4 flex flex-col gap-3">
            {upcomingLive.length === 0 ? (
              <p className="text-sm text-ink-500 py-4 text-center">
                {t("student.upcoming.empty")}
              </p>
            ) : (
              upcomingLive.map((s) => (
                <div
                  key={s.id}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-ink-50 transition-colors"
                >
                  <div className="h-10 w-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                    <CalendarIcon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-ink-900 line-clamp-1">
                      {s.courseTitle[locale] ?? s.courseTitle.en}
                    </div>
                    <div className="text-xs text-ink-500 mt-0.5">
                      {s.lecturerName} ·{" "}
                      {formatLiveSessionStart(s.startsAt, locale, {
                        weekday: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <span className="badge badge-rose live-dot">LIVE</span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {recommended.length > 0 ? (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-ink-900 text-lg">
              {t("student.recommended.title")}
            </h2>
            <Link
              href="/courses"
              className="text-sm font-semibold text-brand-700 hover:text-brand-900 inline-flex items-center gap-1"
            >
              {t("action.viewAll")} <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {recommended.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function ContinueCourseRow({
  course,
  locale,
  t,
}: {
  course: Course;
  locale: string;
  t: (key: string) => string;
}) {
  return (
    <Link
      href={`/student/courses/${course.slug}/learn`}
      className="card p-4 flex gap-4 items-center hover:shadow-card hover:border-brand-200 transition-all"
    >
      <div
        className="h-20 w-32 rounded-lg flex-shrink-0 flex items-center justify-center text-white overflow-hidden relative"
        style={
          course.thumbnailURL
            ? undefined
            : { background: course.thumbnailGradient }
        }
      >
        {course.thumbnailURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.thumbnailURL}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        <PlayCircleIcon className="h-7 w-7 relative z-10 drop-shadow" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-ink-500">{course.lecturer.name}</div>
        <div className="font-semibold text-ink-900 line-clamp-1">
          {course.title[locale as keyof typeof course.title] ?? course.title.en}
        </div>
        <div className="mt-1.5 text-xs font-semibold text-brand-700">
          {t("student.study.continueLearning")}
        </div>
      </div>
      <ProgressRing
        percent={course.progressPercent ?? 0}
        size={48}
        stroke={4}
        variant="light"
        className="shrink-0"
      />
    </Link>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-white/10 backdrop-blur px-4 py-3 border border-white/10">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-[11px] text-white/80 uppercase tracking-wider mt-0.5 truncate">
        {label}
      </div>
    </div>
  );
}
