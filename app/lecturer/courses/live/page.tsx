"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GradientHeader } from "@/components/GradientHeader";
import { CalendarIcon, PlusIcon } from "@/components/icons";
import { listMyCourses } from "@/lib/api/courses";
import { listLecturerLiveSessionRows } from "@/lib/courses/live-sessions";
import type { CourseStatus, LecturerCourse } from "@/lib/courses/types";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useT } from "@/lib/i18n/I18nProvider";
import {
  formatScheduleDuration,
  formatTimeRange12,
  scheduleDurationMinutes,
} from "@/lib/time/format";

const STATUS_BADGE: Record<CourseStatus, string> = {
  draft: "badge-slate",
  pending: "badge-amber",
  published: "badge-emerald",
  archived: "badge-slate",
};

export default function LecturerLivePage() {
  const t = useT();
  const { user } = useAuth();
  const [courses, setCourses] = useState<LecturerCourse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await user.getIdToken();
        const list = await listMyCourses(token);
        if (!cancelled) {
          setCourses(list);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load live classes");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const rows = useMemo(
    () => listLecturerLiveSessionRows(courses ?? []),
    [courses],
  );

  return (
    <>
      <GradientHeader
        title={t("lecturer.nav.live")}
        subtitle={t("lecturer.live.subtitle")}
        actions={
          <Link
            href="/lecturer/create?new=1"
            className="btn bg-white text-brand-700 hover:bg-white/90"
          >
            <PlusIcon className="h-4 w-4" /> {t("lecturer.live.new")}
          </Link>
        }
      />

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700"
        >
          {error}
        </div>
      )}

      {courses === null ? (
        <div className="mt-6 card p-10 text-center text-sm text-ink-500">
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-6 card divide-y divide-ink-100">
          {rows.map((row) => {
            const key = row.slot
              ? `${row.courseId}-${row.slot.id}`
              : `${row.courseId}-empty`;
            const duration =
              row.slot &&
              scheduleDurationMinutes(row.slot.startTime, row.slot.endTime);

            return (
              <div key={key} className="flex items-center gap-4 p-5">
                <div className="h-12 w-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                  <CalendarIcon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink-900 line-clamp-1">
                      {row.courseTitle}
                    </span>
                    <span className={`badge ${STATUS_BADGE[row.courseStatus]}`}>
                      {t(
                        `lecturer.courses.status${capitalize(row.courseStatus)}`,
                      )}
                    </span>
                  </div>
                  {row.slot ? (
                    <>
                      {row.slot.title.trim() && (
                        <div className="text-sm text-ink-700 mt-0.5 line-clamp-1">
                          {row.slot.title}
                        </div>
                      )}
                      <div className="text-xs text-ink-500 mt-0.5">
                        {t(`lecturer.create.day.${row.slot.day}`)} ·{" "}
                        {formatTimeRange12(row.slot.startTime, row.slot.endTime)}
                        {duration != null &&
                          ` · ${formatScheduleDuration(duration)}`}
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-ink-500 mt-0.5">
                      {t("lecturer.create.schedule.empty")}
                    </div>
                  )}
                </div>
                <Link
                  href={`/lecturer/create?id=${encodeURIComponent(row.courseId)}`}
                  className="btn btn-secondary flex-shrink-0"
                >
                  {t("lecturer.courses.manage")}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function EmptyState() {
  const t = useT();
  return (
    <div className="mt-6 card p-10 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
        <CalendarIcon className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-ink-900">
        {t("lecturer.live.empty.title")}
      </h2>
      <p className="mt-1 text-sm text-ink-500 max-w-md mx-auto">
        {t("lecturer.live.empty.subtitle")}
      </p>
      <Link href="/lecturer/create?new=1" className="btn btn-primary mt-6 inline-flex">
        <PlusIcon className="h-4 w-4" /> {t("lecturer.live.new")}
      </Link>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
