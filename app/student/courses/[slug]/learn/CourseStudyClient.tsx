"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { ProgressRing } from "@/components/ProgressRing";
import {
  BookIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CloseIcon,
  MenuIcon,
  PlayCircleIcon,
  StarIcon,
} from "@/components/icons";
import { QuizPlayer } from "@/components/study/QuizPlayer";
import {
  canMarkLessonComplete,
  canMarkModuleComplete,
  getLessonRequiredQuizIds,
  pendingQuizIds,
} from "@/lib/courses/quiz-requirements";
import {
  fetchStudyCourse,
  updateStudyProgress,
} from "@/lib/api/enrollments";
import type {
  CourseStudyProgress,
  QuizAttemptSummary,
  QuizSubmitResult,
  StudyCourseWithProgress,
  StudyLesson,
  StudyQuiz,
} from "@/lib/data/types";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";

type FlatLesson = {
  lesson: StudyLesson;
  moduleId: string;
  moduleTitle: string;
};

const EMPTY_PROGRESS: CourseStudyProgress = {
  completedLessonIds: [],
  completedModuleIds: [],
};

type SaveState = {
  key: string;
  phase: "loading" | "success";
};

type QuizBlockAlert =
  | { kind: "lesson"; lessonId: string; message: string }
  | { kind: "module"; moduleId: string; message: string };

function saveKey(type: "lesson" | "module", id: string) {
  return `${type}:${id}`;
}

function ActionSpinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      aria-hidden
    />
  );
}

