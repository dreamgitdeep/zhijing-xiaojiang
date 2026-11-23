import { getAdminClient } from "./supabase-server";
import { getStudentRows } from "./repo";

/**
 * 植景设计任务学生统计——唯一聚合实现。
 * 任务管理卡片/详情与学情看板共用此口径，禁止在别处另写聚合。
 *
 * 口径（与评阅/结算逻辑一致）：
 * - 已提交 = stage_records 存在该任务的行（student_runs 有行仅代表进过工作台）；
 * - 各阶段最佳分 = 该生该阶段所有提交的最大 score；
 * - 总分 = Σ(阶段最佳分 × stageWeights)/100，缺交阶段计 0；
 * - 达标 = 总分 >= passScore（passScore 解析序与 review 路由一致）；
 * - 应提交 = 发布班级在册学生数（published_classes 为空 = 全部学生）；
 * - 统计范围只计发布范围内的学生，保证 提交率 = 已提交/应提交 分母分子同范围。
 */

/** 当前可提交评阅的阶段，与 /api/design/review 支持的 stageKey 同步；S4+ 开放时两处一起更新 */
export const OPEN_STAGES = ["S1", "S2", "S3", "S4", "S5", "S6"];

export interface StageStat {
  key: string;
  name: string;
  submitted: number;
  passed: number;
}

export interface TaskStats {
  taskId: string;
  title: string;
  status: string;
  publishedClasses: string[];
  expectedCount: number;
  submittedCount: number;
  /** 0-1；应提交为 0 时为 null（零除保护），展示端渲染为「—」 */
  submissionRate: number | null;
  passedCount: number;
  passScore: number;
  stageStats: StageStat[];
  lastSubmissionAt: string | null;
}

export interface StudentTaskRow {
  userId: string;
  name: string;
  studentNo: string;
  className: string;
  submitted: boolean;
  totalScore: number;
  /** 最终成绩 = S6 方案评估最佳分（收口阶段，一锤定音）；未提交 S6 为 null */
  finalScore: number | null;
  passed: boolean;
  stageBest: Record<string, number>;
  lastSubmissionAt: string | null;
  /** 学情（与学习管理大屏同口径，loadTaskStatsDetail 填充；computeTaskStats 默认 0） */
  mastered: number;
  attempts: number;
  chatCount: number;
  lastActiveAt: string | null;
}

interface StudentRef {
  id: string;
  name: string;
  student_no: string | null;
  class_code: string | null;
  class_name: string | null;
}

interface RunRef {
  id: string;
  task_id: string;
  user_id: string;
}

interface RecordRef {
  run_id: string;
  stage_key: string;
  score: number | null;
  created_at: string;
}

export function resolvePassScore(taskDef: Record<string, any> | null, nongyuan: Record<string, any> | null): number {
  const ps = nongyuan?.scoring?.passScore ?? taskDef?.passScore;
  return typeof ps === "number" && Number.isFinite(ps) ? ps : 60;
}

