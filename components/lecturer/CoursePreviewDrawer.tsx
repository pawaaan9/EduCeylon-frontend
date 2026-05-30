"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type TransitionEvent,
} from "react";
import { createPortal } from "react-dom";
import { Avatar } from "@/components/Avatar";
import { StarRating } from "@/components/StarRating";
import {
  BookIcon,
  CalendarIcon,
  ClockIcon,
  CloseIcon,
  PlayCircleIcon,
  StarIcon,
} from "@/components/icons";
import { fetchCourseReviews } from "@/lib/api/course-reviews";
import type { CourseStatus, LecturerCourse, LessonType } from "@/lib/courses/types";
import { isPublishedVisibility } from "@/lib/courses/types";
import type { CourseReview } from "@/lib/data/types";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  formatScheduleDuration,
  formatTimeRange12,
  scheduleDurationMinutes,
} from "@/lib/time/format";

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

type Tab = "about" | "curriculum" | "reviews";

const PANEL_MS = 550;

export function CoursePreviewDrawer({
  course,
  open,
  onClose,
  t,
}: {
  course: LecturerCourse;
  open: boolean;
  onClose: () => void;
  t: (key: string) => string;
}) {
  const { locale } = useI18n();
  const [tab, setTab] = useState<Tab>("about");
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  const [reviews, setReviews] = useState<CourseReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);

  const { totalLessons, totalMinutes } = useMemo(() => {
    let lessons = 0;
    let minutes = 0;
    for (const mod of course.modules) {
      for (const lesson of mod.lessons) {
        lessons += 1;
        minutes += lesson.durationMinutes ?? 15;
      }
    }
    return { totalLessons: lessons, totalMinutes: minutes };
  }, [course.modules]);

  const rating =
    course.reviewCount && course.reviewCount > 0 && course.ratingSum != null
      ? course.ratingSum / course.reviewCount
      : null;

  const priceLabel =
    course.accessType === "free" || !course.price
      ? t("lecturer.create.access.free")
      : course.discountPrice != null && course.discountPrice > 0
        ? LKR.format(course.discountPrice)
        : LKR.format(course.price);

  const showPublicLink =
    course.status === "published" &&
    isPublishedVisibility(course.visibility) &&
    Boolean(course.slug?.trim());

  const canLoadReviews = showPublicLink && Boolean(course.slug);

  useEffect(() => setPortalReady(true), []);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setShown(true));
      });
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
  }, [open]);

  const handlePanelTransitionEnd = useCallback(
    (e: TransitionEvent<HTMLElement>) => {
      if (e.target !== e.currentTarget || e.propertyName !== "transform") return;
      if (!shown) setMounted(false);
    },
    [shown],
  );

  useEffect(() => {
    if (shown || !mounted) return;
    const id = window.setTimeout(() => setMounted(false), PANEL_MS + 80);
    return () => clearTimeout(id);
  }, [shown, mounted]);

  useEffect(() => {
    if (!mounted) return;
    setTab("about");
    setReviews([]);
    setReviewsLoaded(false);
    setReviewsError(null);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [mounted, onClose]);

  useEffect(() => {
    if (!mounted || !canLoadReviews || !course.slug || reviewsLoaded || !shown) {
      return;
    }

    let cancelled = false;
    const delay = window.setTimeout(() => {
      setReviewsLoading(true);
      void (async () => {
        try {
          const payload = await fetchCourseReviews(course.slug!);
          if (!cancelled) {
            setReviews(payload.reviews);
            setReviewsError(null);
          }
        } catch (e) {
          if (!cancelled) {
            setReviewsError(
              e instanceof Error ? e.message : t("course.reviews.error"),
            );
          }
        } finally {
          if (!cancelled) {
            setReviewsLoading(false);
            setReviewsLoaded(true);
          }
        }
      })();
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(delay);
    };
  }, [mounted, canLoadReviews, course.slug, reviewsLoaded, shown, t]);

  if (!mounted || !portalReady) return null;

  const state = shown ? "open" : "closed";

  const drawer = (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
      <div
        className="preview-drawer-backdrop absolute inset-0 bg-black/40"
        data-state={state}
        aria-hidden
        onClick={onClose}
      />
      <aside
        className="preview-drawer-panel absolute right-0 top-0 flex h-full w-[min(28rem,92vw)] flex-col bg-white shadow-2xl"
        data-state={state}
        onTransitionEnd={handlePanelTransitionEnd}
      >
        <div
          className="preview-drawer-header flex shrink-0 items-center gap-3 border-b border-ink-200 px-5 py-4"
          data-state={state}
        >
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-ink-900">
              {t("lecturer.courses.previewTitle")}
            </h2>
            <p className="text-xs text-ink-500 truncate">
              {course.title.trim() || t("lecturer.courses.untitled")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-ink-100 transition-colors"
            aria-label={t("action.cancel")}
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin overscroll-contain">
          <div className="preview-drawer-body" data-state={state}>
          <div
            className="preview-drawer-hero aspect-[16/9] relative bg-ink-100 overflow-hidden"
            data-state={state}
          >
            {course.thumbnailURL ? (
              <Image
                src={course.thumbnailURL}
                alt={course.title || t("lecturer.courses.untitled")}
                fill
                sizes="448px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="preview-drawer-hero-fallback absolute inset-0 brand-gradient opacity-90" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            {rating != null ? (
              <div className="absolute bottom-3 left-3 right-3">
                <RatingChip
                  rating={rating}
                  count={course.reviewCount ?? 0}
                  t={t}
                />
              </div>
            ) : null}
          </div>

          <div className="p-5 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`badge ${STATUS_BADGE[course.status]}`}>
                {t(`lecturer.courses.status${capitalize(course.status)}`)}
              </span>
              <span className="badge badge-slate">
                {course.courseType === "live"
                  ? t("lecturer.courses.liveClass")
                  : t("type.recorded")}
              </span>
              <span className="badge badge-slate">
                {course.accessType === "paid"
                  ? t("lecturer.create.access.paid")
                  : t("lecturer.create.access.free")}
              </span>
            </div>

            <div>
              <h3 className="text-xl font-bold text-ink-900">
                {course.title.trim() || t("lecturer.courses.untitled")}
              </h3>
              {course.subtitle?.trim() ? (
                <p className="mt-1 text-sm text-ink-600">{course.subtitle}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-ink-600">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-50 px-3 py-1.5">
                <PlayCircleIcon className="h-4 w-4 text-brand-600" />
                {totalLessons} {t("course.lessons")}
              </span>
              {totalMinutes > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-50 px-3 py-1.5">
                  <ClockIcon className="h-4 w-4 text-brand-600" />
                  {Math.max(1, Math.round(totalMinutes / 60))}{" "}
                  {t("course.hours")}
                </span>
              ) : null}
            </div>

            <div className="rounded-xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white px-4 py-3">
              <div className="text-2xl font-bold text-brand-700">{priceLabel}</div>
              {course.accessType === "paid" &&
              course.discountPrice != null &&
              course.price != null &&
              course.discountPrice < course.price ? (
                <div className="text-xs text-ink-500 line-through mt-0.5">
                  {LKR.format(course.price)}
                </div>
              ) : null}
            </div>

            {course.status !== "published" ? (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                {t("lecturer.courses.previewDraft")}
              </p>
            ) : null}

            {course.courseType === "live" &&
            course.weeklySchedule &&
            course.weeklySchedule.length > 0 ? (
              <div className="rounded-xl border border-ink-200 p-4">
                <h4 className="text-sm font-semibold text-ink-900 mb-3 inline-flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {t("lecturer.create.schedule.title")}
                </h4>
                <ul className="space-y-2">
                  {course.weeklySchedule.map((slot) => {
                    const duration = scheduleDurationMinutes(
                      slot.startTime,
                      slot.endTime,
                    );
                    return (
                      <li
                        key={slot.id}
                        className="text-sm text-ink-700 rounded-lg bg-ink-50 px-3 py-2"
                      >
                        <div className="font-medium text-ink-900">
                          {slot.title.trim() ||
                            t(`lecturer.create.day.${slot.day}`)}
                        </div>
                        <div className="text-xs text-ink-500 mt-0.5">
                          {t(`lecturer.create.day.${slot.day}`)} ·{" "}
                          {formatTimeRange12(slot.startTime, slot.endTime)}
                          {duration != null &&
                            ` · ${formatScheduleDuration(duration)}`}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <div className="flex items-center gap-1 border-b border-ink-200">
              {(["about", "curriculum", "reviews"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    tab === id
                      ? "border-brand-600 text-brand-700"
                      : "border-transparent text-ink-600 hover:text-ink-900"
                  }`}
                >
                  {t(`course.${id}`)}
                  {id === "reviews" && (course.reviewCount ?? 0) > 0 ? (
                    <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-100 px-1.5 text-[10px] font-bold text-brand-700">
                      {course.reviewCount}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            <div
              key={tab}
              className="preview-drawer-tab-panel"
            >
              {tab === "about" ? (
                <div className="text-sm text-ink-700 leading-relaxed whitespace-pre-wrap">
                  {course.description?.trim() ? (
                    course.description
                  ) : (
                    <p className="text-ink-500 italic">—</p>
                  )}
                </div>
              ) : null}

              {tab === "curriculum" ? (
                <div className="flex flex-col gap-3">
                  {course.modules.length === 0 ? (
                    <p className="text-sm text-ink-500">
                      {t("lecturer.create.module.empty")}
                    </p>
                  ) : (
                    course.modules.map((mod, idx) => (
                      <details
                        key={mod.id}
                        className="rounded-xl border border-ink-200 p-3"
                        open={idx === 0}
                      >
                        <summary className="cursor-pointer flex items-center justify-between font-semibold text-sm text-ink-900">
                          <span>
                            {idx + 1}.{" "}
                            {mod.title.trim() ||
                              t("lecturer.create.module.title")}
                          </span>
                          <span className="text-xs text-ink-500 font-normal">
                            {mod.lessons.length} {t("course.lessons")}
                          </span>
                        </summary>
                        {mod.lessons.length > 0 ? (
                          <ul className="mt-2 divide-y divide-ink-100">
                            {mod.lessons.map((lesson) => (
                              <li
                                key={lesson.id}
                                className="flex items-center gap-2.5 py-2 text-sm text-ink-700"
                              >
                                <LessonTypeIcon type={lesson.type} />
                                <span className="flex-1 min-w-0 truncate">
                                  {lesson.title.trim() ||
                                    t("lecturer.create.lesson.title")}
                                </span>
                                {lesson.freePreview ? (
                                  <span className="badge badge-emerald shrink-0">
                                    {t("course.preview")}
                                  </span>
                                ) : null}
                                {lesson.durationMinutes ? (
                                  <span className="text-xs text-ink-500 shrink-0">
                                    {lesson.durationMinutes} min
                                  </span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {mod.quiz && mod.quiz.questions.length > 0 ? (
                          <div className="mt-2 text-xs text-ink-500 px-1">
                            + {t("lecturer.create.quiz.moduleHeading")} (
                            {mod.quiz.questions.length})
                          </div>
                        ) : null}
                      </details>
                    ))
                  )}
                  {course.finalQuiz && course.finalQuiz.questions.length > 0 ? (
                    <div className="rounded-xl border border-dashed border-ink-200 px-3 py-2 text-sm text-ink-600">
                      {t("lecturer.create.quiz.courseHeading")} ·{" "}
                      {course.finalQuiz.questions.length}{" "}
                      {t("lecturer.create.quiz.question")}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {tab === "reviews" ? (
                <PreviewReviewsPanel
                  reviews={reviews}
                  loading={reviewsLoading}
                  error={reviewsError}
                  canLoad={canLoadReviews}
                  averageRating={rating}
                  reviewCount={course.reviewCount ?? 0}
                  locale={locale}
                  t={t}
                />
              ) : null}
            </div>

            {showPublicLink ? (
              <div className="pt-2">
                <Link
                  href={`/courses/${course.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary w-full justify-center text-sm"
                >
                  {t("lecturer.courses.viewPublic")}
                </Link>
              </div>
            ) : null}
          </div>
          </div>
        </div>
      </aside>
    </div>
  );

  return createPortal(drawer, document.body);
}

function RatingChip({
  rating,
  count,
  t,
}: {
  rating: number;
  count: number;
  t: (key: string) => string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 shadow-sm backdrop-blur-sm">
      <StarIcon className="h-4 w-4 text-amber-500" />
      <span className="text-sm font-bold text-ink-900 tabular-nums">
        {rating.toFixed(1)}
      </span>
      <span className="text-xs text-ink-500">
        · {count} {t("course.reviews").toLowerCase()}
      </span>
    </div>
  );
}

function PreviewReviewsPanel({
  reviews,
  loading,
  error,
  canLoad,
  averageRating,
  reviewCount,
  locale,
  t,
}: {
  reviews: CourseReview[];
  loading: boolean;
  error: string | null;
  canLoad: boolean;
  averageRating: number | null;
  reviewCount: number;
  locale: string;
  t: (key: string) => string;
}) {
  const distribution = useMemo(() => {
    const counts = [5, 4, 3, 2, 1].map(
      (star) => reviews.filter((r) => r.rating === star).length,
    );
    const max = Math.max(...counts, 1);
    return { counts, max };
  }, [reviews]);

  if (!canLoad) {
    return (
      <p className="text-sm text-ink-500 text-center py-6">
        {t("lecturer.courses.previewReviewsUnavailable")}
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-rose-600 text-center py-6" role="alert">
        {error}
      </p>
    );
  }

  if (reviewCount === 0 && reviews.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-200 bg-ink-50/50 px-4 py-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
          <StarIcon className="h-6 w-6 text-amber-400" />
        </div>
        <p className="mt-3 font-medium text-ink-800">
          {t("course.reviews.noReviewsYet")}
        </p>
        <p className="mt-1 text-xs text-ink-500">
          {t("course.reviews.emptyHint")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-gradient-to-br from-amber-50 via-white to-brand-50 p-4 ring-1 ring-amber-100/80">
        <div className="flex items-center gap-4">
          <div className="text-center shrink-0">
            <p className="text-4xl font-bold tabular-nums text-ink-900 leading-none">
              {averageRating != null ? averageRating.toFixed(1) : "—"}
            </p>
            <StarRating
              value={averageRating ?? 0}
              readOnly
              size="sm"
              label={t("course.reviews.average")}
            />
            <p className="mt-1 text-xs text-ink-500">
              {t("course.reviews.count").replace(
                "{count}",
                String(reviewCount || reviews.length),
              )}
            </p>
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            {[5, 4, 3, 2, 1].map((star, i) => {
              const count = distribution.counts[i];
              const width = `${Math.round((count / distribution.max) * 100)}%`;
              return (
                <div key={star} className="flex items-center gap-2 text-xs">
                  <span className="w-3 tabular-nums text-ink-500">{star}</span>
                  <StarIcon className="h-3 w-3 text-amber-400 shrink-0" />
                  <div className="h-1.5 flex-1 rounded-full bg-ink-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all duration-500"
                      style={{ width }}
                    />
                  </div>
                  <span className="w-4 tabular-nums text-ink-400 text-right">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <ul className="flex flex-col gap-3">
        {reviews.map((review) => (
          <li
            key={review.id}
            className="relative rounded-xl border border-ink-100 bg-white p-3.5 shadow-sm"
          >
            <span
              className="absolute left-4 top-3 text-2xl leading-none text-brand-100 select-none"
              aria-hidden
            >
              “
            </span>
            <div className="flex items-start gap-3 pl-1">
              <Avatar
                name={review.studentName}
                src={review.studentPhotoURL}
                size={36}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-semibold text-ink-900 truncate">
                    {review.studentName}
                  </span>
                  <StarRating value={review.rating} readOnly size="sm" />
                </div>
                <p className="mt-1.5 text-sm text-ink-600 leading-relaxed line-clamp-4">
                  {review.comment}
                </p>
                <time
                  dateTime={review.createdAt}
                  className="mt-2 block text-[11px] text-ink-400"
                >
                  {formatReviewDate(review.createdAt, locale)}
                </time>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatReviewDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function LessonTypeIcon({ type }: { type: LessonType }) {
  if (type === "pdf") {
    return <BookIcon className="h-4 w-4 text-ink-400 shrink-0" />;
  }
  if (type === "live") {
    return <CalendarIcon className="h-4 w-4 text-ink-400 shrink-0" />;
  }
  return <PlayCircleIcon className="h-4 w-4 text-ink-400 shrink-0" />;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
