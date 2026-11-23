/**
 * AI 学情分析——预定义指标执行器（四段式架构的 ③ 段）。
 *
 * 红线落地：
 * - 每个指标只走这里预定义的聚合函数，全部复用 repo.ts / design-stats.ts 的
 *   单一聚合实现（与学情看板、任务统计同口径），不另写统计；
 * - 所有数据库访问走 supabase-js 参数化查询（.eq/.in/.gte），绝不拼接 SQL；
 * - 返回的 table/chart/facts 数字全部来自查询结果，供 ④ 段 LLM 仅作表达。
 */
import { getAdminClient } from "@/lib/supabase-server";
import {
  getTeacherStats,
  getClassComparison,
  getStudentRows,
  getHardPlants,
  listPlants,
  type StudentRow,
} from "@/lib/repo";
import { loadPublishedTaskStats, loadTaskStatsDetail } from "@/lib/design-stats";
import type { QueryIntent, MetricKey } from "./intent";
import { metricLabel } from "./intent";

export interface ChartSpec {
  type: "bar" | "line";
  title: string;
  xKey: string;
  yKey: string;
  unit?: string;
  data: Record<string, string | number>[];
}

export interface AnalyticsBasis {
  metricKey: MetricKey;
  metricLabel: string;
  filtersDesc: string;
  hitCount: number;
  timeRangeDesc: string | null;
}

export interface MetricResult {
  basis: AnalyticsBasis;
  table: { columns: string[]; rows: (string | number)[][] };
  chart: ChartSpec | null;
  /** 注入给 ④ 段 LLM 的查询结果事实（数组或对象），数字全部来自查询 */
  facts: unknown;
}

export type MetricOutcome = { ok: true; result: MetricResult } | { ok: false; clarify: string };

export interface AnalyticsCatalog {
  classNames: string[];
  students: { name: string; studentNo: string; className: string }[];
  tasks: { id: string; title: string; status: string }[];
}

/** 供 ① 段 prompt 注入与 ② 段解析用的实体目录（都是小列表，植物名不注入） */
export async function loadCatalog(): Promise<AnalyticsCatalog> {
  const admin = getAdminClient();
  const [{ data: classes }, { data: students }, { data: tasks }] = await Promise.all([
    admin.from("classes").select("name"),
    admin.from("profiles").select("name, student_no, class_name").eq("role", "student"),
    admin.from("design_tasks").select("id, title, status"),
  ]);
  const classNames = [...new Set((classes ?? []).map((c) => c.name as string))];
  // profiles 里可能还有未进 classes 表的班级名，补进来
  for (const s of students ?? []) {
    if (s.class_name && !classNames.includes(s.class_name)) classNames.push(s.class_name);
  }
  return {
    classNames,
    students: (students ?? []).map((s) => ({
      name: (s.name ?? "") as string,
      studentNo: (s.student_no ?? "") as string,
      className: (s.class_name ?? "") as string,
    })),
    tasks: (tasks ?? []).map((t) => ({ id: t.id as string, title: t.title as string, status: t.status as string })),
  };
}

// ---------- 实体解析（②段：把 LLM 的模糊指称对齐到真实实体） ----------

function norm(s: string): string {
  return s.trim().toLowerCase();
}

export function resolveClassName(input: string | undefined, catalog: AnalyticsCatalog): string | null {
  if (!input) return null;
  const q = norm(input);
  const exact = catalog.classNames.find((c) => norm(c) === q);
  if (exact) return exact;
  const partial = catalog.classNames.find((c) => norm(c).includes(q) || q.includes(norm(c)));
  return partial ?? null;
}

export function resolveStudent(
  input: string | undefined,
  catalog: AnalyticsCatalog,
): { name: string; studentNo: string; className: string } | null {
  if (!input) return null;
  const q = norm(input);
  const exact = catalog.students.find((s) => norm(s.name) === q || s.studentNo === input.trim());
  if (exact) return exact;
  const partial = catalog.students.find(
    (s) => norm(s.name).includes(q) || q.includes(norm(s.name)) || s.studentNo.includes(input.trim()),
  );
  return partial ?? null;
}

export function resolveTask(
  input: string | undefined,
  catalog: AnalyticsCatalog,
): { id: string; title: string } | null {
  if (!input) return null;
  const q = norm(input);
  const exact = catalog.tasks.find((t) => norm(t.title) === q);
  if (exact) return { id: exact.id, title: exact.title };
  const partial = catalog.tasks.find((t) => norm(t.title).includes(q) || q.includes(norm(t.title)));
  return partial ? { id: partial.id, title: partial.title } : null;
}

