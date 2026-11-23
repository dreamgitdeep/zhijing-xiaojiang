import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { isCloudConfigured } from "@/lib/supabase-server";
import { addRunEvent, ensureRun, getRun, patchRun, resetRun } from "@/lib/design";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ run: null });
  if (!isCloudConfigured()) return NextResponse.json({ run: null });
  const taskId = new URL(req.url).searchParams.get("taskId");
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });
  try {
    const run = await getRun(taskId, auth.userId);
    return NextResponse.json({ run });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!isCloudConfigured()) return NextResponse.json({ ok: true, run: null });
  try {
    const body = await req.json();
    const { taskId, currentStage, event, meta } = body as {
      taskId: string;
      currentStage?: string;
      event?: string;
      meta?: Record<string, unknown>;
    };
    if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });
    const run = await ensureRun(taskId, auth.userId);
    if (currentStage) await patchRun(run.id, { current_stage: currentStage });
    if (event) await addRunEvent(run.id, event, meta ?? {});
    const updated = await getRun(taskId, auth.userId);
    return NextResponse.json({ ok: true, run: updated });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// 「直接退出」：清空当前学生在该任务的全部进度
export async function DELETE(req: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!isCloudConfigured()) return NextResponse.json({ ok: true });
  const taskId = new URL(req.url).searchParams.get("taskId");
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });
  try {
    await resetRun(taskId, auth.userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
