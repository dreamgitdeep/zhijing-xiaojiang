import { NextRequest, NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth";
import { deleteClass } from "@/lib/repo";

export const runtime = "nodejs";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "仅教师可操作" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const result = await deleteClass(String(id ?? ""));
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, unassigned: result.unassigned ?? 0 });
}