/** 纯函数聚合：单任务统计 + 学生明细。students 已按发布范围过滤。 */
export function computeTaskStats(
  task: { id: string; title: string; status: string; published_classes: string[]; task_def: Record<string, any> | null; nongyuan: Record<string, any> | null },
  students: StudentRef[],
  runs: RunRef[],
  records: RecordRef[],
): { stats: TaskStats; rows: StudentTaskRow[] } {
  const taskDef = task.task_def ?? {};
  const passScore = resolvePassScore(taskDef, task.nongyuan);
  const stageNames = new Map<string, string>((Array.isArray(taskDef.stages) ? taskDef.stages : []).map((s: any) => [s.key, s.name]));
  const openStages = OPEN_STAGES.filter((k) => (Array.isArray(taskDef.stages) ? taskDef.stages.some((s: any) => s.key === k && s.enabled !== false) : true));
  // stageWeights 缺失（教师新建任务未带权重）时按开放阶段等权兜底，避免总分恒 0；种子任务均带权重，不受影响
  const rawWeights: Record<string, unknown> = taskDef.stageWeights ?? {};
  const hasWeights = Object.values(rawWeights).some((w) => typeof w === "number" && w > 0);
  const weights: Record<string, number> = hasWeights
    ? Object.fromEntries(Object.entries(rawWeights).filter(([, w]) => typeof w === "number").map(([k, w]) => [k, w as number]))
    : Object.fromEntries(openStages.map((k) => [k, openStages.length ? 100 / openStages.length : 0]));

  const userByRun = new Map<string, string>();
  for (const r of runs) userByRun.set(r.id, r.user_id);
  const recordsByUser = new Map<string, RecordRef[]>();
  for (const rec of records) {
    const uid = userByRun.get(rec.run_id);
    if (!uid) continue;
    const list = recordsByUser.get(uid) ?? [];
    list.push(rec);
    recordsByUser.set(uid, list);
  }

  let submittedCount = 0;
  let passedCount = 0;
  let lastAt: string | null = null;
  const stageAgg = new Map<string, { submitted: Set<string>; passed: Set<string> }>(openStages.map((k) => [k, { submitted: new Set(), passed: new Set() }]));

  const rows: StudentTaskRow[] = students.map((s) => {
    const recs = recordsByUser.get(s.id) ?? [];
    const stageBest: Record<string, number> = {};
    let stuLast: string | null = null;
    for (const rec of recs) {
      if (typeof rec.score === "number" && (stageBest[rec.stage_key] == null || rec.score > stageBest[rec.stage_key])) {
        stageBest[rec.stage_key] = rec.score;
      }
      if (!stuLast || rec.created_at > stuLast) stuLast = rec.created_at;
    }
    let total = 0;
    for (const [key, w] of Object.entries(weights)) {
      if (typeof w === "number" && typeof stageBest[key] === "number") total += stageBest[key] * (w / 100);
    }
    total = Math.round(total * 10) / 10;
    const submitted = recs.length > 0;
    const passed = total >= passScore;
    if (submitted) {
      submittedCount += 1;
      if (stuLast && (!lastAt || stuLast > lastAt)) lastAt = stuLast;
      for (const key of openStages) {
        if (stageBest[key] != null) stageAgg.get(key)!.submitted.add(s.id);
        if (stageBest[key] != null && stageBest[key] >= passScore) stageAgg.get(key)!.passed.add(s.id);
      }
    }
    if (passed) passedCount += 1;
    return {
      userId: s.id,
      name: s.name ?? "",
      studentNo: s.student_no ?? "",
      className: s.class_name ?? "",
      submitted,
      totalScore: total,
      finalScore: stageBest["S6"] ?? null,
      passed,
      stageBest,
      lastSubmissionAt: stuLast,
      mastered: 0,
      attempts: 0,
      chatCount: 0,
      lastActiveAt: null,
    };
  });

  rows.sort((a, b) => Number(b.submitted) - Number(a.submitted) || b.totalScore - a.totalScore || a.studentNo.localeCompare(b.studentNo));

  return {
    stats: {
      taskId: task.id,
      title: task.title,
      status: task.status,
      publishedClasses: task.published_classes ?? [],
      expectedCount: students.length,
      submittedCount,
      submissionRate: students.length === 0 ? null : submittedCount / students.length,
      passedCount,
      passScore,
      stageStats: openStages.map((key) => ({
        key,
        name: stageNames.get(key) ?? key,
        submitted: stageAgg.get(key)!.submitted.size,
        passed: stageAgg.get(key)!.passed.size,
      })),
      lastSubmissionAt: lastAt,
    },
    rows,
  };
}

/** 发布范围内的学生；published_classes 为空 = 全部学生（与可见性规则一致） */
function studentsInScope(all: StudentRef[], publishedClasses: string[]): StudentRef[] {
  if (!publishedClasses?.length) return all;
  return all.filter((s) => s.class_code != null && publishedClasses.includes(s.class_code));
}

interface TaskRowLike {
  id: string;
  title: string;
  status: string;
  published_classes: string[] | null;
  task_def: Record<string, any> | null;
  nongyuan: Record<string, any> | null;
}

