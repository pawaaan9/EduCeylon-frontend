"use client";

import { useMemo, useState } from "react";
import { CheckCircleIcon, CloseIcon } from "@/components/icons";
import { submitCourseQuiz } from "@/lib/api/quiz-attempts";
import type { StudyQuiz } from "@/lib/courses/quiz-student";
import type { QuizAttemptSummary, QuizSubmitResult } from "@/lib/data/types";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useT } from "@/lib/i18n/I18nProvider";

export function QuizPlayer({
  quiz,
  scope,
  scopeId,
  slug,
  priorAttempt,
  onSubmitted,
}: {
  quiz: StudyQuiz;
  scope: "lesson" | "module" | "course";
  scopeId: string;
  slug: string;
  priorAttempt?: QuizAttemptSummary;
  onSubmitted: (result: QuizSubmitResult) => void;
}) {
  const t = useT();
  const { user } = useAuth();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuizSubmitResult | null>(null);
  const [retaking, setRetaking] = useState(false);

  const showPrior =
    priorAttempt && !result && !retaking && quiz.questions.length > 0;

  const optionLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const q of quiz.questions) {
      for (const o of q.options) {
        map.set(o.id, o.text);
      }
    }
    return map;
  }, [quiz.questions]);

  const allAnswered = quiz.questions.every(
    (q) => q.prompt.trim() && answers[q.id]?.trim(),
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || submitting || !allAnswered) return;

    setSubmitting(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const data = await submitCourseQuiz(token, slug, {
        quizId: quiz.id,
        scope,
        scopeId,
        answers,
      });
      setResult(data);
      onSubmitted(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("student.quiz.error"));
    } finally {
      setSubmitting(false);
    }
  }

  function startRetake() {
    setAnswers({});
    setResult(null);
    setRetaking(true);
    setError(null);
  }

  if (quiz.questions.length === 0) return null;

  if (showPrior) {
    return (
      <div className="rounded-xl border border-ink-200 bg-ink-50/60 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-ink-900">
              {quiz.title?.trim() || t("student.quiz.title")}
            </h3>
            <p className="mt-1 text-sm text-ink-600">
              {priorAttempt.passed
                ? t("student.quiz.passedSummary").replace(
                    "{score}",
                    String(priorAttempt.scorePercent),
                  )
                : t("student.quiz.failedSummary").replace(
                    "{score}",
                    String(priorAttempt.scorePercent),
                  )}
            </p>
          </div>
          <button
            type="button"
            onClick={startRetake}
            className="btn btn-secondary btn-sm"
          >
            {t("student.quiz.retake")}
          </button>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <QuizResults
        quiz={quiz}
        result={result}
        optionLabel={optionLabel}
        onRetake={startRetake}
      />
    );
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="rounded-xl border border-brand-100 bg-brand-50/30 p-4 sm:p-5"
    >
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-ink-900">
          {quiz.title?.trim() || t("student.quiz.title")}
        </h3>
        {quiz.instructions?.trim() ? (
          <p className="mt-1 text-sm text-ink-600">{quiz.instructions}</p>
        ) : null}
        {quiz.passingScorePercent != null ? (
          <p className="mt-1 text-xs text-ink-500">
            {t("student.quiz.passingHint").replace(
              "{score}",
              String(quiz.passingScorePercent),
            )}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
        {quiz.questions.map((question, qi) => (
          <fieldset
            key={question.id}
            className="rounded-lg border border-ink-200 bg-white p-4"
          >
            <legend className="px-1 text-sm font-medium text-ink-900">
              {qi + 1}. {question.prompt}
            </legend>
            <div className="mt-3 flex flex-col gap-2">
              {question.options.map((option, oi) => (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                    answers[question.id] === option.id
                      ? "border-brand-300 bg-brand-50 text-brand-900"
                      : "border-ink-100 bg-ink-50/50 text-ink-700 hover:border-ink-200"
                  }`}
                >
                  <input
                    type="radio"
                    name={`quiz-${quiz.id}-${question.id}`}
                    value={option.id}
                    checked={answers[question.id] === option.id}
                    onChange={() =>
                      setAnswers((prev) => ({
                        ...prev,
                        [question.id]: option.id,
                      }))
                    }
                    className="h-4 w-4 accent-brand-600"
                  />
                  <span className="w-5 shrink-0 text-xs font-bold text-ink-400">
                    {String.fromCharCode(65 + oi)}
                  </span>
                  <span className="flex-1">{option.text || "—"}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      {error ? (
        <p className="mt-3 text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting || !allAnswered}
        className="btn btn-primary mt-4 disabled:opacity-50"
      >
        {submitting ? t("student.quiz.submitting") : t("student.quiz.submit")}
      </button>
    </form>
  );
}

function QuizResults({
  quiz,
  result,
  optionLabel,
  onRetake,
}: {
  quiz: StudyQuiz;
  result: QuizSubmitResult;
  optionLabel: Map<string, string>;
  onRetake: () => void;
}) {
  const t = useT();

  return (
    <div
      className={`rounded-xl border p-4 sm:p-5 ${
        result.passed
          ? "border-emerald-200 bg-emerald-50/50"
          : "border-amber-200 bg-amber-50/40"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            {t("student.quiz.results")}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-ink-900">
            {result.scorePercent}%
          </p>
          <p className="text-sm text-ink-600">
            {t("student.quiz.scoreDetail")
              .replace("{correct}", String(result.correctCount))
              .replace("{total}", String(result.totalQuestions))}
          </p>
          <p
            className={`mt-1 text-sm font-semibold ${
              result.passed ? "text-emerald-700" : "text-amber-800"
            }`}
          >
            {result.passed
              ? t("student.quiz.passed")
              : t("student.quiz.notPassed").replace(
                  "{score}",
                  String(result.passingScorePercent),
                )}
          </p>
        </div>
        <button type="button" onClick={onRetake} className="btn btn-secondary btn-sm">
          {t("student.quiz.retake")}
        </button>
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {result.questions.map((row, i) => {
          const question = quiz.questions.find((q) => q.id === row.questionId);
          const selectedText = optionLabel.get(row.selectedOptionId) ?? "—";
          const correctText = optionLabel.get(row.correctOptionId) ?? "—";

          return (
            <li
              key={row.questionId}
              className={`rounded-lg border px-3 py-2.5 text-sm ${
                row.correct
                  ? "border-emerald-200 bg-white"
                  : "border-rose-200 bg-white"
              }`}
            >
              <div className="flex items-start gap-2">
                {row.correct ? (
                  <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <CloseIcon className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink-900">
                    {i + 1}. {question?.prompt ?? row.questionId}
                  </p>
                  <p className="mt-1 text-ink-600">
                    {t("student.quiz.yourAnswer")}: {selectedText}
                  </p>
                  {!row.correct ? (
                    <p className="mt-0.5 text-emerald-700">
                      {t("student.quiz.correctAnswer")}: {correctText}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
