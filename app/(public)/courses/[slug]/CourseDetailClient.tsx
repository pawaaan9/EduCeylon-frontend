"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { Avatar } from "@/components/Avatar";
import { CourseReviewsSection } from "@/components/CourseReviewsSection";
import {
  CheckCircleIcon,
  ClockIcon,
  HeartIcon,
  PlayCircleIcon,
  StarIcon,
  UsersIcon,
} from "@/components/icons";
import {
  checkMyEnrollment,
  enrollInCourse,
} from "@/lib/api/enrollments";
import { useAuth } from "@/lib/firebase/AuthProvider";
import type { Course, Lecturer } from "@/lib/data/types";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const LKR = new Intl.NumberFormat("en-LK", {
  style: "currency",
  currency: "LKR",
  maximumFractionDigits: 0,
});

type Tab = "about" | "curriculum" | "reviews";

export function CourseDetailClient({
  course,
  lecturer,
}: {
  course: Course;
  lecturer: Lecturer | null;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname() ?? `/courses/${course.slug}`;
  const searchParams = useSearchParams();
  const { user, profile, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("about");
  const [ratingStats, setRatingStats] = useState({
    rating: course.rating,
    reviews: course.reviews,
  });
  const [enrolled, setEnrolled] = useState(false);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [checkingEnrollment, setCheckingEnrollment] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const title = course.title[locale] ?? course.title.en;
  const longDesc = course.longDescription[locale] ?? course.longDescription.en;

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    if (requestedTab === "about" || requestedTab === "curriculum" || requestedTab === "reviews") {
      setTab(requestedTab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (authLoading || !user || profile?.role !== "student") {
      setEnrolled(false);
      return;
    }
    let cancelled = false;
    setCheckingEnrollment(true);
    void (async () => {
      try {
        const token = await user.getIdToken();
        const isEnrolled = await checkMyEnrollment(token, course.id);
        if (!cancelled) setEnrolled(isEnrolled);
      } catch {
        if (!cancelled) setEnrolled(false);
      } finally {
        if (!cancelled) setCheckingEnrollment(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, profile?.role, course.id]);

  const handleReviewSummaryChange = useCallback(
    (summary: { averageRating: number; count: number }) => {
      setRatingStats({
        rating: summary.averageRating,
        reviews: summary.count,
      });
    },
    [],
  );

  function openEnrollConfirm() {
    setEnrollError(null);
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (profile?.role !== "student") {
      setEnrollError(t("course.enrollStudentsOnly"));
      return;
    }
    setConfirmOpen(true);
  }

  async function handleEnrollConfirm() {
    if (!user) return;
    setEnrollLoading(true);
    setEnrollError(null);
    try {
      const token = await user.getIdToken();
      await enrollInCourse(token, course.id);
      setConfirmOpen(false);
      router.push("/student/courses");
    } catch (e) {
      setEnrollError(e instanceof Error ? e.message : t("course.enrollFailed"));
      setConfirmOpen(false);
    } finally {
      setEnrollLoading(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 flex flex-col gap-6 min-w-0">
        <div
          className="aspect-[16/9] w-full rounded-2xl shadow-card relative overflow-hidden"
          style={
            course.thumbnailURL
              ? undefined
              : { background: course.thumbnailGradient }
          }
        >
          {course.thumbnailURL ? (
            <Image
              src={course.thumbnailURL}
              alt={title}
              fill
              sizes="(max-width: 1024px) 100vw, 768px"
              className="object-cover"
              unoptimized
              priority
            />
          ) : null}
          <button className="absolute inset-0 flex items-center justify-center text-white hover:scale-105 transition-transform">
            <PlayCircleIcon className="h-20 w-20 drop-shadow-2xl" />
          </button>
          <div className="absolute top-4 left-4 flex gap-2">
            <span className="badge bg-white/95 text-brand-700">
              {t(`category.${course.category}`)}
            </span>
            <span
              className={`badge ${
                course.type === "live"
                  ? "badge-rose"
                  : course.type === "hybrid"
                  ? "badge-amber"
                  : "badge-slate"
              }`}
            >
              {t(`type.${course.type}`)}
            </span>
          </div>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink-900">
          {title}
        </h1>

        <div className="flex flex-wrap items-center gap-5 text-sm text-ink-600">
          <span className="inline-flex items-center gap-1.5">
            <StarIcon className="h-4 w-4 text-amber-500" />
            <strong className="text-ink-900">
              {ratingStats.reviews > 0 ? ratingStats.rating.toFixed(1) : "—"}
            </strong>
            ({ratingStats.reviews} {t("course.reviews").toLowerCase()})
          </span>
          <span className="inline-flex items-center gap-1.5">
            <UsersIcon className="h-4 w-4" />
            {course.students.toLocaleString()} {t("course.students")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <PlayCircleIcon className="h-4 w-4" /> {course.lessons} {t("course.lessons")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ClockIcon className="h-4 w-4" /> {course.hours} {t("course.hours")}
          </span>
        </div>

        <div className="flex items-center gap-3 p-4 rounded-2xl border border-ink-200 bg-white">
          <Avatar
            name={course.lecturer.name}
            src={lecturer?.photoURL}
            size={48}
          />
          <div className="min-w-0 flex-1">
            <div className="text-xs text-ink-500">{t("course.lecturer")}</div>
            <Link
              href={`/lecturers/${course.lecturer.slug}`}
              className="font-semibold text-ink-900 hover:text-brand-700"
            >
              {course.lecturer.name}
            </Link>
            <div className="text-xs text-ink-500">{course.lecturer.title}</div>
          </div>
          <Link
            href={`/lecturers/${course.lecturer.slug}`}
            className="btn btn-secondary hidden sm:inline-flex"
          >
            {t("lecturers.viewProfile")}
          </Link>
        </div>

        <div className="flex items-center gap-2 border-b border-ink-200">
          {(["about", "curriculum", "reviews"] as const).map((id) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === id
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-ink-600 hover:text-ink-900"
              }`}
            >
              {t(`course.${id}`)}
            </button>
          ))}
        </div>

        <div>
          {tab === "about" && (
            <div className="prose max-w-none text-ink-700 leading-relaxed">
              <p>{longDesc}</p>
            </div>
          )}
          {tab === "curriculum" && (
            <div className="flex flex-col gap-4">
              {course.modules.map((m, idx) => (
                <details
                  key={m.id}
                  className="card p-4 group"
                  open={idx === 0}
                >
                  <summary className="cursor-pointer flex items-center justify-between font-semibold text-ink-900">
                    <span>
                      {idx + 1}. {m.title[locale] ?? m.title.en}
                    </span>
                    <span className="text-xs text-ink-500 font-normal">
                      {m.lessons.length} {t("course.lessons")}
                    </span>
                  </summary>
                  <ul className="mt-3 divide-y divide-ink-100">
                    {m.lessons.map((l) => (
                      <li
                        key={l.id}
                        className="flex items-center gap-3 py-2.5 text-sm text-ink-700"
                      >
                        <PlayCircleIcon className="h-4 w-4 text-ink-400" />
                        <span className="flex-1">{l.title[locale] ?? l.title.en}</span>
                        {l.preview && (
                          <span className="badge badge-emerald">{t("course.preview")}</span>
                        )}
                        <span className="text-xs text-ink-500">{l.durationMin} min</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          )}
          {tab === "reviews" && (
            <CourseReviewsSection
              courseSlug={course.slug}
              initialSummary={{
                averageRating: ratingStats.rating,
                count: ratingStats.reviews,
              }}
              enrolled={enrolled}
              onSummaryChange={handleReviewSummaryChange}
            />
          )}
        </div>
      </div>

      <aside className="lg:col-span-1">
        <div className="card p-6 sticky top-20 flex flex-col gap-4">
          <div>
            <div className="text-3xl font-bold text-brand-700">
              {course.price > 0
                ? LKR.format(course.price)
                : t("lecturer.create.access.free")}
            </div>
            {course.price > 0 && (
              <div className="text-xs text-ink-500 mt-1">
                One-time purchase · lifetime access
              </div>
            )}
          </div>
          {enrollError && (
            <p className="text-sm text-rose-600" role="alert">
              {enrollError}
            </p>
          )}
          {enrolled ? (
            <Link
              href={`/student/courses/${course.slug}/learn`}
              className="btn btn-primary justify-center w-full"
            >
              <CheckCircleIcon className="h-4 w-4" />
              {t("student.study.continueLearning")}
            </Link>
          ) : (
            <button
              type="button"
              onClick={openEnrollConfirm}
              disabled={enrollLoading || checkingEnrollment}
              className="btn btn-primary justify-center w-full disabled:opacity-60"
            >
              {t("course.enroll")}
            </button>
          )}
          <button className="btn btn-secondary justify-center w-full">
            <HeartIcon className="h-4 w-4" /> {t("student.nav.wishlist")}
          </button>
          <div className="mt-2">
            <div className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-2">
              {t("course.includes")}
            </div>
            <ul className="text-sm text-ink-700 space-y-2">
              {[
                "course.includes.videos",
                "course.includes.pdfs",
                "course.includes.quizzes",
                "course.includes.live",
                "course.includes.certificate",
              ].map((k) => (
                <li key={k} className="flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 text-brand-600 flex-shrink-0" />
                  <span>{t(k)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>

      {confirmOpen && (
        <ConfirmDialog
          title={t("course.enrollConfirm.title")}
          description={
            <>
              {t("course.enrollConfirm.description")}{" "}
              <strong className="text-ink-900">{title}</strong>?
            </>
          }
          confirmLabel={
            enrollLoading ? t("course.enrolling") : t("course.enrollConfirm.confirm")
          }
          cancelLabel={t("action.cancel")}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => void handleEnrollConfirm()}
          loading={enrollLoading}
        />
      )}
    </div>
  );
}