function clamp(n: number | undefined, min: number, max: number, dflt: number): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return dflt;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function pct(ratio: number | null): string {
  return ratio === null ? "—" : `${Math.round(ratio * 100)}%`;
}

function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
}

// ---------- 各指标执行器 ----------

async function execOverview(): Promise<MetricOutcome> {
  const [stats, plants, taskStats] = await Promise.all([getTeacherStats(), listPlants(), loadPublishedTaskStats()]);
  const facts = [
    { 指标: "学生总数", 数值: stats.studentTotal },
    { 指标: "近7天活跃学生", 数值: stats.activeRecent },
    { 指标: "人均掌握种数", 数值: stats.avgMastered },
    { 指标: "练习总次数", 数值: stats.attemptTotal },
    { 指标: "植物库条数", 数值: plants.length },
    { 指标: "已发布任务数", 数值: taskStats.length },
  ];
  return {
    ok: true,
    result: {
      basis: {
        metricKey: "overview",
        metricLabel: metricLabel("overview"),
        filtersDesc: "全部学生",
        hitCount: stats.studentTotal,
        timeRangeDesc: null,
      },
      table: { columns: ["指标", "数值"], rows: facts.map((f) => [f.指标 as string, f.数值 as number]) },
      chart: null,
      facts,
    },
  };
}

async function execClassMastery(intent: QueryIntent, catalog: AnalyticsCatalog): Promise<MetricOutcome> {
  const className = resolveClassName(intent.filters?.className, catalog);
  const all = await getClassComparison();
  const rows = className ? all.filter((c) => c.className === className) : all;
  if (className && rows.length === 0) {
    return { ok: false, clarify: `没有找到「${className}」的掌握数据。当前班级有：${catalog.classNames.join("、") || "（暂无）"}。` };
  }
  const facts = rows.map((c) => ({ 班级: c.className, 人数: c.studentCount, 人均掌握种数: c.avgMastered }));
  return {
    ok: true,
    result: {
      basis: {
        metricKey: "class_mastery",
        metricLabel: metricLabel("class_mastery"),
        filtersDesc: className ? `班级=${className}` : "全部班级",
        hitCount: rows.length,
        timeRangeDesc: null,
      },
      table: { columns: ["班级", "人数", "人均掌握种数"], rows: rows.map((c) => [c.className, c.studentCount, c.avgMastered]) },
      chart: {
        type: "bar",
        title: "各班人均掌握种数",
        xKey: "班级",
        yKey: "人均掌握种数",
        unit: "种",
        data: facts,
      },
      facts,
    },
  };
}

function sortStudents(rows: StudentRow[], intent: QueryIntent): StudentRow[] {
  const sortBy = intent.sortBy ?? "mastered";
  const dir = intent.sortOrder === "asc" ? 1 : -1;
  const val = (s: StudentRow): number => {
    if (sortBy === "attempts") return s.attempts;
    if (sortBy === "avg") return s.avgScore ?? -1;
    if (sortBy === "active") return s.lastActiveAt ? new Date(s.lastActiveAt).getTime() : 0;
    return s.mastered;
  };
  return [...rows].sort((a, b) => (val(a) - val(b)) * dir);
}