async function fetchScope(taskIds: string[]) {
  const admin = getAdminClient();
  const [{ data: students }, { data: runs }] = await Promise.all([
    admin.from("profiles").select("id, name, student_no, class_code, class_name").eq("role", "student"),
    taskIds.length ? admin.from("student_runs").select("id, task_id, user_id").in("task_id", taskIds) : Promise.resolve({ data: [] as RunRef[] }),
  ]);
  const runIds = (runs ?? []).map((r) => r.id);
  const { data: records } = runIds.length
    ? await admin.from("stage_records").select("run_id, stage_key, score, created_at").in("run_id", runIds)
    : { data: [] as RecordRef[] };
  return { students: (students ?? []) as StudentRef[], runs: (runs ?? []) as RunRef[], records: (records ?? []) as RecordRef[] };
}

/** 全部已发布任务的统计（列表页一次请求，查询数与任务数无关） */
export async function loadPublishedTaskStats(): Promise<TaskStats[]> {
  const admin = getAdminClient();
  const { data: tasks } = await admin
    .from("design_tasks")
    .select("id, title, status, published_classes, task_def, nongyuan")
    .eq("status", "published");
  const list = (tasks ?? []) as TaskRowLike[];
  if (!list.length) return [];
  const { students, runs, records } = await fetchScope(list.map((t) => t.id));
  return list.map((t) => {
    const scope = studentsInScope(students, t.published_classes ?? []);
    const runsForTask = runs.filter((r) => r.task_id === t.id);
    const runIdSet = new Set(runsForTask.map((r) => r.id));
    return computeTaskStats({ ...t, published_classes: t.published_classes ?? [] }, scope, runsForTask, records.filter((rec) => runIdSet.has(rec.run_id))).stats;
  });
}

/** 分页统计每个用户的问答消息数（supabase-js 单次上限 1000 行） */
async function fetchChatCounts(admin: ReturnType<typeof getAdminClient>, userIds: Set<string>): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!userIds.size) return counts;
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("chat_messages")
      .select("user_id")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`读取问答记录失败：${error.message}`);
    for (const r of (data ?? []) as { user_id: string }[]) {
      if (userIds.has(r.user_id)) counts.set(r.user_id, (counts.get(r.user_id) ?? 0) + 1);
    }
    if ((data ?? []).length < PAGE) break;
  }
  return counts;
}

/** 单任务统计 + 学生明细（详情下钻）；仅已发布任务，撤回任务不展示。学生行附带学情（掌握/练习/问答/最近活跃，与学习管理大屏同口径） */
export async function loadTaskStatsDetail(taskId: string): Promise<{ stats: TaskStats; rows: StudentTaskRow[] } | null> {
  const admin = getAdminClient();
  const { data: task } = await admin
    .from("design_tasks")
    .select("id, title, status, published_classes, task_def, nongyuan")
    .eq("id", taskId)
    .eq("status", "published")
    .maybeSingle();
  if (!task) return null;
  const t = task as TaskRowLike;
  const [{ students, runs, records }, learningRows] = await Promise.all([
    fetchScope([taskId]),
    getStudentRows(),
  ]);
  const scope = studentsInScope(students, t.published_classes ?? []);
  const runIdSet = new Set(runs.map((r) => r.id));
  const { stats, rows } = computeTaskStats({ ...t, published_classes: t.published_classes ?? [] }, scope, runs, records.filter((rec) => runIdSet.has(rec.run_id)));
  const learnByUser = new Map(learningRows.map((r) => [r.userId, r]));
  const chatCounts = await fetchChatCounts(admin, new Set(scope.map((s) => s.id)));
  return {
    stats,
    rows: rows.map((r) => {
      const lr = learnByUser.get(r.userId);
      return {
        ...r,
        mastered: lr?.mastered ?? 0,
        attempts: lr?.attempts ?? 0,
        chatCount: chatCounts.get(r.userId) ?? 0,
        lastActiveAt: lr?.lastActiveAt ?? null,
      };
    }),
  };
}
