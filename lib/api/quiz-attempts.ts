import { apiPost } from "@/lib/api/client";
import type { QuizSubmitResult } from "@/lib/data/types";

export type SubmitQuizPayload = {
  quizId: string;
  scope: "lesson" | "module" | "course";
  scopeId: string;
  answers: Record<string, string>;
};

export async function submitCourseQuiz(
  token: string,
  slug: string,
  payload: SubmitQuizPayload,
): Promise<QuizSubmitResult> {
  return apiPost<QuizSubmitResult>(
    `/students/me/courses/${encodeURIComponent(slug)}/quizzes/submit`,
    { token, json: payload },
  );
}
