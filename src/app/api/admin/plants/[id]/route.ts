import { NextRequest, NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const teacher = await requireTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "仅教师可操作" }, { status: 403 });
  }
  const { id } = await params;
  const admin = getAdminClient();
  const { error } = await admin.from("plants").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
