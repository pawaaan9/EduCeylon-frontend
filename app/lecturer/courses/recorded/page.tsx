"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GradientHeader } from "@/components/GradientHeader";
import { LecturerCourseCard } from "@/components/lecturer/LecturerCourseCard";
import { PlayCircleIcon, PlusIcon } from "@/components/icons";
import { listMyCourses } from "@/lib/api/courses";
import type { LecturerCourse } from "@/lib/courses/types";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useT } from "@/lib/i18n/I18nProvider";

export default function LecturerRecordedPage() {
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
          setError(
            e instanceof Error ? e.message : "Could not load recorded series",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const recorded = useMemo(
    () => (courses ?? []).filter((c) => c.courseType === "recorded"),
    [courses],
  );

  return (
    <>
      <GradientHeader
        title={t("lecturer.nav.recorded")}
        subtitle={t("lecturer.recorded.subtitle")}
        actions={
          <Link
            href="/lecturer/create?new=1"
            className="btn bg-white text-brand-700 hover:bg-white/90"
          >
            <PlusIcon className="h-4 w-4" /> {t("lecturer.recorded.new")}
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
      ) : recorded.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {recorded.map((c) => (
            <LecturerCourseCard key={c.id} course={c} t={t} />
          ))}
        </div>
      )}
    </>
  );
}

function EmptyState() {
  const t = useT();
  return (
    <div className="mt-6 card p-10 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center">
        <PlayCircleIcon className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-ink-900">
        {t("lecturer.recorded.empty.title")}
      </h2>
      <p className="mt-1 text-sm text-ink-500 max-w-md mx-auto">
        {t("lecturer.recorded.empty.subtitle")}
      </p>
      <Link href="/lecturer/create?new=1" className="btn btn-primary mt-6 inline-flex">
        <PlusIcon className="h-4 w-4" /> {t("lecturer.recorded.new")}
      </Link>
    </div>
  );
}
