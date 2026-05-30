import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/server/auth-middleware";
import { saveStudentStudyLog } from "@/lib/server/student-study-log";

export const runtime = "nodejs";

export async function PUT(req: NextRequest) {
  const auth = await requireRole(req, "student");
  if (!auth.ok) return auth.response;

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const date = typeof body.date === "string" ? body.date.trim() : "";
    const minutesStudied = Number(body.minutesStudied);
    const subjects = Array.isArray(body.subjects)
      ? body.subjects.filter((s): s is string => typeof s === "string")
      : undefined;
    const note = typeof body.note === "string" ? body.note : undefined;

    if (!date) {
      return NextResponse.json({ error: "date is required" }, { status: 400 });
    }

    const entry = await saveStudentStudyLog(auth.user.uid, {
      date,
      minutesStudied,
      subjects,
      note,
    });

    return NextResponse.json({ data: entry });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: "Failed to save study log", detail },
      { status: 400 },
    );
  }
}
