import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/middleware";
import { getStudyImages } from "@/lib/images/queries";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response: authResponse } = await requireAdmin();
  if (authResponse) return authResponse;
  void request;

  const { id } = await params;
  const studyId = parseInt(id, 10);
  if (isNaN(studyId)) {
    return NextResponse.json({ error: "Invalid study ID" }, { status: 400 });
  }

  const images = getStudyImages(studyId);
  return NextResponse.json({ images });
}
