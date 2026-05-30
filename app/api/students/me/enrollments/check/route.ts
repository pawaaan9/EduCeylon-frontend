import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/server/auth-middleware";
import { isStudentEnrolled } from "@/lib/server/enrollments";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, "student");
  if (!auth.ok) return auth.response;

  const courseId = req.nextUrl.searchParams.get("courseId")?.trim() ?? "";
  if (!courseId) {
    return NextResponse.json(
      { error: "courseId is required" },
      { status: 400 },
    );
  }

  try {
    const enrolled = await isStudentEnrolled(auth.user.uid, courseId);
    return NextResponse.json({ data: { enrolled } });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: "Failed to check enrollment", detail },
      { status: 500 },
    );
  }
}
