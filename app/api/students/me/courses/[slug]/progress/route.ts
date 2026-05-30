import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/server/auth-middleware";
import {
  enrichCourseProgress,
  getCourseProgress,
  setLessonProgress,
  setModuleProgress,
} from "@/lib/server/course-progress";
import {
  getEnrolledRawCourseBySlug,
} from "@/lib/server/study-course";

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
    const raw = await getEnrolledRawCourseBySlug(auth.user.uid, trimmed);
    if (!raw) {
      return NextResponse.json(
        { error: "Course not found or not enrolled" },
        { status: 404 },
      );
    }
    const totalLessons = raw.modules.reduce((n, m) => n + m.lessons.length, 0);
    const progress = enrichCourseProgress(
      totalLessons,
      await getCourseProgress(auth.user.uid, raw.id),
    );
    return NextResponse.json({ data: progress });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: "Failed to load progress", detail },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireRole(req, "student");
  if (!auth.ok) return auth.response;

  const { slug } = await context.params;
  const trimmed = slug?.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const completed = body.completed === true;
    const lessonId =
      typeof body.lessonId === "string" ? body.lessonId.trim() : "";
    const moduleId =
      typeof body.moduleId === "string" ? body.moduleId.trim() : "";

    if (!lessonId && !moduleId) {
      return NextResponse.json(
        { error: "lessonId or moduleId is required" },
        { status: 400 },
      );
    }
    if (lessonId && moduleId) {
      return NextResponse.json(
        { error: "Provide only lessonId or moduleId, not both" },
        { status: 400 },
      );
    }

    const raw = await getEnrolledRawCourseBySlug(auth.user.uid, trimmed);
    if (!raw) {
      return NextResponse.json(
        { error: "Course not found or not enrolled" },
        { status: 404 },
      );
    }

    const totalLessons = raw.modules.reduce((n, m) => n + m.lessons.length, 0);
    const updated = lessonId
      ? await setLessonProgress(
          auth.user.uid,
          raw.id,
          lessonId,
          completed,
          raw.modules,
          raw.finalQuiz,
        )
      : await setModuleProgress(
          auth.user.uid,
          raw.id,
          moduleId,
          completed,
          raw.modules,
          raw.finalQuiz,
        );

    return NextResponse.json({
      data: enrichCourseProgress(totalLessons, updated),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown";
    const status = detail.includes("Not enrolled") ? 403 : 400;
    return NextResponse.json(
      { error: "Failed to update progress", detail },
      { status },
    );
  }
}
