import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { loadPublishedTaskStats, loadTaskStatsDetail } from "@/lib/design-stats";

export const dynamic = "force-dynamic";

// 只读聚合：仅教师可访问；只返回聚合数字与学号/姓名/状态标识，不含答案与评语正文。
// 未登录用 401（不用 requireTeacher，它未登录是 redirect）。
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (user.role !== "teacher") return NextResponse.json({ error: "仅教师可查看任务统计" }, { status: 403 });

  const taskId = req.nextUrl.searchParams.get("taskId");
  try {
    if (!taskId) {
      const stats = await loadPublishedTaskStats();
      return NextResponse.json({ stats });
    }
    const detail = await loadTaskStatsDetail(taskId);
    if (!detail) return NextResponse.json({ error: "任务不存在或未发布" }, { status: 404 });
    return NextResponse.json({ stats: detail.stats, students: detail.rows });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
