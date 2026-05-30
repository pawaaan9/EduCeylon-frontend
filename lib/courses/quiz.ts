import { newClientId, type CourseQuiz, type QuizOption, type QuizQuestion } from "./types";

export const QUIZ_MIN_OPTIONS = 2;
export const QUIZ_MAX_OPTIONS = 8;
export const QUIZ_DEFAULT_OPTIONS = 4;

export function defaultOptionLabel(index: number): string {
  return String.fromCharCode(65 + index);
}

export function emptyQuizOption(labelIndex?: number): QuizOption {
  return {
    id: newClientId("opt"),
    text: labelIndex != null ? defaultOptionLabel(labelIndex) : "",
  };
}

export function emptyQuizQuestion(optionCount = QUIZ_DEFAULT_OPTIONS): QuizQuestion {
  const count = clampOptionCount(optionCount);
  const options = Array.from({ length: count }, (_, i) => emptyQuizOption(i));
  return {
    id: newClientId("q"),
    prompt: "",
    options,
    correctOptionId: options[0]!.id,
  };
}

export function emptyQuiz(optionCount = QUIZ_DEFAULT_OPTIONS): CourseQuiz {
  return {
    id: newClientId("quiz"),
    optionCount: clampOptionCount(optionCount),
    passingScorePercent: 70,
    questions: [],
  };
}

export function clampOptionCount(count: number): number {
  return Math.max(QUIZ_MIN_OPTIONS, Math.min(QUIZ_MAX_OPTIONS, Math.round(count)));
}

export function summarizeCourseQuizzes(course: {
  modules: Array<{
    quiz?: CourseQuiz;
    lessons: Array<{ type?: string; quiz?: CourseQuiz }>;
  }>;
  finalQuiz?: CourseQuiz;
}): { quizCount: number; questionCount: number } {
  let quizCount = 0;
  let questionCount = 0;

  function addQuiz(quiz?: CourseQuiz) {
    if (!quiz || quiz.questions.length === 0) return;
    quizCount += 1;
    questionCount += quiz.questions.length;
  }

  for (const mod of course.modules) {
    addQuiz(mod.quiz);
    for (const lesson of mod.lessons) {
      addQuiz(lesson.quiz);
    }
  }
  addQuiz(course.finalQuiz);

  return { quizCount, questionCount };
}

export function ensureQuiz(
  quiz: CourseQuiz | undefined,
  optionCount = QUIZ_DEFAULT_OPTIONS,
): CourseQuiz {
  if (quiz && quiz.questions) {
    return {
      ...emptyQuiz(optionCount),
      ...quiz,
      optionCount: clampOptionCount(quiz.optionCount ?? optionCount),
      questions: quiz.questions.map((q) => ({
        ...q,
        options:
          q.options.length >= QUIZ_MIN_OPTIONS
            ? q.options
            : emptyQuizQuestion(optionCount).options,
        correctOptionId:
          q.options.some((o) => o.id === q.correctOptionId)
            ? q.correctOptionId
            : q.options[0]?.id ?? "",
      })),
    };
  }
  return emptyQuiz(optionCount);
}
