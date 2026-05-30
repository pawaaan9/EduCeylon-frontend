import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/server/auth-middleware";
import { getCourseProgress, enrichCourseProgress } from "@/lib/server/course-progress";
import { listLatestQuizAttempts } from "@/lib/server/quiz-attempts";
import { getEnrolledStudyCourseBySlug } from "@/lib/server/study-course";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await requireRole(req, "student");
  if (!auth.ok) return auth.response;

  const { slug } = await context.params;
  const trimmed = slug?.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  try {
    const course = await getEnrolledStudyCourseBySlug(auth.user.uid, trimmed);
    if (!course) {
      return NextResponse.json(
        { error: "Course not found or not enrolled" },
        { status: 404 },
      );
    }
    const progress = enrichCourseProgress(
      course.modules.reduce((n, m) => n + m.lessons.length, 0),
      await getCourseProgress(auth.user.uid, course.id),
    );
    const quizAttempts = await listLatestQuizAttempts(
      auth.user.uid,
      course.id,
    );
    return NextResponse.json({
      data: { ...course, progress, quizAttempts },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: "Failed to load course", detail },
      { status: 500 },
    );
  }
}
