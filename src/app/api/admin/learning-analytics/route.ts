import { NextRequest } from "next/server";
import { LLMClient } from "coze-coding-dev-sdk";
import { getSessionUser } from "@/lib/auth";
import { METRIC_CATALOG, METRIC_KEYS, metricLabel, type QueryIntent, type MetricKey } from "@/lib/analytics/intent";
import { loadCatalog, executeMetric, type MetricResult } from "@/lib/analytics/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "doubao-seed-2-0-lite-260215";

function sse(obj: Record<string, unknown>) {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

/** 收集一次非流式 LLM 输出的完整文本（用于解析结构化 JSON） */
async function collectText(messages: { role: "system" | "user"; content: string }[]): Promise<string> {
  const llm = new LLMClient();
  const events = llm.stream(messages, { model: MODEL });
  let text = "";
  for await (const event of events) {
    text += typeof event?.content === "string" ? event.content : event?.content?.toString() ?? "";
  }
  return text;
}

/** ① 段：把教师自然语言问题解析为结构化查询意图（白名单字段） */
function buildIntentPrompt(question: string, catalog: { classNames: string[]; students: { name: string; studentNo: string; className: string }[]; tasks: { id: string; title: string; status: string }[] }): string {
  const metricList = METRIC_CATALOG.map((m) => `- ${m.key}（${m.label}）：${m.desc}`).join("\n");
  const studentList = catalog.students.slice(0, 60).map((s) => `${s.name}${s.studentNo ? `/${s.studentNo}` : ""}${s.className ? `（${s.className}）` : ""}`).join("、") || "（暂无）";
  const taskList = catalog.tasks.map((t) => t.title).join("、") || "（暂无）";
  const classList = catalog.classNames.join("、") || "（暂无）";
  return `你是学情数据分析器的"意图解析"模块。把教师的问题解析成一个结构化查询意图，只输出 JSON，不要任何解释。

【可选指标 metric，只能从中选一个】
${metricList}

【真实存在的班级】${classList}
【真实存在的学生】${studentList}
【真实存在的设计任务】${taskList}

【输出 JSON 字段约定】
{
  "metric": "上面某个指标 key",
  "filters": {
    "className": "班级名（可选，尽量用上面真实班级名）",
    "studentName": "学生姓名（可选）",
    "studentNo": "学号（可选）",
    "taskTitle": "任务名（可选，尽量用上面真实任务名）",
    "days": 时间窗口天数（数字，仅 practice_trend / active_students 需要，默认 7-14）,
    "activeMode": "active 或 inactive（仅 active_students 需要）"
  },
  "sortBy": "mastered | attempts | avg | active | value（可选）",
  "sortOrder": "asc | desc（可选）",
  "limit": 返回条数（数字，可选，默认 10）
}

【规则】
- 不确定的 filters 字段直接省略，不要编造不存在的班级/学生/任务名。
- "谁没练/下滑/掉队"→ activeMode="inactive"；"谁活跃/谁练了"→ activeMode="active"。
- 只输出一个 JSON 对象。`;
}

function parseIntent(text: string): QueryIntent | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    if (typeof j !== "object" || j === null) return null;
    const metric = j.metric as MetricKey;
    if (!METRIC_KEYS.includes(metric)) return null;
    const intent: QueryIntent = { metric };
    if (typeof j.filters === "object" && j.filters !== null) {
      const f = j.filters;
      intent.filters = {};
      if (typeof f.className === "string" && f.className.trim()) intent.filters.className = f.className.trim();
      if (typeof f.studentName === "string" && f.studentName.trim()) intent.filters.studentName = f.studentName.trim();
      if (typeof f.studentNo === "string" && f.studentNo.trim()) intent.filters.studentNo = f.studentNo.trim();
      if (typeof f.taskTitle === "string" && f.taskTitle.trim()) intent.filters.taskTitle = f.taskTitle.trim();
      if (typeof f.days === "number") intent.filters.days = f.days;
      if (f.activeMode === "active" || f.activeMode === "inactive") intent.filters.activeMode = f.activeMode;
    }
    if (["mastered", "attempts", "avg", "active", "value"].includes(j.sortBy)) intent.sortBy = j.sortBy;
    if (j.sortOrder === "asc" || j.sortOrder === "desc") intent.sortOrder = j.sortOrder;
    if (typeof j.limit === "number") intent.limit = j.limit;
    return intent;
  } catch {
    return null;
  }
}

