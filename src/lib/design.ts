import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getAdminClient, isCloudConfigured } from "./supabase-server";

export interface DesignTaskLite {
  id: string;
  caseId: string;
  title: string;
  subtitle?: string;
  coverUrl?: string;
  tags: string[];
  difficulty?: string;
  estMinutes?: number;
  intro?: string;
  stageCount: number;
  status: string;
}

export interface DesignTaskFull {
  task: Record<string, any>;
  nongyuan: Record<string, any>;
}

export interface StudentRun {
  id: string;
  task_id: string;
  user_id: string;
  current_stage: string;
  unlocked_stages: string[];
  stage_payloads: Record<string, any>;
  stage_reviews: Record<string, any>;
  stage_scores: Record<string, number>;
  status: string;
  total_score: number | null;
}

let localCache: DesignTaskFull | null = null;
export function loadLocalTask(): DesignTaskFull {
  if (!localCache) {
    const base = join(process.cwd(), "public/data/tasks");
    localCache = {
      task: JSON.parse(readFileSync(join(base, "chuangzhi-task.json"), "utf8")),
      nongyuan: JSON.parse(readFileSync(join(base, "chuangzhi-nongyuan.json"), "utf8")),
    };
  }
  return localCache;
}

function thumbFrom(row: Record<string, any>): string | undefined {
  const media = row.task_def?.media;
  const first = Array.isArray(media) ? media.find((m: any) => m?.url) : media;
  if (!first?.url) return row.cover_url ?? undefined;
  if (first.type === "image") return first.url;
  return first.poster ?? row.cover_url ?? undefined;
}

function toLite(row: Record<string, any>): DesignTaskLite {
  return {
    id: row.id,
    caseId: row.case_id,
    title: row.title,
    subtitle: row.subtitle,
    coverUrl: thumbFrom(row),
    tags: row.tags ?? [],
    difficulty: row.difficulty,
    estMinutes: row.est_minutes,
    intro: row.intro,
    stageCount: (row.stages ?? []).length,
    status: row.status,
  };
}

export async function listPublishedTasks(classCode?: string | null): Promise<DesignTaskLite[]> {
  if (!isCloudConfigured()) {
    const { task } = loadLocalTask();
    return [toLite({ id: task.id, case_id: task.caseId, title: task.name, subtitle: task.subtitle, cover_url: task.cover, tags: task.tags, difficulty: task.difficulty, est_minutes: (task.hours ?? 2) * 45, intro: task.intro, stages: task.stages, status: "published" })];
  }
  const admin = getAdminClient();
  const { data } = await admin.from("tasks_student_view").select("*").order("id");
  return (data ?? [])
    .filter((row) => {
      const classes = Array.isArray(row.published_classes) ? (row.published_classes as string[]) : [];
      return classes.length === 0 || (classCode != null && classes.includes(classCode));
    })
    .map(toLite);
}

export async function getTaskFull(taskId: string): Promise<DesignTaskFull | null> {
  if (!isCloudConfigured()) {
    const local = loadLocalTask();
    return local.task.id === taskId ? local : null;
  }
  const admin = getAdminClient();
  const { data } = await admin.from("design_tasks").select("task_def, nongyuan, intro").eq("id", taskId).maybeSingle();
  if (!data?.task_def) return null;
  // 教师端「任务简介」存于 intro 列（task_def 内无此键），并入 task 供学生端案例卡播报/展示
  return { task: { ...data.task_def, intro: data.intro ?? data.task_def.intro }, nongyuan: data.nongyuan };
}

export async function getRun(taskId: string, userId: string): Promise<StudentRun | null> {
  const admin = getAdminClient();
  const { data } = await admin.from("student_runs").select("*").eq("task_id", taskId).eq("user_id", userId).maybeSingle();
  return (data as StudentRun) ?? null;
}

/* ============ 学生成绩单（学习管理用）：各阶段最佳分 + AI 评阅记录 + 最终成绩 ============ */
export interface TranscriptStage {
  key: string;
  name: string;
  bestScore: number | null;
  attempts: number;
  feedback: string;
}
export interface DesignTranscriptTask {
  taskId: string;
  title: string;
  status: string;
  finalScore: number | null;
  stages: TranscriptStage[];
}

