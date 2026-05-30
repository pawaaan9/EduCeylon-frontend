"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { StarRating } from "@/components/StarRating";
import { CheckCircleIcon, StarIcon } from "@/components/icons";
import {
  fetchCourseReviews,
  saveMyCourseReview,
} from "@/lib/api/course-reviews";
import type { CourseReview, CourseReviewSummary } from "@/lib/data/types";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";

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

export function CourseReviewsSection({
  courseSlug,
  initialSummary,
  enrolled,
  onSummaryChange,
}: {
  courseSlug: string;
  initialSummary: CourseReviewSummary;
  enrolled: boolean;
  onSummaryChange?: (summary: CourseReviewSummary) => void;
}) {
  const { t, locale } = useI18n();
  const { user, profile } = useAuth();

  const [summary, setSummary] = useState(initialSummary);
  const [reviews, setReviews] = useState<CourseReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const onSummaryChangeRef = useRef(onSummaryChange);
  onSummaryChangeRef.current = onSummaryChange;

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const isStudent = profile?.role === "student";
  const canReview = Boolean(user && isStudent && enrolled);

  const applySummary = useCallback((next: CourseReviewSummary) => {
    setSummary(next);
    onSummaryChangeRef.current?.(next);
  }, []);

  const loadReviews = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) setLoading(true);
      setLoadError(null);
      try {
        const payload = await fetchCourseReviews(courseSlug);
        setReviews(payload.reviews);
        applySummary(payload.summary);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : t("course.reviews.error"));
      } finally {
        setLoading(false);
      }
    },
    [applySummary, courseSlug, t],
  );

  const showListSpinner = loading && reviews.length === 0;

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !canReview) return;

    setFormError(null);
    if (rating < 1) {
      setFormError(t("course.reviews.ratingRequired"));
      return;
    }
    if (comment.trim().length < 10) {
      setFormError(t("course.reviews.commentTooShort"));
      return;
    }

    setSaving(true);
    try {
      const token = await user.getIdToken();
      const saved = await saveMyCourseReview(token, courseSlug, {
        rating,
        comment: comment.trim(),
      });
      setReviews((prev) =>
        prev.some((r) => r.id === saved.id) ? prev : [saved, ...prev],
      );
      setRating(0);
      setComment("");
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1800);
      await loadReviews({ silent: true });
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : t("course.reviews.error"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 ring-1 ring-amber-100">
              <StarIcon className="h-7 w-7 text-amber-500" />
            </div>
            <div>
              <p className="text-3xl font-bold tabular-nums text-ink-900">
                {summary.count > 0 ? summary.averageRating.toFixed(1) : "—"}
              </p>
              <StarRating
                value={summary.averageRating}
                readOnly
                size="sm"
                label={t("course.reviews.average")}
              />
            </div>
          </div>
          <div className="text-sm text-ink-600">
            {summary.count > 0
              ? t("course.reviews.count").replace(
                  "{count}",
                  String(summary.count),
                )
              : t("course.reviews.noReviewsYet")}
          </div>
        </div>
      </div>

      {canReview ? (
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="card p-5 sm:p-6 flex flex-col gap-4"
        >
          <div>
            <h3 className="text-base font-semibold text-ink-900">
              {t("course.reviews.writeTitle")}
            </h3>
            <p className="mt-1 text-sm text-ink-500">
              {t("course.reviews.writeSubtitle")}
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-ink-700">
              {t("course.reviews.yourRating")}
            </p>
            <StarRating value={rating} onChange={setRating} size="lg" />
          </div>

          <div>
            <label
              htmlFor="course-review-comment"
              className="mb-2 block text-sm font-medium text-ink-700"
            >
              {t("course.reviews.commentLabel")}
            </label>
            <textarea
              id="course-review-comment"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("course.reviews.commentPlaceholder")}
              className="textarea-base min-h-[112px]"
              maxLength={2000}
              disabled={saving}
            />
            <p className="mt-1 text-xs text-ink-400">
              {comment.trim().length}/2000
            </p>
          </div>

          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {t("course.reviews.submitNotice")}
          </p>

          {formError && (
            <p className="text-sm text-rose-600" role="alert">
              {formError}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className={`btn btn-primary disabled:opacity-60 ${
                savedFlash ? "bg-emerald-600 hover:bg-emerald-600" : ""
              }`}
            >
              {saving ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  {t("course.reviews.saving")}
                </>
              ) : savedFlash ? (
                <>
                  <CheckCircleIcon className="h-4 w-4" />
                  {t("course.reviews.saved")}
                </>
              ) : (
                t("course.reviews.submit")
              )}
            </button>
          </div>
        </form>
      ) : (
        <div className="card p-5 text-sm text-ink-600">
          {!user
            ? t("course.reviews.loginToReview")
            : !isStudent
              ? t("course.reviews.studentsOnly")
              : !enrolled
                ? t("course.reviews.enrollToReview")
                : null}
        </div>
      )}

      {showListSpinner ? (
        <div className="flex justify-center py-10">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
        </div>
      ) : loadError ? (
        <div className="card p-6 text-center text-sm text-rose-600" role="alert">
          {loadError}
        </div>
      ) : reviews.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-medium text-ink-800">{t("course.reviews.empty")}</p>
          <p className="mt-1 text-sm text-ink-500">{t("course.reviews.emptyHint")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
            {t("course.reviews.allTitle")}
          </h3>
          <ul className="flex flex-col gap-4">
            {reviews.map((review) => {
              const isMine = user?.uid === review.studentId;
              return (
                <li
                  key={review.id}
                  className={`card p-5 ${
                    isMine
                      ? "border-brand-200 bg-brand-50/30 ring-1 ring-brand-100"
                      : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar
                      name={review.studentName}
                      src={review.studentPhotoURL}
                      size={40}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-ink-900">
                              {review.studentName}
                            </p>
                            {isMine && (
                              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-800">
                                {t("course.reviews.yourReview")}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-ink-500">
                            {formatReviewDate(review.createdAt, locale)}
                          </p>
                        </div>
                        <StarRating value={review.rating} readOnly size="sm" />
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-ink-700 whitespace-pre-wrap">
                        {review.comment}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
