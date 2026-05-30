"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CourseCard } from "@/components/CourseCard";
import { GradientHeader } from "@/components/GradientHeader";
import { fetchMyEnrolledCourses } from "@/lib/api/enrollments";
import type { Course } from "@/lib/data/types";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useT } from "@/lib/i18n/I18nProvider";

export default function StudentCoursesPage() {
  const t = useT();
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await user.getIdToken();
        const list = await fetchMyEnrolledCourses(token);
        if (!cancelled) {
          setCourses(list);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load courses");
          setCourses([]);
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
        title={t("student.nav.myCourses")}
        subtitle={t("student.courses.subtitle")}
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
        <div className="mt-6 card p-10 text-center">
          <h2 className="text-lg font-semibold text-ink-900">
            {t("student.courses.empty.title")}
          </h2>
          <p className="mt-2 text-sm text-ink-500 max-w-md mx-auto">
            {t("student.courses.empty.subtitle")}
          </p>
          <Link href="/courses" className="btn btn-primary mt-6 inline-flex">
            {t("student.courses.browse")}
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((c) => (
            <CourseCard
              key={c.id}
              course={c}
              variant="enrolled"
              href={`/student/courses/${c.slug}/learn`}
            />
          ))}
        </div>
      )}
    </>
  );
}
