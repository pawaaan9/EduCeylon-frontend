"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CourseCard } from "@/components/CourseCard";
import { SectionHeader } from "@/components/SectionHeader";
import { ArrowRightIcon } from "@/components/icons";
import { fetchPublicCourses } from "@/lib/api/public-courses";
import type { Course } from "@/lib/data/types";
import { useT } from "@/lib/i18n/I18nProvider";

export function FeaturedCoursesSection({ limit = 6 }: { limit?: number }) {
  const t = useT();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const all = await fetchPublicCourses();
        if (!cancelled) setCourses(all.slice(0, limit));
      } catch {
        if (!cancelled) setCourses([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  return (
    <section>
      <SectionHeader
        eyebrow="Featured"
        title={t("home.featured.title")}
        subtitle={t("home.featured.subtitle")}
        action={
          <Link
            href="/courses"
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-900"
          >
            {t("home.featured.viewAll")}
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        }
      />
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: Math.min(limit, 3) }).map((_, i) => (
            <div
              key={i}
              className="aspect-[4/5] rounded-2xl border border-ink-200 bg-ink-50 animate-pulse"
            />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <p className="text-sm text-ink-500">{t("home.featured.empty")}</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </section>
  );
}
