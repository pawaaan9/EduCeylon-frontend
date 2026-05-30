"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GradientHeader } from "@/components/GradientHeader";
import { StatCard } from "@/components/StatCard";
import {
  BoltIcon,
  ChartIcon,
  CheckCircleIcon,
  ClockIcon,
  ChevronRightIcon,
} from "@/components/icons";
import { fetchStudentProgress } from "@/lib/api/student-progress";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type {
  StudentProgressCourseRow,
  StudentProgressData,
} from "@/lib/student/progress-page";

const NUMBER = new Intl.NumberFormat("en-LK");

export default function ProgressPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [data, setData] = useState<StudentProgressData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await user.getIdToken();
        const next = await fetchStudentProgress(token);
        if (!cancelled) {
          setData(next);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load progress");
          setData(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const loading = user != null && data == null && error == null;
  const stats = data?.stats;
  const courses = data?.courses ?? [];

  const avgQuizLabel = useMemo(() => {
    if (stats?.averageQuizScore == null) return "—";
    return `${stats.averageQuizScore}%`;
  }, [stats?.averageQuizScore]);

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

  return (
    <>
      <GradientHeader
        title={t("student.nav.progress")}
        subtitle={t("student.progress.subtitle")}
      />

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t("student.progress.hoursWeek")}
          value={stats?.hoursThisWeek ?? 0}
          icon={<ClockIcon className="h-5 w-5" />}
        />
        <StatCard
          label={t("student.progress.lessonsCompleted")}
          value={NUMBER.format(stats?.lessonsCompleted ?? 0)}
          icon={<CheckCircleIcon className="h-5 w-5" />}
          tint="emerald"
        />
        <StatCard
          label={t("student.stats.streak")}
          value={
            (stats?.streakDays ?? 0) > 0
              ? t("student.stats.streakDays").replace(
                  "{days}",
                  String(stats?.streakDays ?? 0),
                )
              : "0"
          }
          icon={<BoltIcon className="h-5 w-5" />}
          tint="amber"
        />
        <StatCard
          label={t("student.progress.avgQuizScore")}
          value={avgQuizLabel}
          icon={<ChartIcon className="h-5 w-5" />}
          tint="rose"
        />
      </section>

      {courses.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-ink-500">{t("student.progress.empty")}</p>
          <Link href="/courses" className="btn btn-primary mt-4 inline-flex">
            {t("student.courses.browse")}
          </Link>
        </div>
      ) : (
        <section className="flex flex-col gap-4">
          {courses.map((course) => (
            <CourseProgressCard key={course.id} course={course} t={t} locale={locale} />
          ))}
        </section>
      )}
    </>
  );
}

function CourseProgressCard({
  course,
  t,
  locale,
}: {
  course: StudentProgressCourseRow;
  t: (key: string) => string;
  locale: string;
}) {
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale],
  );

  return (
    <details className="group card overflow-hidden open:ring-1 open:ring-brand-100">
      <summary className="flex cursor-pointer list-none items-center gap-4 p-4 hover:bg-ink-50/60 [&::-webkit-details-marker]:hidden">
        <div
          className="h-14 w-24 rounded-lg flex-shrink-0 overflow-hidden relative"
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
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-ink-900 line-clamp-1">
              {course.title}
            </h3>
            {course.completed ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                <CheckCircleIcon className="h-3 w-3" />
                {t("student.progress.courseCompleted")}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-ink-500 mt-0.5">{course.lecturerName}</p>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-ink-100 overflow-hidden">
              <div
                className="h-full brand-gradient"
                style={{ width: `${course.progressPercent}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-ink-700 w-10 text-right tabular-nums">
              {course.progressPercent}%
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-ink-500">
            {course.completedLessons}/{course.totalLessons} {t("course.lessons")}
            {course.hoursWatched > 0
              ? ` · ${course.hoursWatched}h ${t("student.stats.hours").toLowerCase()}`
              : ""}
          </p>
        </div>

        <ChevronRightIcon className="h-5 w-5 shrink-0 text-ink-400 transition-transform group-open:rotate-90" />
      </summary>

      <div className="border-t border-ink-100 px-4 pb-4 pt-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-ink-900">
            {t("student.progress.quizResults")}
          </h4>
          <Link
            href={`/student/courses/${course.slug}/learn`}
            className="text-xs font-semibold text-brand-700 hover:text-brand-900"
          >
            {t("student.study.continueLearning")}
          </Link>
        </div>

        {course.quizzes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ink-200 bg-ink-50 px-4 py-5 text-center text-sm text-ink-500">
            {t("student.progress.noQuizzes")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {course.quizzes.map((quiz) => (
              <li
                key={quiz.quizId}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${
                  quiz.passed
                    ? "border-emerald-200 bg-emerald-50/40"
                    : "border-amber-200 bg-amber-50/30"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink-900">{quiz.title}</p>
                  <p className="text-[11px] text-ink-500">
                    {quiz.scopeLabel} · {t("student.progress.submitted")}{" "}
                    {dateFormatter.format(new Date(quiz.submittedAt))}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-lg font-bold tabular-nums text-ink-900">
                      {quiz.scorePercent}%
                    </p>
                    <p className="text-[11px] text-ink-500">
                      {quiz.correctCount}/{quiz.totalQuestions}{" "}
                      {t("student.progress.correct")}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      quiz.passed
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {quiz.passed
                      ? t("student.progress.passed")
                      : t("student.progress.notPassed")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
