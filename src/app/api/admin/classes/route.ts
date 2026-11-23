import { NextRequest, NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth";
import { createClass, listClasses } from "@/lib/repo";

export const runtime = "nodejs";

export async function GET() {
  const teacher = await requireTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "仅教师可操作" }, { status: 403 });
  }
  try {
    return NextResponse.json({ classes: await listClasses() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "查询失败" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const teacher = await requireTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "仅教师可操作" }, { status: 403 });
  }
  const body = await req.json();
  const result = await createClass(String(body?.name ?? ""));
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
