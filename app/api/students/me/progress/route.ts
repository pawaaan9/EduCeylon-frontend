import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/server/auth-middleware";
import { getStudentProgress } from "@/lib/server/student-progress";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, "student");
  if (!auth.ok) return auth.response;

  try {
    const data = await getStudentProgress(auth.user.uid);
    return NextResponse.json({ data });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: "Failed to load progress", detail },
      { status: 500 },
    );
  }
}
