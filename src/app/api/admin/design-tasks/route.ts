import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const teacher = await requireTeacher();
  if (!teacher) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { data, error } = await getAdminClient()
    .from("design_tasks")
    .select("id, case_id, title, subtitle, cover_url, tags, difficulty, est_minutes, intro, status, published_classes, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tasks: data ?? [] });
}

export async function POST(req: Request) {
  const teacher = await requireTeacher();
  if (!teacher) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const id = body.id || `task-custom-${Date.now().toString(36)}`;
  const row = {
    id,
    case_id: body.caseId || id,
    title: body.title || "未命名任务",
    subtitle: body.subtitle || null,
    cover_url: body.coverUrl || null,
    tags: body.tags ?? [],
    difficulty: body.difficulty || null,
    est_minutes: body.estMinutes ?? null,
    intro: body.intro || null,
    stages: body.stages ?? [],
    status: "draft",
    created_by: teacher.id,
  };
  const { error } = await getAdminClient().from("design_tasks").insert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id });
}