function StudyAlertBanner({
  message,
  onDismiss,
  dismissLabel,
}: {
  message: string;
  onDismiss: () => void;
  dismissLabel: string;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm ring-1 ring-amber-100/80"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </span>
      <p className="min-w-0 flex-1 pt-1 text-sm leading-snug text-amber-950">
        {message}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-amber-700 transition-colors hover:bg-amber-100/80 hover:text-amber-900"
        aria-label={dismissLabel}
      >
        <CloseIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

function firstPlayableLesson(course: StudyCourseWithProgress): StudyLesson | null {
  for (const mod of course.modules) {
    for (const lesson of mod.lessons) {
      if (lesson.videoURL || lesson.pdfURL || lesson.externalURL) {
        return lesson;
      }
    }
  }
  return course.modules[0]?.lessons[0] ?? null;
}

export function CourseStudyClient({ slug }: { slug: string }) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [course, setCourse] = useState<StudyCourseWithProgress | null>(null);
  const [progress, setProgress] = useState<CourseStudyProgress>(EMPTY_PROGRESS);
  const [quizAttempts, setQuizAttempts] = useState<
    Record<string, QuizAttemptSummary>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [mobileLessonsOpen, setMobileLessonsOpen] = useState(false);
  const [quizBlockAlert, setQuizBlockAlert] = useState<QuizBlockAlert | null>(
    null,
  );
  const saveSuccessTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveBusy = saveState !== null;
  const isSaveLoading = (key: string) =>
    saveState?.key === key && saveState.phase === "loading";
  const isSaveSuccess = (key: string) =>
    saveState?.key === key && saveState.phase === "success";

  const completedLessons = useMemo(
    () => new Set(progress.completedLessonIds),
    [progress.completedLessonIds],
  );
  const completedModules = useMemo(
    () => new Set(progress.completedModuleIds),
    [progress.completedModuleIds],
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const token = await user.getIdToken();
        const data = await fetchStudyCourse(token, slug);
        if (!cancelled) {
          setCourse(data);
          setProgress(data.progress ?? EMPTY_PROGRESS);
          setQuizAttempts(data.quizAttempts ?? {});
          setActiveLessonId(firstPlayableLesson(data)?.id ?? null);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load course");
          setCourse(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, slug]);

  useEffect(() => {
    return () => {
      if (saveSuccessTimer.current) clearTimeout(saveSuccessTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!mobileLessonsOpen) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev;
    };
  }, [mobileLessonsOpen]);

  useEffect(() => {
    setQuizBlockAlert(null);
  }, [activeLessonId]);

  useEffect(() => {
    if (!quizBlockAlert) return;
    const timer = setTimeout(() => setQuizBlockAlert(null), 8000);
    return () => clearTimeout(timer);
  }, [quizBlockAlert]);

  const persistProgress = useCallback(
    async (
      payload:
        | { lessonId: string; completed: boolean }
        | { moduleId: string; completed: boolean },
      key: string,
    ) => {
      if (!user || saveState?.phase === "loading") return;
      if (saveSuccessTimer.current) clearTimeout(saveSuccessTimer.current);
      setSaveState({ key, phase: "loading" });
      try {
        const token = await user.getIdToken();
        const next = await updateStudyProgress(token, slug, payload);
        setProgress(next);
        setSaveState({ key, phase: "success" });
        saveSuccessTimer.current = setTimeout(() => {
          setSaveState((current) =>
            current?.key === key && current.phase === "success" ? null : current,
          );
        }, 1500);
      } catch {
        setSaveState(null);
      }
    },
    [user, slug, saveState?.phase],
  );

  const flatLessons = useMemo((): FlatLesson[] => {
    if (!course) return [];
    const items: FlatLesson[] = [];
    course.modules.forEach((mod) => {
      const moduleTitle = mod.title[locale] ?? mod.title.en;
      mod.lessons.forEach((lesson) => {
        items.push({ lesson, moduleId: mod.id, moduleTitle });
      });
    });
    return items;
  }, [course, locale]);

  const activeEntry = useMemo(
    () => flatLessons.find((e) => e.lesson.id === activeLessonId) ?? null,
    [flatLessons, activeLessonId],
  );

  const activeIndex = activeEntry
    ? flatLessons.findIndex((e) => e.lesson.id === activeEntry.lesson.id)
    : -1;

  const prevEntry = activeIndex > 0 ? flatLessons[activeIndex - 1] : null;
  const nextEntry =
    activeIndex >= 0 && activeIndex < flatLessons.length - 1
      ? flatLessons[activeIndex + 1]
      : null;

  const handleQuizSubmitted = useCallback(
    (result: QuizSubmitResult) => {
      setQuizAttempts((prev) => {
        const next = {
          ...prev,
          [result.quizId]: {
            quizId: result.quizId,
            scorePercent: result.scorePercent,
            passed: result.passed,
            submittedAt: result.submittedAt,
          },
        };

        if (course && activeLessonId && !completedLessons.has(activeLessonId)) {
          const canComplete = canMarkLessonComplete(
            course.modules,
            course.finalQuiz,
            activeLessonId,
            next,
          );
          if (canComplete) {
            setQuizBlockAlert(null);
            void persistProgress(
              { lessonId: activeLessonId, completed: true },
              saveKey("lesson", activeLessonId),
            );
          }
        }

        return next;
      });
    },
    [course, activeLessonId, completedLessons, persistProgress],
  );

  if (loading) {
    return (
      <div className="study-shell flex min-h-[320px] items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="study-shell p-8 text-center">
        <p className="text-sm text-rose-600" role="alert">
          {error ?? t("student.study.notFound")}
        </p>
        <Link href="/student/courses" className="btn btn-primary mt-4 inline-flex">
          {t("student.study.backToCourses")}
        </Link>
      </div>
    );
  }

  const title = course.title[locale] ?? course.title.en;
  const activeLesson = activeEntry?.lesson ?? null;
  const activeTitle = activeLesson
    ? activeLesson.title[locale] ?? activeLesson.title.en
    : null;
  const activeLessonDone = activeLesson
    ? completedLessons.has(activeLesson.id)
    : false;

  const activeLessonCanComplete = activeLesson
    ? canMarkLessonComplete(
        course.modules,
        course.finalQuiz,
        activeLesson.id,
        quizAttempts,
      )
    : true;

  const activeLessonPendingQuizCount = activeLesson
    ? pendingQuizIds(
        getLessonRequiredQuizIds(
          course.modules,
          course.finalQuiz,
          activeLesson.id,
        ),
        quizAttempts,
      ).length
    : 0;

  const progressPercent = progress.percent ?? 0;
  const totalLessons =
    progress.totalLessons ??
    course.modules.reduce((n, m) => n + m.lessons.length, 0);
  const completedLessonCount =
    progress.completedLessons ?? completedLessons.size;
  const moduleCount = course.modules.length;
  const completedModuleCount = completedModules.size;
  const activeLessonSaveKey = activeLesson
    ? saveKey("lesson", activeLesson.id)
    : null;

  const activeModule = activeEntry
    ? course.modules.find((m) => m.id === activeEntry.moduleId) ?? null
    : null;

  const isLastLessonInModule =
    activeModule && activeLesson
      ? activeModule.lessons[activeModule.lessons.length - 1]?.id ===
        activeLesson.id
      : false;

  const isLastLessonInCourse =
    flatLessons.length > 0 &&
    activeLesson?.id === flatLessons[flatLessons.length - 1]?.lesson.id;

  function handleMarkLessonClick() {
    if (!activeLesson || !activeLessonSaveKey) return;

    if (activeLessonDone) {
      setQuizBlockAlert(null);
      void persistProgress(
        { lessonId: activeLesson.id, completed: false },
        activeLessonSaveKey,
      );
      return;
    }

    if (!activeLessonCanComplete) {
      setQuizBlockAlert({
        kind: "lesson",
        lessonId: activeLesson.id,
        message:
          activeLessonPendingQuizCount > 1
            ? t("student.study.quizzesRequiredToComplete")
            : t("student.study.quizRequiredToComplete"),
      });
      return;
    }

    setQuizBlockAlert(null);
    void persistProgress(
      { lessonId: activeLesson.id, completed: true },
      activeLessonSaveKey,
    );
  }

  function handleMarkModuleClick(
    modId: string,
    modDone: boolean,
    modCanComplete: boolean,
  ) {
    const key = saveKey("module", modId);

    if (modDone) {
      setQuizBlockAlert(null);
      void persistProgress({ moduleId: modId, completed: false }, key);
      return;
    }

    if (!modCanComplete) {
      setQuizBlockAlert({
        kind: "module",
        moduleId: modId,
        message: t("student.study.moduleQuizRequired"),
      });
      return;
    }

    setQuizBlockAlert(null);
    void persistProgress({ moduleId: modId, completed: true }, key);
  }

  function renderQuizBlock(
    quiz: StudyQuiz,
    scope: "lesson" | "module" | "course",
    scopeId: string,
  ) {
    return (
      <QuizPlayer
        key={`${quiz.id}-${scope}-${scopeId}`}
        quiz={quiz}
        scope={scope}
        scopeId={scopeId}
        slug={slug}
        priorAttempt={quizAttempts[quiz.id]}
        onSubmitted={handleQuizSubmitted}
      />
    );
  }

  function selectLesson(id: string, closeMobile = false) {
    setActiveLessonId(id);
    if (closeMobile) setMobileLessonsOpen(false);
  }

  const renderSidebar = (closeOnSelect: boolean) => (
    <div className="flex flex-col gap-6">
      {course.modules.map((mod, modIdx) => {
        const modTitle = mod.title[locale] ?? mod.title.en;
        const modDone = completedModules.has(mod.id);
        const modDoneCount = mod.lessons.filter((l) =>
          completedLessons.has(l.id),
        ).length;
        const modCanComplete = canMarkModuleComplete(
          course.modules,
          course.finalQuiz,
          mod.id,
          quizAttempts,
        );

        return (
          <section key={mod.id}>
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <div>
                <h3 className="text-sm font-semibold text-ink-900">
                  {modIdx + 1}. {modTitle}
                </h3>
                <p className="text-xs text-ink-500">
                  {modDoneCount}/{mod.lessons.length} {t("course.lessons")}
                </p>
              </div>
              <button
                type="button"
                disabled={saveBusy}
                onClick={() =>
                  handleMarkModuleClick(mod.id, modDone, modCanComplete)
                }
                className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-900 disabled:cursor-not-allowed disabled:opacity-50"
                aria-busy={isSaveLoading(saveKey("module", mod.id))}
              >
                {isSaveLoading(saveKey("module", mod.id)) ? (
                  <>
                    <ActionSpinner />
                    {t("student.study.saving")}
                  </>
                ) : isSaveSuccess(saveKey("module", mod.id)) ? (
                  <>
                    <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-500" />
                    {t("student.study.saved")}
                  </>
                ) : modDone ? (
                  t("student.study.moduleDone")
                ) : (
                  t("student.study.markModuleDone")
                )}
              </button>
            </div>
            {quizBlockAlert?.kind === "module" &&
            quizBlockAlert.moduleId === mod.id ? (
              <div className="mb-2 px-1">
                <StudyAlertBanner
                  message={quizBlockAlert.message}
                  onDismiss={() => setQuizBlockAlert(null)}
                  dismissLabel={t("action.cancel")}
                />
              </div>
            ) : null}
            <ul className="flex flex-col gap-0.5">
              {mod.lessons.map((lesson) => {
                const isActive = lesson.id === activeLessonId;
                const isDone = completedLessons.has(lesson.id);
                const label = lesson.title[locale] ?? lesson.title.en;

                return (
                  <li key={lesson.id}>
                    <button
                      type="button"
                      onClick={() => selectLesson(lesson.id, closeOnSelect)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                        isActive
                          ? "border-l-[3px] border-brand-600 bg-brand-50 font-medium text-brand-900"
                          : isDone
                            ? "text-ink-600 hover:bg-ink-50"
                            : "text-ink-700 hover:bg-ink-50"
                      }`}
                    >
                      {isDone ? (
                        <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-500" />
                      ) : lesson.videoURL ? (
                        <PlayCircleIcon
                          className={`h-4 w-4 shrink-0 ${isActive ? "text-brand-600" : "text-ink-400"}`}
                        />
                      ) : (
                        <BookIcon
                          className={`h-4 w-4 shrink-0 ${isActive ? "text-brand-600" : "text-ink-400"}`}
                        />
                      )}
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                      {lesson.durationMin > 0 && (
                        <span className="shrink-0 text-xs text-ink-400">
                          {lesson.durationMin}m
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );

  return (
    <div className="study-shell flex flex-col overflow-hidden">
      {/* Course hero */}
      <header className="relative overflow-hidden border-b border-brand-900/10">
        <div className="absolute inset-0 brand-gradient" aria-hidden />
        {course.thumbnailURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.thumbnailURL}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-25 mix-blend-soft-light"
            aria-hidden
          />
        ) : (
          <div
            className="absolute inset-0 opacity-35"
            style={{ background: course.thumbnailGradient }}
            aria-hidden
          />
        )}
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#0b1e4d]/95 via-[#1e40af]/88 to-[#2563eb]/82"
          aria-hidden
        />
        <div
          className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-3xl"
          aria-hidden
        />
        <div
          className="absolute -bottom-16 left-1/3 h-36 w-36 rounded-full bg-cyan-300/15 blur-3xl"
          aria-hidden
        />

        <div className="relative px-4 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/student/courses"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5" />
              {t("student.study.backToCourses")}
            </Link>
            <button
              type="button"
              onClick={() => setMobileLessonsOpen(true)}
              className="lg:hidden inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25"
              aria-label={t("student.study.curriculum")}
            >
              <MenuIcon className="h-3.5 w-3.5" />
              {t("student.study.curriculum")}
            </button>
          </div>

          <div className="mt-5 flex items-start gap-4">
            <div className="hidden sm:block h-[4.5rem] w-[6.5rem] shrink-0 overflow-hidden rounded-xl ring-2 ring-white/25 shadow-lg">
              {course.thumbnailURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={course.thumbnailURL}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className="h-full w-full"
                  style={{ background: course.thumbnailGradient }}
                />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
                {t("student.study.learningPath")}
              </p>
              <h1 className="mt-1 text-xl font-bold leading-tight tracking-tight text-white sm:text-2xl">
                {title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                  <Avatar
                    name={course.lecturer.name}
                    src={course.lecturer.photoURL}
                    size={20}
                  />
                  {course.lecturer.name}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs text-white/90">
                  <BookIcon className="h-3.5 w-3.5 text-white/70" />
                  {completedLessonCount}/{totalLessons} {t("course.lessons")}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs text-white/90">
                  <CheckCircleIcon className="h-3.5 w-3.5 text-white/70" />
                  {completedModuleCount}/{moduleCount} {t("lecturer.courses.modules")}
                </span>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-center gap-1">
              <ProgressRing
                percent={progressPercent}
                size={56}
                stroke={4}
                variant="dark"
                className={
                  activeLessonSaveKey && isSaveLoading(activeLessonSaveKey)
                    ? "animate-pulse"
                    : ""
                }
                label={`${progressPercent}% ${t("student.study.complete")}`}
              />
              <span className="hidden text-[10px] font-medium uppercase tracking-wide text-white/60 sm:block">
                {t("student.study.progress")}
              </span>
            </div>
          </div>
        </div>
      </header>

      {progressPercent >= 100 && (
        <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 sm:px-6">
          <Link
            href={`/courses/${slug}?tab=reviews`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 hover:text-emerald-950"
          >
            <StarIcon className="h-4 w-4 text-amber-500" />
            {t("student.study.leaveReview")}
          </Link>
        </div>
      )}

      <div className="flex flex-col lg:flex-row">
        {/* Sidebar */}
        <aside className="hidden w-72 shrink-0 border-r border-ink-200 bg-ink-50/50 p-4 lg:block xl:w-80">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-400">
            {t("student.study.curriculum")}
          </p>
          {renderSidebar(false)}
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 bg-white pb-16 lg:pb-0">
          {!activeLesson ? (
            <div className="flex min-h-[280px] items-center justify-center p-8 text-sm text-ink-500">
              {t("student.study.selectLesson")}
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="px-4 pt-4 sm:px-6 sm:pt-5">
                <div
                  className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 ${
                    activeLessonDone
                      ? "border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/40"
                      : "border-brand-100 bg-gradient-to-br from-brand-50/70 via-white to-indigo-50/30"
                  }`}
                >
                  <div
                    className={`absolute -right-6 -top-6 h-28 w-28 rounded-full blur-2xl ${
                      activeLessonDone ? "bg-emerald-200/40" : "bg-brand-200/35"
                    }`}
                    aria-hidden
                  />
                  <div className="relative flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 gap-3 sm:gap-4">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white shadow-md sm:h-12 sm:w-12 sm:text-lg ${
                          activeLessonDone ? "bg-emerald-500" : "brand-gradient"
                        }`}
                      >
                        {activeIndex + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="inline-flex items-center rounded-full bg-white/80 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-700 ring-1 ring-brand-200/80">
                          {activeEntry?.moduleTitle}
                        </span>
                        <h2 className="mt-2 text-lg font-semibold leading-snug text-ink-900 sm:text-xl">
                          {activeTitle}
                        </h2>
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          {activeLesson.durationMin > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-ink-600 ring-1 ring-ink-200/80">
                              <ClockIcon className="h-3.5 w-3.5 text-brand-500" />
                              {activeLesson.durationMin} min
                            </span>
                          )}
                          <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs font-medium text-ink-600 ring-1 ring-ink-200/80">
                            {t("student.study.lesson")} {activeIndex + 1}/{totalLessons}
                          </span>
                          {activeLessonDone && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
                              <CheckCircleIcon className="h-3.5 w-3.5" />
                              {t("student.study.lessonDone")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={saveBusy}
                      onClick={handleMarkLessonClick}
                      aria-busy={
                        activeLessonSaveKey
                          ? isSaveLoading(activeLessonSaveKey)
                          : false
                      }
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition-all duration-300 disabled:cursor-not-allowed ${
                        activeLessonSaveKey && isSaveLoading(activeLessonSaveKey)
                          ? "cursor-wait brand-gradient text-white opacity-90"
                          : activeLessonSaveKey && isSaveSuccess(activeLessonSaveKey)
                            ? "scale-[1.02] bg-emerald-500 text-white shadow-md ring-2 ring-emerald-300/60"
                            : activeLessonDone
                              ? "border border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50 disabled:opacity-60"
                              : "brand-gradient text-white hover:brightness-110 disabled:opacity-60"
                      }`}
                    >
                      {activeLessonSaveKey && isSaveLoading(activeLessonSaveKey) ? (
                        <>
                          <ActionSpinner className="border-white/30 border-t-white" />
                          {t("student.study.saving")}
                        </>
                      ) : activeLessonSaveKey && isSaveSuccess(activeLessonSaveKey) ? (
                        <>
                          <CheckCircleIcon className="h-4 w-4" />
                          {t("student.study.saved")}
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon className="h-4 w-4" />
                          {activeLessonDone
                            ? t("student.study.lessonDone")
                            : t("student.study.markLessonDone")}
                        </>
                      )}
                    </button>
                  </div>
                  {quizBlockAlert?.kind === "lesson" &&
                  quizBlockAlert.lessonId === activeLesson.id ? (
                    <div className="relative mt-4">
                      <StudyAlertBanner
                        message={quizBlockAlert.message}
                        onDismiss={() => setQuizBlockAlert(null)}
                        dismissLabel={t("action.cancel")}
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="px-4 py-4 sm:px-6">
                {activeLesson.type === "quiz" && activeLesson.quiz ? (
                  renderQuizBlock(activeLesson.quiz, "lesson", activeLesson.id)
                ) : activeLesson.videoURL ? (
                  <video
                    key={activeLesson.id}
                    controls
                    className="aspect-video w-full rounded-xl border border-ink-200 bg-white object-contain"
                    src={activeLesson.videoURL}
                    playsInline
                  />
                ) : activeLesson.pdfURL ? (
                  <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-xl border border-ink-200 bg-ink-50 p-6 text-center">
                    <BookIcon className="h-10 w-10 text-brand-600" />
                    <a
                      href={activeLesson.pdfURL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary btn-sm"
                    >
                      {t("student.study.openPdf")}
                    </a>
                  </div>
                ) : activeLesson.externalURL ? (
                  <div className="flex aspect-video items-center justify-center rounded-xl border border-ink-200 bg-ink-50 p-6">
                    <a
                      href={activeLesson.externalURL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary btn-sm"
                    >
                      {t("student.study.openLink")}
                    </a>
                  </div>
                ) : (
                  <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-ink-200 bg-ink-50 text-sm text-ink-500">
                    {t("student.study.noContent")}
                  </div>
                )}
              </div>

              {(activeLesson.type !== "quiz" && activeLesson.quiz) ||
              (isLastLessonInModule && activeModule?.quiz) ||
              (isLastLessonInCourse && course.finalQuiz) ? (
                <div className="flex flex-col gap-4 border-t border-ink-100 px-4 py-4 sm:px-6">
                  {activeLesson.type !== "quiz" && activeLesson.quiz
                    ? renderQuizBlock(
                        activeLesson.quiz,
                        "lesson",
                        activeLesson.id,
                      )
                    : null}
                  {isLastLessonInModule && activeModule?.quiz
                    ? renderQuizBlock(
                        activeModule.quiz,
                        "module",
                        activeModule.id,
                      )
                    : null}
                  {isLastLessonInCourse && course.finalQuiz
                    ? renderQuizBlock(
                        course.finalQuiz,
                        "course",
                        course.id,
                      )
                    : null}
                </div>
              ) : null}

              {(prevEntry || nextEntry) && (
                <div className="flex gap-2 border-t border-ink-100 px-4 py-3 sm:px-6">
                  {prevEntry ? (
                    <button
                      type="button"
                      onClick={() => selectLesson(prevEntry.lesson.id)}
                      className="inline-flex items-center gap-1.5 text-sm text-ink-600 hover:text-brand-700"
                    >
                      <ChevronLeftIcon className="h-4 w-4" />
                      <span className="truncate max-w-[160px]">
                        {prevEntry.lesson.title[locale] ?? prevEntry.lesson.title.en}
                      </span>
                    </button>
                  ) : (
                    <span />
                  )}
                  {nextEntry && (
                    <button
                      type="button"
                      onClick={() => selectLesson(nextEntry.lesson.id)}
                      className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-900"
                    >
                      <span className="truncate max-w-[160px]">
                        {nextEntry.lesson.title[locale] ?? nextEntry.lesson.title.en}
                      </span>
                      <ChevronRightIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Mobile: sticky lesson list trigger */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white/95 px-4 py-2.5 backdrop-blur-sm lg:hidden">
        <button
          type="button"
          onClick={() => setMobileLessonsOpen(true)}
          className="flex w-full items-center justify-between gap-3 rounded-xl bg-brand-50 px-4 py-3 text-left"
        >
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-800">
            <MenuIcon className="h-4 w-4" />
            {t("student.study.curriculum")}
          </span>
          <span className="text-xs font-medium text-brand-600">
            {activeIndex >= 0 ? activeIndex + 1 : 0}/{totalLessons}
          </span>
        </button>
      </div>

      {/* Mobile: lesson drawer */}
      {mobileLessonsOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40"
            aria-hidden
            onClick={() => setMobileLessonsOpen(false)}
          />
          <aside className="absolute right-0 top-0 flex h-full w-[min(20rem,88vw)] flex-col bg-white shadow-xl">
            <div className="flex shrink-0 items-center gap-3 border-b border-ink-200 px-4 py-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-ink-900">
                  {t("student.study.curriculum")}
                </h2>
                <p className="text-xs text-ink-500">
                  {completedLessonCount}/{totalLessons} {t("course.lessons")}
                </p>
              </div>
              <ProgressRing
                percent={progressPercent}
                size={40}
                stroke={3}
                variant="light"
                className="shrink-0"
              />
              <button
                type="button"
                onClick={() => setMobileLessonsOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-ink-100"
                aria-label={t("action.cancel")}
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-thin">
              {renderSidebar(true)}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
