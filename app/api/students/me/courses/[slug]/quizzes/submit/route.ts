import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/server/auth-middleware";
import {
  submitQuizAttempt,
  type QuizScope,
} from "@/lib/server/quiz-attempts";
import { getEnrolledRawCourseBySlug } from "@/lib/server/study-course";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

function parseScope(value: unknown): QuizScope | null {
  if (value === "lesson" || value === "module" || value === "course") {
    return value;
  }
  return null;
}

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireRole(req, "student");
  if (!auth.ok) return auth.response;

  const { slug } = await context.params;
  const trimmed = slug?.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const quizId = typeof body.quizId === "string" ? body.quizId.trim() : "";
    const scope = parseScope(body.scope);
    const scopeId =
      typeof body.scopeId === "string" ? body.scopeId.trim() : "";
    const answersRaw = body.answers;

    if (!quizId || !scope || !scopeId) {
      return NextResponse.json(
        { error: "quizId, scope, and scopeId are required" },
        { status: 400 },
      );
    }

    if (!answersRaw || typeof answersRaw !== "object" || Array.isArray(answersRaw)) {
      return NextResponse.json(
        { error: "answers object is required" },
        { status: 400 },
      );
    }

    const answers: Record<string, string> = {};
    for (const [key, value] of Object.entries(
      answersRaw as Record<string, unknown>,
    )) {
      if (typeof value === "string" && value.trim()) {
        answers[key] = value.trim();
      }
    }

    const raw = await getEnrolledRawCourseBySlug(auth.user.uid, trimmed);
    if (!raw) {
      return NextResponse.json(
        { error: "Course not found or not enrolled" },
        { status: 404 },
      );
    }

    const result = await submitQuizAttempt(
      auth.user.uid,
      raw.id,
      raw,
      quizId,
      scope,
      scopeId,
      answers,
    );

    return NextResponse.json({ data: result });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: "Failed to submit quiz", detail },
      { status: 400 },
    );
  }
}
