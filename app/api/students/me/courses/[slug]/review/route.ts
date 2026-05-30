import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/server/auth-middleware";
import {
  createStudentCourseReview,
  getPublishedCourseIdBySlug,
  listStudentCourseReviews,
  validateReviewInput,
} from "@/lib/server/course-reviews";
import { isStudentEnrolled } from "@/lib/server/enrollments";

export const runtime = "nodejs";

async function resolveEnrolledCourse(
  studentId: string,
  slug: string,
): Promise<{ courseId: string } | NextResponse> {
  const courseId = await getPublishedCourseIdBySlug(slug);
  if (!courseId) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  const enrolled = await isStudentEnrolled(studentId, courseId);
  if (!enrolled) {
    return NextResponse.json(
      { error: "You must be enrolled to review this course" },
      { status: 403 },
    );
  }
  return { courseId };
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const auth = await requireRole(req, "student");
  if (!auth.ok) return auth.response;

  try {
    const { slug } = await ctx.params;
    const resolved = await resolveEnrolledCourse(auth.user.uid, slug);
    if (resolved instanceof NextResponse) return resolved;

    const reviews = await listStudentCourseReviews(
      auth.user.uid,
      resolved.courseId,
    );
    return NextResponse.json({ data: reviews });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: "Failed to load your reviews", detail },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const auth = await requireRole(req, "student");
  if (!auth.ok) return auth.response;

  try {
    const { slug } = await ctx.params;
    const resolved = await resolveEnrolledCourse(auth.user.uid, slug);
    if (resolved instanceof NextResponse) return resolved;

    const body = (await req.json().catch(() => ({}))) as {
      rating?: unknown;
      comment?: unknown;
    };
    const input = validateReviewInput(body);

    const review = await createStudentCourseReview(
      auth.user.uid,
      resolved.courseId,
      input,
      auth.user.name,
    );
    return NextResponse.json({ data: review });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown";
    const status =
      detail.includes("Rating") ||
      detail.includes("comment") ||
      detail.includes("characters")
        ? 400
        : detail.includes("enrolled")
          ? 403
          : 500;
    return NextResponse.json(
      { error: "Failed to save review", detail },
      { status },
    );
  }
}

/** @deprecated Use POST — each call creates a new review. */
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  return POST(req, ctx);
}
