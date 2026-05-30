import type { CourseQuiz, QuizQuestion } from "./types";

export type StudyQuizOption = { id: string; text: string };

export type StudyQuizQuestion = {
  id: string;
  prompt: string;
  options: StudyQuizOption[];
};

export type StudyQuiz = {
  id: string;
  title?: string;
  instructions?: string;
  passingScorePercent?: number;
  questions: StudyQuizQuestion[];
};

export type QuizAnswerMap = Record<string, string>;

export type QuizQuestionResult = {
  questionId: string;
  selectedOptionId: string;
  correctOptionId: string;
  correct: boolean;
};

export type QuizGradeResult = {
  quizId: string;
  scorePercent: number;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
  passingScorePercent: number;
  questions: QuizQuestionResult[];
};

export function toStudyQuiz(quiz: CourseQuiz): StudyQuiz {
  return {
    id: quiz.id,
    title: quiz.title,
    instructions: quiz.instructions,
    passingScorePercent: quiz.passingScorePercent,
    questions: quiz.questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      options: q.options.map((o) => ({ id: o.id, text: o.text })),
    })),
  };
}

export function gradeQuizSubmission(
  quiz: CourseQuiz,
  answers: QuizAnswerMap,
): QuizGradeResult {
  const questions = quiz.questions.filter((q) => q.prompt.trim().length > 0);
  const totalQuestions = questions.length;
  const passingScorePercent = quiz.passingScorePercent ?? 70;

  if (totalQuestions === 0) {
    return {
      quizId: quiz.id,
      scorePercent: 0,
      passed: false,
      correctCount: 0,
      totalQuestions: 0,
      passingScorePercent,
      questions: [],
    };
  }

  const graded: QuizQuestionResult[] = questions.map((q) =>
    gradeQuestion(q, answers[q.id] ?? ""),
  );
  const correctCount = graded.filter((r) => r.correct).length;
  const scorePercent = Math.round((correctCount / totalQuestions) * 100);

  return {
    quizId: quiz.id,
    scorePercent,
    passed: scorePercent >= passingScorePercent,
    correctCount,
    totalQuestions,
    passingScorePercent,
    questions: graded,
  };
}

function gradeQuestion(
  question: QuizQuestion,
  selectedOptionId: string,
): QuizQuestionResult {
  const correctOptionId =
    question.options.some((o) => o.id === question.correctOptionId)
      ? question.correctOptionId
      : (question.options[0]?.id ?? "");

  return {
    questionId: question.id,
    selectedOptionId,
    correctOptionId,
    correct:
      selectedOptionId.length > 0 && selectedOptionId === correctOptionId,
  };
}