/** ④ 段：把查询结果事实组织为自然语言（数字只能来自注入事实） */
function buildNarrativePrompt(question: string, result: MetricResult): { role: "system" | "user"; content: string }[] {
  const b = result.basis;
  return [
    {
      role: "system",
      content: `你是《植物造景》课程的学情分析助教，面向教师。请根据【查询结果】用简洁中文写一段分析。
硬性要求：
- 所有数字必须且只能来自【查询结果】，严禁编造、估算或计算出没给出的数字。
- 先给结论，再给 1-2 条可执行的教学建议。
- 控制在 180 字以内，语气专业克制，不用表情符号。
- 若结果为空，如实说明并建议教师先让学生产生数据。`,
    },
    {
      role: "user",
      content: `【教师问题】${question}
【统计口径】指标=${b.metricLabel}；范围=${b.filtersDesc}；命中=${b.hitCount}${b.timeRangeDesc ? `；时间=${b.timeRangeDesc}` : ""}
【查询结果】${JSON.stringify(result.facts)}
请写出分析。`,
    },
  ];
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401 });
  if (user.role !== "teacher") return new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403 });

  let question = "";
  try {
    const body = await req.json();
    question = typeof body.question === "string" ? body.question.trim() : "";
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), { status: 400 });
  }
  if (!question) return new Response(JSON.stringify({ error: "question required" }), { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => controller.enqueue(encoder.encode(sse(obj)));
      try {
        const catalog = await loadCatalog();

        // ① 解析意图
        send({ type: "status", text: "正在理解您的问题…" });
        let intent: QueryIntent | null = null;
        try {
          const raw = await collectText([
            { role: "system", content: buildIntentPrompt(question, catalog) },
            { role: "user", content: question },
          ]);
          intent = parseIntent(raw);
        } catch {
          intent = null;
        }
        if (!intent) {
          send({
            type: "clarify",
            text: "抱歉，我没能理解这个统计需求。您可以试试问我：整体学情概况、各班掌握对比、某个学生的表现、最近的练习趋势、哪些植物最难、设计任务提交情况，或某个任务各阶段得分。",
          });
          send({ type: "done" });
          controller.close();
          return;
        }

        // ② + ③ 白名单校验 & 参数化执行（实体解析在执行器内完成）
        send({ type: "status", text: `正在统计「${metricLabel(intent.metric)}」…` });
        const outcome = await executeMetric(intent, catalog);
        if (!outcome.ok) {
          send({ type: "clarify", text: outcome.clarify });
          send({ type: "done" });
          controller.close();
          return;
        }
        const result = outcome.result;

        // 先把结构化结果（依据 + 表 + 图）发给前端，数字全部来自查询
        send({ type: "result", basis: result.basis, table: result.table, chart: result.chart });

        // ④ 叙述：流式输出
        try {
          const llm = new LLMClient();
          const events = llm.stream(buildNarrativePrompt(question, result), { model: MODEL });
          for await (const event of events) {
            const delta = typeof event?.content === "string" ? event.content : event?.content?.toString() ?? "";
            if (delta) send({ type: "delta", text: delta });
          }
        } catch {
          send({ type: "delta", text: "（数据已统计完成，但文字解读服务暂时不可用，请直接查看上方图表与数据。）" });
        }
        send({ type: "done" });
        controller.close();
      } catch (e) {
        send({ type: "error", text: `分析失败：${(e as Error).message || "未知错误"}` });
        send({ type: "done" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
