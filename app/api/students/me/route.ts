import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/server/auth-middleware";
import { getStudentProfileByUid } from "@/lib/server/student-profile";
import { emptyStudentProfile } from "@/lib/student/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, "student");
  if (!auth.ok) return auth.response;

  try {
    const profile = await getStudentProfileByUid(auth.user.uid);
    if (!profile) {
      return NextResponse.json({
        data: emptyStudentProfile(
          auth.user.uid,
          auth.user.email ?? "",
          auth.user.name ?? "",
        ),
      });
    }
    return NextResponse.json({ data: profile });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: "Failed to read profile", detail },
      { status: 500 },
    );
  }
}