async function execStudentRanking(intent: QueryIntent, catalog: AnalyticsCatalog): Promise<MetricOutcome> {
  const className = resolveClassName(intent.filters?.className, catalog);
  const student = resolveStudent(intent.filters?.studentName ?? intent.filters?.studentNo, catalog);
  let rows = await getStudentRows();
  const filterBits: string[] = [];
  if (student) {
    rows = rows.filter((r) => r.name === student.name || r.studentNo === student.studentNo);
    filterBits.push(`学生=${student.name}${student.studentNo ? `（${student.studentNo}）` : ""}`);
  } else if (className) {
    rows = rows.filter((r) => r.className === className);
    filterBits.push(`班级=${className}`);
  }
  if (className && student) {
    // 两个条件都给了，取交集已在上面 filter 链里
  }
  if (rows.length === 0) {
    return {
      ok: false,
      clarify: student
        ? `没有找到学生「${student.name}」。请确认姓名或学号。`
        : `没有找到「${className}」的学生。当前班级有：${catalog.classNames.join("、") || "（暂无）"}。`,
    };
  }
  rows = sortStudents(rows, intent);
  const limit = clamp(intent.limit, 1, 50, student ? 1 : 10);
  const top = rows.slice(0, limit);
  const facts = top.map((r) => ({
    姓名: r.name,
    学号: r.studentNo,
    班级: r.className || "未分班",
    已掌握种数: r.mastered,
    练习次数: r.attempts,
    平均正确率: r.avgScore === null ? "—" : `${r.avgScore}%`,
    最近活跃: r.lastActiveAt ? new Date(r.lastActiveAt).toLocaleDateString("zh-CN") : "未活跃",
  }));
  return {
    ok: true,
    result: {
      basis: {
        metricKey: "student_ranking",
        metricLabel: metricLabel("student_ranking"),
        filtersDesc: filterBits.length ? filterBits.join("，") : "全部学生",
        hitCount: top.length,
        timeRangeDesc: null,
      },
      table: {
        columns: ["姓名", "学号", "班级", "已掌握种数", "练习次数", "平均正确率", "最近活跃"],
        rows: top.map((r) => [
          r.name,
          r.studentNo || "-",
          r.className || "未分班",
          r.mastered,
          r.attempts,
          r.avgScore === null ? "—" : `${r.avgScore}%`,
          r.lastActiveAt ? new Date(r.lastActiveAt).toLocaleDateString("zh-CN") : "未活跃",
        ]),
      },
      chart:
        top.length > 1
          ? {
              type: "bar",
              title: "学生已掌握种数",
              xKey: "姓名",
              yKey: "已掌握种数",
              unit: "种",
              data: facts,
            }
          : null,
      facts,
    },
  };
}

async function execPracticeTrend(intent: QueryIntent, catalog: AnalyticsCatalog): Promise<MetricOutcome> {
  const days = clamp(intent.filters?.days, 1, 90, 14);
  const className = resolveClassName(intent.filters?.className, catalog);
  const admin = getAdminClient();

  let userIds: string[] | null = null;
  if (className) {
    const { data: cls } = await admin.from("profiles").select("id").eq("role", "student").eq("class_name", className);
    userIds = (cls ?? []).map((r) => r.id as string);
    if (userIds.length === 0) {
      return { ok: false, clarify: `「${className}」暂时没有学生。当前班级有：${catalog.classNames.join("、") || "（暂无）"}。` };
    }
  }

  let q = admin.from("quiz_attempts").select("user_id, score, total, created_at").gte("created_at", daysAgoISO(days));
  if (userIds) q = q.in("user_id", userIds);
  const { data: attempts } = await q;

  // 按天聚合（本地时区日期）
  const byDay = new Map<string, { count: number; score: number; total: number }>();
  for (const a of attempts ?? []) {
    const d = new Date(a.created_at);
    const key = `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, "0")}`;
    const e = byDay.get(key) ?? { count: 0, score: 0, total: 0 };
    e.count += 1;
    e.score += a.score;
    e.total += a.total;
    byDay.set(key, e);
  }
  const sorted = [...byDay.entries()].sort((a, b) => {
    const [am, ad] = a[0].split("-").map(Number);
    const [bm, bd] = b[0].split("-").map(Number);
    return am - bm || ad - bd;
  });
  const facts = sorted.map(([date, v]) => ({
    日期: date,
    练习次数: v.count,
    平均正确率: v.total > 0 ? `${Math.round((v.score / v.total) * 100)}%` : "—",
  }));
  const totalAttempts = (attempts ?? []).length;
  return {
    ok: true,
    result: {
      basis: {
        metricKey: "practice_trend",
        metricLabel: metricLabel("practice_trend"),
        filtersDesc: className ? `班级=${className}` : "全部学生",
        hitCount: totalAttempts,
        timeRangeDesc: `近 ${days} 天`,
      },
      table: { columns: ["日期", "练习次数", "平均正确率"], rows: sorted.map(([date, v]) => [date, v.count, v.total > 0 ? `${Math.round((v.score / v.total) * 100)}%` : "—"]) },
      chart: {
        type: "line",
        title: `近 ${days} 天练习次数`,
        xKey: "日期",
        yKey: "练习次数",
        unit: "次",
        data: facts,
      },
      facts,
    },
  };
}