/** 取当前学生在所有已发布任务的成绩单；local 模式数据在浏览器端，服务端返回空 */
export async function getMyDesignTranscripts(userId: string): Promise<DesignTranscriptTask[]> {
  if (!isCloudConfigured()) return [];
  const admin = getAdminClient();
  const { data: tasks } = await admin.from("design_tasks").select("id, title, status, task_def").eq("status", "published");
  if (!tasks?.length) return [];
  const taskIds = tasks.map((t) => t.id);
  const { data: runs } = await admin.from("student_runs").select("id, task_id, status, total_score").eq("user_id", userId).in("task_id", taskIds);
  if (!runs?.length) return [];
  const runIds = runs.map((r) => r.id);
  const { data: records } = await admin
    .from("stage_records")
    .select("run_id, stage_key, score, review, created_at")
    .in("run_id", runIds)
    .order("created_at", { ascending: true });

  const recordsByRun = new Map<string, any[]>();
  for (const rec of records ?? []) {
    const list = recordsByRun.get(rec.run_id) ?? [];
    list.push(rec);
    recordsByRun.set(rec.run_id, list);
  }

  const out: DesignTranscriptTask[] = [];
  for (const task of tasks) {
    const run = runs.find((r) => r.task_id === task.id);
    if (!run) continue;
    const stageNames = new Map<string, string>(((task.task_def?.stages ?? []) as any[]).map((s) => [s.key, s.name]));
    const recs = recordsByRun.get(run.id) ?? [];
    const byStage = new Map<string, { best: number; attempts: number; feedback: string }>();
    for (const rec of recs) {
      const cur = byStage.get(rec.stage_key) ?? { best: -1, attempts: 0, feedback: "" };
      cur.attempts += 1;
      if (typeof rec.score === "number" && rec.score > cur.best) {
        cur.best = rec.score;
        cur.feedback = String(rec.review?.feedback ?? "");
      }
      byStage.set(rec.stage_key, cur);
    }
    const stages: TranscriptStage[] = [...byStage.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, v]) => ({ key, name: stageNames.get(key) ?? key, bestScore: v.best >= 0 ? v.best : null, attempts: v.attempts, feedback: v.feedback }));
    const s6 = byStage.get("S6");
    out.push({
      taskId: task.id,
      title: task.title,
      status: run.status ?? "in_progress",
      finalScore: typeof run.total_score === "number" ? run.total_score : s6 && s6.best >= 0 ? s6.best : null,
      stages,
    });
  }
  return out;
}

export async function ensureRun(taskId: string, userId: string): Promise<StudentRun> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("student_runs")
    .upsert({ task_id: taskId, user_id: userId }, { onConflict: "task_id,user_id" })
    .select()
    .single();
  if (error) throw error;
  return data as StudentRun;
}

export async function patchRun(runId: string, patch: Record<string, any>): Promise<void> {
  const admin = getAdminClient();
  await admin.from("student_runs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", runId);
}

/** 「直接退出」：清空某学生在某任务的全部进度（事件 → 阶段记录 → run 本体） */
export async function resetRun(taskId: string, userId: string): Promise<void> {
  const admin = getAdminClient();
  const { data: row } = await admin.from("student_runs").select("id").eq("task_id", taskId).eq("user_id", userId).maybeSingle();
  if (!row) return;
  const runId = row.id as string;
  await admin.from("run_events").delete().eq("run_id", runId);
  await admin.from("stage_records").delete().eq("run_id", runId);
  await admin.from("student_runs").delete().eq("id", runId);
}

export async function addStageRecord(runId: string, stageKey: string, attemptNo: number, payload: any, review: any, score: number | null): Promise<void> {
  const admin = getAdminClient();
  await admin.from("stage_records").insert({ run_id: runId, stage_key: stageKey, attempt_no: attemptNo, payload, review, score });
}

export async function addRunEvent(runId: string, eventType: string, meta: Record<string, any> = {}): Promise<void> {
  const admin = getAdminClient();
  await admin.from("run_events").insert({ run_id: runId, event_type: eventType, meta });
}

const NEXT_STAGE: Record<string, string> = { S1: "S2", S2: "S3", S3: "S4", S4: "S5", S5: "S6" };

export async function saveStageRecord(runId: string, stageKey: string, payload: any, review: any, score: number | null, passScore = 60): Promise<{ attemptNo: number; bestScore: number | null }> {
  const admin = getAdminClient();
  const { data: prev } = await admin
    .from("stage_records")
    .select("attempt_no, score")
    .eq("run_id", runId)
    .eq("stage_key", stageKey)
    .order("attempt_no", { ascending: false });
  const attemptNo = (prev?.[0]?.attempt_no ?? 0) + 1;
  const bestScore = (prev ?? []).reduce<number | null>((max, r) => (typeof r.score === "number" && (max == null || r.score > max) ? r.score : max), null);
  await admin.from("stage_records").insert({ run_id: runId, stage_key: stageKey, attempt_no: attemptNo, payload, review, score });

  const { data: run } = await admin.from("student_runs").select("*").eq("id", runId).single();
  const scores = { ...(run?.stage_scores ?? {}), [stageKey]: score };
  const reviews = { ...(run?.stage_reviews ?? {}), [stageKey]: review };
  const payloads = { ...(run?.stage_payloads ?? {}), [stageKey]: payload };
  const unlocked: string[] = run?.unlocked_stages ?? ["S1"];
  const nxt = NEXT_STAGE[stageKey];
  const passed = score != null && score >= passScore;
  const newUnlocked = passed && nxt && !unlocked.includes(nxt) ? [...unlocked, nxt] : unlocked;
  await admin
    .from("student_runs")
    .update({
      stage_scores: scores,
      stage_reviews: reviews,
      stage_payloads: payloads,
      unlocked_stages: newUnlocked,
      current_stage: newUnlocked[newUnlocked.length - 1],
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId);
  return { attemptNo, bestScore };
}
