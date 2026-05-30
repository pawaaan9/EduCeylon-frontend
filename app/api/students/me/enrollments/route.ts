import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/server/auth-middleware";
import {
  enrollStudent,
  listEnrolledPublicCourses,
} from "@/lib/server/enrollments";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, "student");
  if (!auth.ok) return auth.response;

  try {
    const courses = await listEnrolledPublicCourses(auth.user.uid);
    return NextResponse.json({ data: courses });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: "Failed to load enrollments", detail },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "student");
  if (!auth.ok) return auth.response;

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const courseId =
      typeof body?.courseId === "string" ? body.courseId.trim() : "";
    if (!courseId) {
      return NextResponse.json(
        { error: "courseId is required" },
        { status: 400 },
      );
    }

    const enrollment = await enrollStudent(auth.user.uid, courseId);
    return NextResponse.json({ data: enrollment });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown";
    const status =
      detail.includes("not found") || detail.includes("not available")
        ? 404
        : detail.includes("full")
          ? 409
          : 500;
    return NextResponse.json(
      { error: "Failed to enroll", detail },
      { status },
    );
  }
}
