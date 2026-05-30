"use client";

import { PlusIcon, TrashIcon } from "@/components/icons";
import {
  QUIZ_MAX_OPTIONS,
  QUIZ_MIN_OPTIONS,
  clampOptionCount,
  emptyQuiz,
  emptyQuizOption,
  emptyQuizQuestion,
  ensureQuiz,
} from "@/lib/courses/quiz";
import type { CourseQuiz, QuizQuestion } from "@/lib/courses/types";
import { useT } from "@/lib/i18n/I18nProvider";

export function QuizEditor({
  value,
  onChange,
  heading,
  description,
}: {
  value?: CourseQuiz;
  onChange: (quiz: CourseQuiz) => void;
  heading?: string;
  description?: string;
}) {
  const t = useT();
  const quiz = ensureQuiz(value);

  function patch(p: Partial<CourseQuiz>) {
    onChange({ ...quiz, ...p });
  }

  function patchQuestion(questionId: string, p: Partial<QuizQuestion>) {
    patch({
      questions: quiz.questions.map((q) =>
        q.id === questionId ? { ...q, ...p } : q,
      ),
    });
  }

  function addQuestion() {
    const count = clampOptionCount(quiz.optionCount ?? 4);
    patch({
      questions: [...quiz.questions, emptyQuizQuestion(count)],
    });
  }

  function removeQuestion(questionId: string) {
    patch({ questions: quiz.questions.filter((q) => q.id !== questionId) });
  }

  function addOption(questionId: string) {
    const question = quiz.questions.find((q) => q.id === questionId);
    if (!question || question.options.length >= QUIZ_MAX_OPTIONS) return;
    const option = emptyQuizOption(question.options.length);
    patchQuestion(questionId, {
      options: [...question.options, option],
    });
  }

  function removeOption(questionId: string, optionId: string) {
    const question = quiz.questions.find((q) => q.id === questionId);
    if (!question || question.options.length <= QUIZ_MIN_OPTIONS) return;
    const options = question.options.filter((o) => o.id !== optionId);
    patchQuestion(questionId, {
      options,
      correctOptionId: options.some((o) => o.id === question.correctOptionId)
        ? question.correctOptionId
        : options[0]!.id,
    });
  }

  function setOptionCount(count: number) {
    patch({ optionCount: clampOptionCount(count) });
  }

  return (
    <div className="grid gap-4 rounded-xl border border-brand-100 bg-brand-50/40 p-4">
      <div>
        {heading && (
          <h4 className="text-sm font-semibold text-ink-900">{heading}</h4>
        )}
        {description && (
          <p className="mt-1 text-xs text-ink-500">{description}</p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Labeled label={t("lecturer.create.quiz.title")}>
          <input
            className="input-base"
            value={quiz.title ?? ""}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder={t("lecturer.create.quiz.titlePlaceholder")}
          />
        </Labeled>
        <Labeled label={t("lecturer.create.quiz.passingScore")}>
          <input
            type="number"
            min={0}
            max={100}
            className="input-base"
            value={quiz.passingScorePercent ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              patch({
                passingScorePercent: v ? Math.min(100, Number(v)) : undefined,
              });
            }}
          />
        </Labeled>
      </div>

      <Labeled label={t("lecturer.create.quiz.instructions")}>
        <textarea
          className="textarea-base min-h-[72px]"
          value={quiz.instructions ?? ""}
          onChange={(e) => patch({ instructions: e.target.value })}
          placeholder={t("lecturer.create.quiz.instructionsPlaceholder")}
        />
      </Labeled>

      <Labeled label={t("lecturer.create.quiz.defaultOptions")}>
        <select
          className="input-base select-base max-w-[12rem]"
          value={quiz.optionCount ?? 4}
          onChange={(e) => setOptionCount(Number(e.target.value))}
        >
          {Array.from(
            { length: QUIZ_MAX_OPTIONS - QUIZ_MIN_OPTIONS + 1 },
            (_, i) => i + QUIZ_MIN_OPTIONS,
          ).map((n) => (
            <option key={n} value={n}>
              {n} {t("lecturer.create.quiz.answers")}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-ink-500">
          {t("lecturer.create.quiz.defaultOptionsHint")}
        </p>
      </Labeled>

      {quiz.questions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink-300 bg-white px-4 py-6 text-center text-sm text-ink-500">
          {t("lecturer.create.quiz.noQuestions")}
        </div>
      ) : (
        <div className="grid gap-4">
          {quiz.questions.map((question, qi) => (
            <div
              key={question.id}
              className="grid gap-3 rounded-lg border border-ink-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                  {t("lecturer.create.quiz.question")} {qi + 1}
                </p>
                <button
                  type="button"
                  onClick={() => removeQuestion(question.id)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-rose-50 hover:text-rose-600"
                  aria-label={t("lecturer.create.quiz.removeQuestion")}
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>

              <Labeled label={t("lecturer.create.quiz.prompt")}>
                <textarea
                  className="textarea-base min-h-[72px]"
                  value={question.prompt}
                  onChange={(e) =>
                    patchQuestion(question.id, { prompt: e.target.value })
                  }
                  placeholder={t("lecturer.create.quiz.promptPlaceholder")}
                />
              </Labeled>

              <div className="grid gap-3">
                <div>
                  <p className="text-sm font-medium text-ink-800">
                    {t("lecturer.create.quiz.answersHeading")}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {t("lecturer.create.quiz.answersHint")}
                  </p>
                </div>
                {question.options.map((option, oi) => {
                  const letter = String.fromCharCode(65 + oi);
                  const isCorrect = question.correctOptionId === option.id;

                  return (
                    <div
                      key={option.id}
                      className={`rounded-lg border p-3 transition-colors ${
                        isCorrect
                          ? "border-emerald-300 bg-emerald-50/60"
                          : "border-ink-200 bg-white"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <label
                          htmlFor={`answer-${question.id}-${option.id}`}
                          className="text-sm font-semibold text-ink-800"
                        >
                          {t("lecturer.create.quiz.answerLabel").replace(
                            "{letter}",
                            letter,
                          )}
                        </label>
                        {isCorrect ? (
                          <span className="badge badge-emerald text-[10px]">
                            {t("lecturer.create.quiz.correctBadge")}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`correct-${question.id}`}
                          checked={isCorrect}
                          onChange={() =>
                            patchQuestion(question.id, {
                              correctOptionId: option.id,
                            })
                          }
                          className="h-4 w-4 shrink-0 accent-brand-600"
                          aria-label={t("lecturer.create.quiz.markCorrect")}
                        />
                        <input
                          id={`answer-${question.id}-${option.id}`}
                          className="input-base flex-1"
                          value={option.text}
                          onChange={(e) =>
                            patchQuestion(question.id, {
                              options: question.options.map((o) =>
                                o.id === option.id
                                  ? { ...o, text: e.target.value }
                                  : o,
                              ),
                            })
                          }
                          placeholder={t(
                            "lecturer.create.quiz.answerPlaceholder",
                          ).replace("{letter}", letter)}
                        />
                        <button
                          type="button"
                          onClick={() => removeOption(question.id, option.id)}
                          disabled={question.options.length <= QUIZ_MIN_OPTIONS}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                          aria-label={t("lecturer.create.quiz.removeOption")}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {question.options.length < QUIZ_MAX_OPTIONS && (
                <button
                  type="button"
                  onClick={() => addOption(question.id)}
                  className="btn btn-secondary btn-sm h-9 w-fit text-xs"
                >
                  <PlusIcon className="h-4 w-4" />
                  {t("lecturer.create.quiz.addAnswer")}
                </button>
              )}

              {question.options.some((o) => !o.text.trim()) ? (
                <p className="text-xs text-amber-800">
                  {t("lecturer.create.quiz.fillAllAnswers")}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addQuestion}
        className="btn btn-secondary btn-sm h-9 w-fit"
      >
        <PlusIcon className="h-4 w-4" />
        {t("lecturer.create.quiz.addQuestion")}
      </button>
    </div>
  );
}

export function QuizEditorPanel({
  value,
  onChange,
  enableLabel,
  heading,
  description,
}: {
  value?: CourseQuiz;
  onChange: (quiz: CourseQuiz | undefined) => void;
  enableLabel: string;
  heading: string;
  description: string;
}) {
  const t = useT();
  const enabled = Boolean(value);

  return (
    <div className="grid gap-3">
      <label className="inline-flex cursor-pointer select-none items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2.5">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            if (e.target.checked) onChange(value ?? emptyQuiz());
            else onChange(undefined);
          }}
          className="h-4 w-4 accent-brand-600"
        />
        <span className="text-sm font-medium text-ink-800">{enableLabel}</span>
      </label>

      {enabled && value && (
        <QuizEditor
          value={value}
          onChange={onChange}
          heading={heading}
          description={description}
        />
      )}

      {enabled && value && value.questions.length === 0 && (
        <p className="text-xs text-amber-800">
          {t("lecturer.create.quiz.addOneQuestion")}
        </p>
      )}
    </div>
  );
}

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-700">{label}</span>
      {children}
    </label>
  );
}