async function execPlantDifficulty(intent: QueryIntent): Promise<MetricOutcome> {
  const hard = await getHardPlants();
  if (hard.length === 0) {
    return { ok: false, clarify: "还没有任何练习记录，暂时无法统计植物难度。等学生开始练习后再来吧。" };
  }
  // getHardPlants 已按平均正确率升序（最难在前）；asc=最难，desc=最易
  const dir = intent.sortOrder === "desc" ? [...hard].reverse() : hard;
  const limit = clamp(intent.limit, 1, 50, 8);
  const top = dir.slice(0, limit);
  const facts = top.map((p) => ({
    植物: p.name,
    练习次数: p.attempts,
    平均正确率: `${Math.round(p.avgScoreRatio * 100)}%`,
  }));
  return {
    ok: true,
    result: {
      basis: {
        metricKey: "plant_difficulty",
        metricLabel: metricLabel("plant_difficulty"),
        filtersDesc: intent.sortOrder === "desc" ? "最易在前" : "最难在前",
        hitCount: top.length,
        timeRangeDesc: null,
      },
      table: { columns: ["植物", "练习次数", "平均正确率"], rows: top.map((p) => [p.name, p.attempts, `${Math.round(p.avgScoreRatio * 100)}%`]) },
      chart: {
        type: "bar",
        title: "植物平均正确率",
        xKey: "植物",
        yKey: "平均正确率",
        unit: "",
        data: top.map((p) => ({ 植物: p.name, 平均正确率: Math.round(p.avgScoreRatio * 100) })),
      },
      facts,
    },
  };
}

async function execTaskSubmission(intent: QueryIntent, catalog: AnalyticsCatalog): Promise<MetricOutcome> {
  const task = resolveTask(intent.filters?.taskTitle, catalog);
  const all = await loadPublishedTaskStats();
  if (all.length === 0) {
    return { ok: false, clarify: "当前没有已发布的设计任务，无法统计提交情况。" };
  }
  const rows = task ? all.filter((t) => t.taskId === task.id) : all;
  if (task && rows.length === 0) {
    return { ok: false, clarify: `任务「${task.title}」尚未发布或不存在提交统计。已发布任务有：${all.map((t) => t.title).join("、")}。` };
  }
  const facts = rows.map((t) => ({
    任务: t.title,
    应提交: t.expectedCount,
    已提交: t.submittedCount,
    提交率: pct(t.submissionRate),
    达标: t.passedCount,
  }));
  return {
    ok: true,
    result: {
      basis: {
        metricKey: "task_submission",
        metricLabel: metricLabel("task_submission"),
        filtersDesc: task ? `任务=${task.title}` : "全部已发布任务",
        hitCount: rows.length,
        timeRangeDesc: null,
      },
      table: { columns: ["任务", "应提交", "已提交", "提交率", "达标"], rows: rows.map((t) => [t.title, t.expectedCount, t.submittedCount, pct(t.submissionRate), t.passedCount]) },
      chart: {
        type: "bar",
        title: "任务提交率",
        xKey: "任务",
        yKey: "提交率",
        unit: "%",
        data: rows.map((t) => ({ 任务: t.title, 提交率: t.submissionRate === null ? 0 : Math.round(t.submissionRate * 100) })),
      },
      facts,
    },
  };
}

async function execTaskStageScores(intent: QueryIntent, catalog: AnalyticsCatalog): Promise<MetricOutcome> {
  const task = resolveTask(intent.filters?.taskTitle, catalog);
  if (!task) {
    const titles = catalog.tasks.filter((t) => t.status === "published").map((t) => t.title);
    return { ok: false, clarify: `请告诉我要看哪个任务的阶段得分。当前任务有：${titles.join("、") || catalog.tasks.map((t) => t.title).join("、") || "（暂无）"}。` };
  }
  const detail = await loadTaskStatsDetail(task.id);
  if (!detail) {
    return { ok: false, clarify: `任务「${task.title}」尚未发布，暂无阶段得分统计。` };
  }
  const { stats, rows } = detail;
  const stageFacts = stats.stageStats.map((s) => ({ 阶段: s.name, 提交人数: s.submitted, 达标人数: s.passed }));
  const studentRows = rows.map((r) => ({
    姓名: r.name,
    学号: r.studentNo,
    班级: r.className || "未分班",
    总分: r.totalScore,
    是否达标: r.passed ? "达标" : "未达标",
    已提交: r.submitted ? "是" : "否",
  }));
  return {
    ok: true,
    result: {
      basis: {
        metricKey: "task_stage_scores",
        metricLabel: metricLabel("task_stage_scores"),
        filtersDesc: `任务=${task.title}`,
        hitCount: rows.length,
        timeRangeDesc: null,
      },
      table: {
        columns: ["姓名", "学号", "班级", "总分", "是否达标", "已提交"],
        rows: rows.map((r) => [r.name, r.studentNo || "-", r.className || "未分班", r.totalScore, r.passed ? "达标" : "未达标", r.submitted ? "是" : "否"]),
      },
      chart: {
        type: "bar",
        title: `${task.title} · 各阶段提交人数`,
        xKey: "阶段",
        yKey: "提交人数",
        unit: "人",
        data: stageFacts,
      },
      facts: { 阶段统计: stageFacts, 学生明细: studentRows, 及格线: stats.passScore, 提交率: pct(stats.submissionRate) },
    },
  };
}

