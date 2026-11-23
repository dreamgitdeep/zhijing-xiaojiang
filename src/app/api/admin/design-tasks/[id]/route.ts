import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  if (!teacher) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await ctx.params;
  const { data, error } = await getAdminClient().from("design_tasks").select("*").eq("id", id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ task: data });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  if (!teacher) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await ctx.params;
  const admin = getAdminClient();
  const { data: task } = await admin.from("design_tasks").select("status").eq("id", id).maybeSingle();
  if (!task) return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  if (task.status === "published") {
    return NextResponse.json({ error: "已发布的任务不能直接删除，请先在「管理发布班级」中撤回全部班级" }, { status: 400 });
  }
  const { data: runs } = await admin.from("student_runs").select("id").eq("task_id", id);
  const runIds = ((runs ?? []) as { id: string }[]).map((r) => r.id);
  if (runIds.length) {
    await admin.from("run_events").delete().in("run_id", runIds);
    await admin.from("stage_records").delete().in("run_id", runIds);
    await admin.from("student_runs").delete().in("id", runIds);
  }
  const { error } = await admin.from("design_tasks").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  if (!teacher) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) patch.title = body.title;
  if (body.subtitle !== undefined) patch.subtitle = body.subtitle;
  if (body.coverUrl !== undefined) patch.cover_url = body.coverUrl;
  if (body.tags !== undefined) patch.tags = body.tags;
  if (body.difficulty !== undefined) patch.difficulty = body.difficulty;
  if (body.estMinutes !== undefined) patch.est_minutes = body.estMinutes;
  if (body.intro !== undefined) patch.intro = body.intro;
  if (body.taskDef !== undefined) patch.task_def = body.taskDef;
  if (body.nongyuan !== undefined) patch.nongyuan = body.nongyuan;
  if (body.status !== undefined) {
    if (!["draft", "published", "archived"].includes(body.status))
      return NextResponse.json({ error: "BAD_STATUS" }, { status: 400 });
    patch.status = body.status;
  }
  if (body.publishedClasses !== undefined) {
    if (!Array.isArray(body.publishedClasses) || body.publishedClasses.some((c: unknown) => typeof c !== "string" || !c))
      return NextResponse.json({ error: "班级列表格式不正确" }, { status: 400 });
    patch.published_classes = body.publishedClasses;
  }
  if (body.status === "published") {
    const classes = body.publishedClasses ?? null;
    if (classes === null) {
      const { data: cur } = await getAdminClient().from("design_tasks").select("published_classes").eq("id", id).single();
      if (!Array.isArray(cur?.published_classes) || (cur!.published_classes as string[]).length === 0)
        return NextResponse.json({ error: "请先选择要发布的班级" }, { status: 400 });
    } else if (classes.length === 0) {
      return NextResponse.json({ error: "请至少选择一个班级再发布" }, { status: 400 });
    }
  }
  const { error } = await getAdminClient().from("design_tasks").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
