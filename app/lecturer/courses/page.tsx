"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { GradientHeader } from "@/components/GradientHeader";
import { BookIcon, EditIcon, PlusIcon } from "@/components/icons";
import { listMyCourses } from "@/lib/api/courses";
import type {
  CourseStatus,
  LecturerCourse,
} from "@/lib/courses/types";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useT } from "@/lib/i18n/I18nProvider";

const LKR = new Intl.NumberFormat("en-LK", {
  style: "currency",
  currency: "LKR",
  maximumFractionDigits: 0,
});

const STATUS_BADGE: Record<CourseStatus, string> = {
  draft: "badge-slate",
  pending: "badge-amber",
  published: "badge-emerald",
  archived: "badge-slate",
};

export default function LecturerCoursesPage() {
  const t = useT();
  const { user } = useAuth();
  const [courses, setCourses] = useState<LecturerCourse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        const list = await listMyCourses(token);
        if (!cancelled) {
          setCourses(list);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load courses");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <>
      <GradientHeader
        title={t("lecturer.nav.courses")}
        subtitle={t("lecturer.courses.subtitle")}
        actions={
          <Link
            href="/lecturer/create?new=1"
            className="btn bg-white text-brand-700 hover:bg-white/90"
          >
            <PlusIcon className="h-4 w-4" /> {t("lecturer.courses.new")}
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
      ) : courses.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((c) => (
            <CourseCard key={c.id} course={c} t={t} />
          ))}
        </div>
      )}
    </>
  );
}

function CourseCard({
  course,
  t,
}: {
  course: LecturerCourse;
  t: (key: string) => string;
}) {
  const totalLessons = course.modules.reduce(
    (acc, m) => acc + (m.lessons?.length ?? 0),
    0,
  );

  return (
    <div className="card overflow-hidden flex flex-col">
      <div className="aspect-[16/9] relative bg-ink-100">
        {course.thumbnailURL ? (
          <Image
            src={course.thumbnailURL}
            alt={course.title || t("lecturer.courses.untitled")}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)",
            }}
          />
        )}
      </div>
      <div className="p-5 flex flex-col gap-2 flex-1">
        <div className="flex items-center justify-between">
          <span className={`badge ${STATUS_BADGE[course.status]}`}>
            {t(`lecturer.courses.status${capitalize(course.status)}`)}
          </span>
          <span className="text-xs text-ink-500">
            {course.modules.length} {t("lecturer.courses.modules")} ·{" "}
            {totalLessons} {t("lecturer.courses.lessons")}
          </span>
        </div>
        <h3 className="font-semibold text-ink-900 line-clamp-2">
          {course.title.trim() || t("lecturer.courses.untitled")}
        </h3>
        {course.subtitle && (
          <p className="text-xs text-ink-500 line-clamp-2">{course.subtitle}</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-3 border-t border-ink-100">
          <div className="text-sm font-bold text-brand-700">
            {course.accessType === "free" || !course.price
              ? t("lecturer.create.access.free")
              : LKR.format(course.price)}
          </div>
          <Link
            href={`/lecturer/create?id=${encodeURIComponent(course.id)}`}
            className="btn btn-secondary btn-sm h-9 text-xs inline-flex items-center gap-1.5"
          >
            <EditIcon className="h-3.5 w-3.5" />
            {t("lecturer.courses.manage")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  const t = useT();
  return (
    <div className="mt-6 card p-10 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center">
        <BookIcon className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-ink-900">
        {t("lecturer.courses.empty.title")}
      </h2>
      <p className="mt-1 text-sm text-ink-500 max-w-md mx-auto">
        {t("lecturer.courses.empty.subtitle")}
      </p>
      <Link href="/lecturer/create?new=1" className="btn btn-primary mt-6 inline-flex">
        <PlusIcon className="h-4 w-4" /> {t("lecturer.courses.create")}
      </Link>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
