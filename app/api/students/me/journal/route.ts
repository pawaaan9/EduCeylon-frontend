import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/server/auth-middleware";
import { getStudentJournal } from "@/lib/server/student-study-log";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, "student");
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const year = Number(searchParams.get("year")) || now.getFullYear();
  const month = Number(searchParams.get("month")) || now.getMonth() + 1;

  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  }

  try {
    const data = await getStudentJournal(auth.user.uid, year, month);
    return NextResponse.json({ data });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: "Failed to load journal", detail },
      { status: 500 },
    );
  }
}
