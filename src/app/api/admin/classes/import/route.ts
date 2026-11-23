import { NextRequest, NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth";
import { importRoster, type RosterRow } from "@/lib/repo";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const teacher = await requireTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "仅教师可操作" }, { status: 403 });
  }
  const body = await req.json();
  const classId = String(body?.classId ?? "");
  const rows = Array.isArray(body?.rows)
    ? (body.rows as RosterRow[]).filter((r) => r && typeof r.studentNo === "string" && r.studentNo.trim())
    : [];
  if (!classId || rows.length === 0) {
    return NextResponse.json({ error: "请选择班级并填写名单" }, { status: 400 });
  }
  try {
    const result = await importRoster(classId, rows);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "导入失败" }, { status: 500 });
  }
}
