import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getTaskFull, ensureRun, saveStageRecord, patchRun } from "@/lib/design";
import { getDemoAnswer, DEMO_STUDENT_NO } from "@/lib/design-demo-answers";

export const dynamic = "force-dynamic";

/**
 * 演示答案一键应用（仅指定演示账号）：把预置的标准作答写入当前阶段，
 * 按满分记成绩并解锁下一阶段，供演示人员快速展示全流程。
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (user.studentNo !== DEMO_STUDENT_NO) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const taskId = String(body?.taskId ?? "");
  const stageKey = String(body?.stageKey ?? "");
  if (!taskId || !stageKey) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const full = await getTaskFull(taskId);
  if (!full) return NextResponse.json({ error: "TASK_NOT_FOUND" }, { status: 404 });

  const demo = getDemoAnswer(taskId, stageKey);
  if (!demo) return NextResponse.json({ error: "DEMO_ANSWER_NOT_FOUND" }, { status: 404 });

  const { task, nongyuan } = full;
  const passScore = nongyuan.scoring?.passScore ?? task.passScore ?? 60;
  const run = await ensureRun(taskId, user.id);

  const review = { rule: { demo: true }, ...demo.review };
  await saveStageRecord(run.id, stageKey, { payload: demo.payload, meta: demo.meta }, review, 100, passScore);

  if (stageKey === "S6") {
    await patchRun(run.id, { total_score: 100, status: "completed" });
  }

  return NextResponse.json({ ok: true, stageKey, score: 100, passScore });
}
