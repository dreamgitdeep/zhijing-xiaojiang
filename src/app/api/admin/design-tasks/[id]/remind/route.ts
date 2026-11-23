import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth";
import { getAdminClient, isCloudConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

interface PendingStudent {
  userId: string;
  name: string;
  studentNo: string;
  className: string;
  hasRun: boolean;
}

async function getPending(taskId: string): Promise<{ title: string; pending: PendingStudent[] } | { error: string; status: number }> {
  const admin = getAdminClient();
  const { data: task } = await admin
    .from("design_tasks")
    .select("title, status, published_classes")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return { error: "任务不存在", status: 404 };
  if (task.status !== "published") return { error: "仅已发布的任务可以提醒学生", status: 400 };
  const codes: string[] = Array.isArray(task.published_classes) ? (task.published_classes as string[]) : [];
  let studentQuery = admin.from("profiles").select("id, name, student_no, class_name, class_code").eq("role", "student");
  if (codes.length > 0) studentQuery = studentQuery.in("class_code", codes);
  const { data: students, error: sErr } = await studentQuery;
  if (sErr) return { error: sErr.message, status: 500 };
  const { data: runs, error: rErr } = await admin
    .from("student_runs")
    .select("user_id, status")
    .eq("task_id", taskId);
  if (rErr) return { error: rErr.message, status: 500 };
  const runByUser = new Map(((runs ?? []) as { user_id: string; status: string }[]).map((r) => [r.user_id, r.status]));
  const pending = ((students ?? []) as { id: string; name: string | null; student_no: string | null; class_name: string | null }[])
    .filter((s) => runByUser.get(s.id) !== "completed")
    .map((s) => ({ userId: s.id, name: s.name ?? "", studentNo: s.student_no ?? "", className: s.class_name ?? "", hasRun: runByUser.has(s.id) }));
  return { title: task.title as string, pending };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  if (!teacher) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!isCloudConfigured()) return NextResponse.json({ error: "本地模式不支持消息通知" }, { status: 400 });
  const { id } = await ctx.params;
  const result = await getPending(id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ taskId: id, taskTitle: result.title, pending: result.pending });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  if (!teacher) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!isCloudConfigured()) return NextResponse.json({ error: "本地模式不支持消息通知" }, { status: 400 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 100) : "";
  const result = await getPending(id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (result.pending.length === 0) return NextResponse.json({ reminded: 0, skipped: 0 });
  const admin = getAdminClient();
  const pendingIds = result.pending.map((s) => s.userId);
  // 已有该任务未读提醒的学生不重复发送
  const { data: existing, error: eErr } = await admin
    .from("notifications")
    .select("user_id")
    .eq("task_id", id)
    .is("read_at", null)
    .in("user_id", pendingIds);
  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 });
  const already = new Set(((existing ?? []) as { user_id: string }[]).map((r) => r.user_id));
  const targets = result.pending.filter((s) => !already.has(s.userId));
  if (targets.length === 0) return NextResponse.json({ reminded: 0, skipped: already.size });
  const content = `请尽快完成植景设计任务「${result.title}」。${message ? `老师留言：${message}` : ""}`;
  const rows = targets.map((s) => ({
    user_id: s.userId,
    sender_id: teacher.id,
    type: "design_reminder",
    title: "植景设计任务提醒",
    content,
    task_id: id,
    link: `/design/${id}`,
  }));
  const { error } = await admin.from("notifications").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reminded: rows.length, skipped: already.size });
}
