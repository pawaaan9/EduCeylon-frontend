import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/server/auth-middleware";
import { uploadStudentPhoto } from "@/lib/server/student-profile";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "student");
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const fileName =
    typeof body?.fileName === "string" ? body.fileName : "photo.jpg";
  const contentType =
    typeof body?.contentType === "string" ? body.contentType : "image/jpeg";
  const dataBase64 =
    typeof body?.dataBase64 === "string" ? body.dataBase64 : "";

  if (!dataBase64) {
    return NextResponse.json(
      { error: "dataBase64 is required" },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(dataBase64, "base64");
    const url = await uploadStudentPhoto(
      auth.user.uid,
      fileName,
      contentType,
      buffer,
    );
    return NextResponse.json({ data: { url } });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: "Failed to upload photo", detail },
      { status: 500 },
    );
  }
}
