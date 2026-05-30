import { NextResponse } from "next/server";
import {
  getPublishedCourseIdBySlug,
  listCourseReviews,
} from "@/lib/server/course-reviews";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await ctx.params;
    const courseId = await getPublishedCourseIdBySlug(slug);
    if (!courseId) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const payload = await listCourseReviews(courseId);
    return NextResponse.json({ data: payload });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: "Failed to load reviews", detail },
      { status: 500 },
    );
  }
}
