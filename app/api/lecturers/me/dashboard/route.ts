import { NextResponse, type NextRequest } from "next/server";
import { verifyBearerToken } from "@/lib/server/auth-middleware";
import { getLecturerDashboard } from "@/lib/server/lecturer-dashboard";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await verifyBearerToken(req);
  if (!auth.ok) return auth.response;

  try {
    const data = await getLecturerDashboard(auth.user.uid);
    return NextResponse.json({ data });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: "Failed to load dashboard", detail },
      { status: 500 },
    );
  }
}
