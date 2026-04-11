// app/app/api/admin/waitlist/route.ts
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/middleware";
import { getPendingWaitlist } from "@/lib/db/queries";

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const entries = getPendingWaitlist();
  return NextResponse.json({ entries });
}

export async function PATCH() {
  return NextResponse.json(
    { error: "Use /api/admin/waitlist/[id] for approve/deny" },
    { status: 400 }
  );
}