async function execActiveStudents(intent: QueryIntent, catalog: AnalyticsCatalog): Promise<MetricOutcome> {
  const days = clamp(intent.filters?.days, 1, 90, 7);
  const mode = intent.filters?.activeMode ?? "inactive";
  const className = resolveClassName(intent.filters?.className, catalog);
  const admin = getAdminClient();

  let studentQ = admin.from("profiles").select("id, name, student_no, class_name").eq("role", "student");
  if (className) studentQ = studentQ.eq("class_name", className);
  const { data: students } = await studentQ;
  const list = students ?? [];
  if (list.length === 0) {
    return { ok: false, clarify: className ? `「${className}」暂时没有学生。` : "还没有学生。" };
  }
  const ids = list.map((s) => s.id as string);
  const { data: attempts } = await admin
    .from("quiz_attempts")
    .select("user_id, created_at")
    .in("user_id", ids)
    .gte("created_at", daysAgoISO(days));
  const activeSet = new Set((attempts ?? []).map((a) => a.user_id as string));

  // 每人最近一次练习时间（用于未活跃名单展示"上次活跃"）
  const { data: lastAttempts } = await admin
    .from("quiz_attempts")
    .select("user_id, created_at")
    .in("user_id", ids)
    .order("created_at", { ascending: false })
    .limit(1000);
  const lastByUser = new Map<string, string>();
  for (const a of lastAttempts ?? []) {
    if (!lastByUser.has(a.user_id as string)) lastByUser.set(a.user_id as string, a.created_at as string);
  }

  const picked = list.filter((s) => (mode === "active" ? activeSet.has(s.id as string) : !activeSet.has(s.id as string)));
  const facts = picked.map((s) => ({
    姓名: s.name,
    学号: s.student_no || "-",
    班级: s.class_name || "未分班",
    最近活跃: lastByUser.has(s.id as string) ? new Date(lastByUser.get(s.id as string)!).toLocaleDateString("zh-CN") : "从未练习",
  }));
  return {
    ok: true,
    result: {
      basis: {
        metricKey: "active_students",
        metricLabel: metricLabel("active_students"),
        filtersDesc: `${mode === "active" ? "活跃" : "未活跃"}${className ? `，班级=${className}` : ""}`,
        hitCount: picked.length,
        timeRangeDesc: `近 ${days} 天`,
      },
      table: { columns: ["姓名", "学号", "班级", "最近活跃"], rows: picked.map((s) => [s.name as string, (s.student_no as string) || "-", (s.class_name as string) || "未分班", lastByUser.has(s.id as string) ? new Date(lastByUser.get(s.id as string)!).toLocaleDateString("zh-CN") : "从未练习"]) },
      chart: null,
      facts,
    },
  };
}

// ---------- 统一入口 ----------

export async function executeMetric(intent: QueryIntent, catalog: AnalyticsCatalog): Promise<MetricOutcome> {
  switch (intent.metric) {
    case "overview":
      return execOverview();
    case "class_mastery":
      return execClassMastery(intent, catalog);
    case "student_ranking":
      return execStudentRanking(intent, catalog);
    case "practice_trend":
      return execPracticeTrend(intent, catalog);
    case "plant_difficulty":
      return execPlantDifficulty(intent);
    case "task_submission":
      return execTaskSubmission(intent, catalog);
    case "task_stage_scores":
      return execTaskStageScores(intent, catalog);
    case "active_students":
      return execActiveStudents(intent, catalog);
    default:
      return { ok: false, clarify: "我还不支持这类统计，换个问法试试。" };
  }
}
