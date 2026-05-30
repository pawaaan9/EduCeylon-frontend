"use client";

import {
  BookIcon,
  PlayCircleIcon,
  StarIcon,
} from "@/components/icons";
import type { CourseModule, CourseQuiz, LecturerCourse, Lesson } from "@/lib/courses/types";
import { useT } from "@/lib/i18n/I18nProvider";

function quizQuestionCount(quiz?: CourseQuiz): number {
  return quiz?.questions?.length ?? 0;
}

function QuizChip({
  label,
  count,
}: {
  label: string;
  count: number;
}) {
  const t = useT();
  if (count <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 ring-1 ring-brand-100">
      <StarIcon className="h-3 w-3" />
      {label} · {count} {t("lecturer.create.review.questionCount")}
    </span>
  );
}

function LessonTypeIcon({ type }: { type: Lesson["type"] }) {
  if (type === "pdf") {
    return <BookIcon className="h-3.5 w-3.5 shrink-0 text-ink-400" />;
  }
  return <PlayCircleIcon className="h-3.5 w-3.5 shrink-0 text-ink-400" />;
}

function LessonPreviewRow({
  lesson,
  index,
}: {
  lesson: Lesson;
  index: number;
}) {
  const t = useT();
  const lessonQuizCount = quizQuestionCount(lesson.quiz);
  const isQuizLesson = lesson.type === "quiz";

  return (
    <li className="flex flex-col gap-1.5 rounded-lg border border-ink-100 bg-ink-50/50 px-3 py-2.5">
      <div className="flex items-start gap-2.5 min-w-0">
        <span className="mt-0.5 text-[11px] font-bold tabular-nums text-ink-400">
          {String(index + 1).padStart(2, "0")}
        </span>
        {!isQuizLesson ? <LessonTypeIcon type={lesson.type} /> : null}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink-900 truncate">
            {lesson.title.trim() ||
              (isQuizLesson
                ? t("lecturer.create.quiz.lessonHeading")
                : t("lecturer.create.lesson.title"))}
          </p>
          <p className="text-[11px] text-ink-500">
            {t(`lecturer.create.lessonType.${lesson.type}`)}
            {lesson.durationMinutes ? ` · ${lesson.durationMinutes} min` : ""}
            {lesson.freePreview ? ` · ${t("course.preview")}` : ""}
          </p>
        </div>
      </div>
      {(isQuizLesson && lessonQuizCount > 0) || (!isQuizLesson && lessonQuizCount > 0) ? (
        <QuizChip
          label={t("lecturer.create.review.lessonQuiz")}
          count={lessonQuizCount}
        />
      ) : null}
    </li>
  );
}

function ModulePreviewBlock({
  mod,
  index,
}: {
  mod: CourseModule;
  index: number;
}) {
  const t = useT();
  const moduleQuizCount = quizQuestionCount(mod.quiz);

  return (
    <details
      className="group rounded-xl border border-ink-200 bg-white overflow-hidden"
      open={index === 0}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-ink-50 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            {t("lecturer.create.review.moduleLabel").replace(
              "{n}",
              String(index + 1),
            )}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-ink-900 truncate">
            {mod.title.trim() || t("lecturer.create.module.title")}
          </p>
        </div>
        <span className="shrink-0 text-xs text-ink-500">
          {mod.lessons.length} {t("lecturer.courses.lessons")}
          {moduleQuizCount > 0
            ? ` · ${moduleQuizCount} ${t("lecturer.create.review.questionCount")}`
            : ""}
        </span>
      </summary>
      <div className="border-t border-ink-100 px-4 pb-4 pt-3">
        {mod.lessons.length === 0 ? (
          <p className="text-xs text-ink-500">
            {t("lecturer.create.lesson.empty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {mod.lessons.map((lesson, li) => (
              <LessonPreviewRow key={lesson.id} lesson={lesson} index={li} />
            ))}
          </ul>
        )}
        {moduleQuizCount > 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-brand-200 bg-brand-50/40 px-3 py-2.5">
            <p className="text-xs font-semibold text-brand-800">
              {mod.quiz?.title?.trim() ||
                t("lecturer.create.review.moduleQuiz")}
            </p>
            <p className="mt-0.5 text-[11px] text-brand-700">
              {moduleQuizCount} {t("lecturer.create.review.questionCount")}
            </p>
          </div>
        ) : null}
      </div>
    </details>
  );
}

export function ReviewCurriculumPreview({
  course,
}: {
  course: LecturerCourse;
}) {
  const t = useT();
  const totalLessons = course.modules.reduce(
    (acc, m) => acc + m.lessons.length,
    0,
  );
  const finalQuizCount = quizQuestionCount(course.finalQuiz);

  if (course.courseType !== "recorded") return null;

  return (
    <section className="rounded-xl border border-ink-200 bg-white p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink-900">
            {t("lecturer.create.review.curriculumPreview")}
          </h3>
          <p className="mt-0.5 text-xs text-ink-500">
            {t("lecturer.create.review.curriculumPreviewHint")}
          </p>
        </div>
        <p className="text-xs font-medium text-ink-600">
          {course.modules.length} {t("lecturer.courses.modules")} ·{" "}
          {totalLessons} {t("lecturer.courses.lessons")}
        </p>
      </div>

      {course.modules.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink-200 bg-ink-50 px-4 py-6 text-center text-sm text-ink-500">
          {t("lecturer.create.module.empty")}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {course.modules.map((mod, mi) => (
            <ModulePreviewBlock key={mod.id} mod={mod} index={mi} />
          ))}
        </div>
      )}

      {finalQuizCount > 0 ? (
        <div className="mt-4 rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            {t("lecturer.create.review.finalQuiz")}
          </p>
          <p className="mt-1 text-sm font-semibold text-ink-900">
            {course.finalQuiz?.title?.trim() ||
              t("lecturer.create.quiz.courseHeading")}
          </p>
          <p className="mt-0.5 text-xs text-ink-600">
            {finalQuizCount} {t("lecturer.create.review.questionCount")}
          </p>
        </div>
      ) : null}
    </section>
  );
}
