import { NextRequest, NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth";
import { getStudentDetail } from "@/lib/repo";

export async function GET(req: NextRequest) {
  const teacher = await requireTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "需要教师权限" }, { status: 403 });
  }
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "缺少 userId" }, { status: 400 });
  }
  const detail = await getStudentDetail(userId);
  return NextResponse.json(detail);
}
