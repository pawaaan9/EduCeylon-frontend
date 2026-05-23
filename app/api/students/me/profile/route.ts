import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/server/auth-middleware";
import { saveStudentProfile } from "@/lib/server/student-profile";
import type { StudentProfile } from "@/lib/student/types";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest) {
  const auth = await requireRole(req, "student");
  if (!auth.ok) return auth.response;

  try {
    const body = (await req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const patch =
      body?.profile && typeof body.profile === "object"
        ? (body.profile as Partial<StudentProfile>)
        : (body as Partial<StudentProfile>);

    const result = await saveStudentProfile(auth.user.uid, {
      ...patch,
      email: auth.user.email ?? patch.email ?? "",
    });
    return NextResponse.json({ data: result });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: "Failed to save profile", detail },
      { status: 500 },
    );
  }
}
