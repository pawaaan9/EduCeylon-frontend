"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GradientHeader } from "@/components/GradientHeader";
import { LecturerOnboardingBanner } from "@/components/LecturerOnboardingBanner";
import { StatCard } from "@/components/StatCard";
import {
  ArrowRightIcon,
  BookIcon,
  ChartIcon,
  MoneyIcon,
  PlusIcon,
  StarIcon,
  UsersIcon,
} from "@/components/icons";
import { Avatar } from "@/components/Avatar";
import { fetchLecturerDashboard } from "@/lib/api/lecturer-dashboard";
import type { CourseStatus } from "@/lib/courses/types";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { LecturerDashboardData } from "@/lib/lecturer/dashboard";
import { firstName, resolveDisplayName } from "@/lib/user/display-name";

const LKR = new Intl.NumberFormat("en-LK", {
  style: "currency",
  currency: "LKR",
  maximumFractionDigits: 0,
});

const NUMBER = new Intl.NumberFormat("en-LK");

function formatTrend(value: number, suffix: string): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}${suffix}`;
}

export default function LecturerDashboardPage() {
  const { t, locale } = useI18n();
  const { user, profile } = useAuth();
  const [dashboard, setDashboard] = useState<LecturerDashboardData | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const greetingName = firstName(resolveDisplayName(profile, user));

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await user.getIdToken();
        const data = await fetchLecturerDashboard(token);
        if (!cancelled) {
          setDashboard(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Could not load dashboard",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const loading = user != null && dashboard == null && error == null;

  const studentTrend = useMemo(() => {
    if (!dashboard || dashboard.studentsThisMonth <= 0) return undefined;
    return {
      value: `+${NUMBER.format(dashboard.studentsThisMonth)} this month`,
      positive: true,
    };
  }, [dashboard]);

  const revenueTrend = useMemo(() => {
    if (!dashboard || dashboard.revenueMoMPercent == null) return undefined;
    return {
      value: formatTrend(dashboard.revenueMoMPercent, "% MoM"),
      positive: dashboard.revenueMoMPercent >= 0,
    };
  }, [dashboard]);

  const ratingValue =
    dashboard?.averageRating != null
      ? dashboard.averageRating.toFixed(1)
      : "—";

  return (
    <>
      <GradientHeader
        title={`${t("dashboard.welcome")}, ${greetingName}`}
        subtitle={t("lecturer.dashboard.subtitle")}
        actions={
          <Link
            href="/lecturer/create?new=1"
            className="btn bg-white text-brand-700 hover:bg-white/90"
          >
            <PlusIcon className="h-4 w-4" /> New course
          </Link>
        }
      />

      <LecturerOnboardingBanner />

      {error ? (
        <div className="card p-4 text-sm text-rose-700 bg-rose-50 border border-rose-100">
          {error}
        </div>
      ) : null}

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t("lecturer.stats.students")}
          value={
            loading
              ? "…"
              : NUMBER.format(dashboard?.totalStudents ?? 0)
          }
          icon={<UsersIcon className="h-5 w-5" />}
          trend={studentTrend}
        />
        <StatCard
          label={t("lecturer.stats.courses")}
          value={loading ? "…" : String(dashboard?.activeCourses ?? 0)}
          icon={<BookIcon className="h-5 w-5" />}
          tint="emerald"
        />
        <StatCard
          label={t("lecturer.stats.revenue")}
          value={
            loading
              ? "…"
              : NUMBER.format(dashboard?.totalRevenue ?? 0)
          }
          icon={<MoneyIcon className="h-5 w-5" />}
          tint="amber"
          trend={revenueTrend}
        />
        <StatCard
          label={t("lecturer.stats.rating")}
          value={loading ? "…" : ratingValue}
          icon={<StarIcon className="h-5 w-5" />}
          tint="rose"
        />
      </section>

      <section className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-ink-900 text-lg">
              Revenue (last 7 days)
            </h2>
            {dashboard?.revenueWeekChangePercent != null ? (
              <span
                className={`badge ${
                  dashboard.revenueWeekChangePercent >= 0
                    ? "badge-emerald"
                    : "badge-rose"
                }`}
              >
                {formatTrend(dashboard.revenueWeekChangePercent, "% vs last week")}
              </span>
            ) : null}
          </div>
          <RevenueChart
            days={dashboard?.revenueLast7Days ?? []}
            loading={loading}
            locale={locale}
          />
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-ink-900">Top students</h3>
            <Link
              href="/lecturer/students"
              className="text-xs font-semibold text-brand-700 hover:text-brand-900 inline-flex items-center gap-1"
            >
              {t("action.viewAll")} <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>
          {loading ? (
            <p className="text-sm text-ink-500">Loading…</p>
          ) : dashboard?.topStudents.length ? (
            <ul className="space-y-3">
              {dashboard.topStudents.map((s, i) => (
                <li key={s.studentId} className="flex items-center gap-3">
                  <span className="text-xs font-bold w-5 text-ink-400">
                    {i + 1}
                  </span>
                  <Avatar name={s.name} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink-900 truncate">
                      {s.name}
                    </div>
                    <div className="text-xs text-ink-500">
                      {s.hoursWatched > 0
                        ? `${s.hoursWatched}h watched`
                        : `${s.lessonsCompleted} lessons completed`}
                    </div>
                  </div>
                  <ChartIcon className="h-4 w-4 text-ink-300" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-500">
              No student activity yet. Enrollments and lesson progress will
              appear here.
            </p>
          )}
        </div>
      </section>

      <section className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-ink-900 text-lg">Your courses</h2>
          <Link
            href="/lecturer/courses/recorded"
            className="text-sm font-semibold text-brand-700 hover:text-brand-900 inline-flex items-center gap-1"
          >
            {t("action.viewAll")} <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
        {loading ? (
          <p className="text-sm text-ink-500">Loading courses…</p>
        ) : dashboard?.courses.length ? (
          <div className="overflow-x-auto -mx-2">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-ink-500">
                  <th className="px-2 py-3 font-semibold">Course</th>
                  <th className="px-2 py-3 font-semibold">Status</th>
                  <th className="px-2 py-3 font-semibold">Students</th>
                  <th className="px-2 py-3 font-semibold">Rating</th>
                  <th className="px-2 py-3 font-semibold text-right">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {dashboard.courses.map((c) => (
                  <tr key={c.id} className="hover:bg-ink-50 transition-colors">
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-3">
                        <CourseThumb
                          title={c.title}
                          thumbnailURL={c.thumbnailURL}
                        />
                        <div>
                          <div className="font-medium text-ink-900 line-clamp-1">
                            {c.title || "Untitled course"}
                          </div>
                          <div className="text-xs text-ink-500">
                            {c.lessonCount} lessons
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <StatusPill status={c.status} />
                    </td>
                    <td className="px-2 py-3 text-ink-700">
                      {NUMBER.format(c.students)}
                    </td>
                    <td className="px-2 py-3">
                      {c.rating != null ? (
                        <span className="inline-flex items-center gap-1 text-ink-700">
                          <StarIcon className="h-3.5 w-3.5 text-amber-500" />
                          {c.rating.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-right font-semibold text-ink-900">
                      {LKR.format(c.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-ink-500">
            You have not created any courses yet.{" "}
            <Link
              href="/lecturer/create?new=1"
              className="font-semibold text-brand-700 hover:text-brand-900"
            >
              Create your first course
            </Link>
            .
          </p>
        )}
      </section>
    </>
  );
}

function CourseThumb({
  title,
  thumbnailURL,
}: {
  title: string;
  thumbnailURL?: string;
}) {
  if (thumbnailURL) {
    return (
      <div className="relative h-9 w-14 rounded-md flex-shrink-0 overflow-hidden bg-ink-100">
        <Image
          src={thumbnailURL}
          alt={title || "Course thumbnail"}
          fill
          sizes="56px"
          className="object-cover"
          unoptimized
        />
      </div>
    );
  }

  return (
    <div className="h-9 w-14 rounded-md flex-shrink-0 brand-gradient opacity-80" />
  );
}

function StatusPill({ status }: { status: CourseStatus }) {
  const map: Record<CourseStatus, string> = {
    published: "badge-emerald",
    draft: "badge-slate",
    pending: "badge-amber",
    archived: "badge-slate",
  };
  return <span className={`badge ${map[status]}`}>{status}</span>;
}

function RevenueChart({
  days,
  loading,
  locale,
}: {
  days: { date: string; amount: number }[];
  loading: boolean;
  locale: string;
}) {
  const weekday = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { weekday: "short" }),
    [locale],
  );

  const values = days.map((d) => d.amount);
  const max = Math.max(...values, 1);

  if (loading) {
    return <p className="text-sm text-ink-500 h-48 flex items-center">Loading…</p>;
  }

  if (days.length === 0 || values.every((v) => v === 0)) {
    return (
      <p className="text-sm text-ink-500 h-48 flex items-center justify-center">
        No revenue in the last 7 days yet.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-end gap-3 h-48">
        {days.map((day) => (
          <div
            key={day.date}
            className="flex-1 flex flex-col items-center justify-end gap-2"
          >
            <div
              className="w-full rounded-t-lg brand-gradient transition-all relative group min-h-[4px]"
              style={{ height: `${Math.max((day.amount / max) * 100, 4)}%` }}
            >
              <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-xs font-bold text-ink-900 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {LKR.format(day.amount)}
              </span>
            </div>
            <div className="text-xs text-ink-500">
              {weekday.format(new Date(`${day.date}T12:00:00`))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
