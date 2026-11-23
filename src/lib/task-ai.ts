import { LLMClient } from "coze-coding-dev-sdk";
import { extractLlmJson } from "@/lib/plant-parse";

export const TASK_AI_MODEL = "doubao-seed-2-0-lite-260215";

export const STAGE_NAMES: Record<string, string> = {
  S1: "场地调研与现状诊断",
  S2: "设计定位与设计原则",
  S3: "功能分区与空间骨架",
  S4: "植物筛选与合规审查",
  S5: "平面布局与种植设计",
  S6: "方案评估",
};

export async function callLlmJson(prompt: string): Promise<Record<string, unknown> | null> {
  const llm = new LLMClient();
  const events = llm.stream([{ role: "user", content: prompt }], { model: TASK_AI_MODEL });
  let raw = "";
  for await (const event of events) {
    raw += typeof event?.content === "string" ? event.content : event?.content?.toString() ?? "";
  }
  return extractLlmJson(raw);
}

export function buildPolishPrompt(text: string): string {
  return `你是植物造景课程的教学文案助手。请把下方【任务简介草稿】润色成一段规范、通顺、专业的任务简介。
【硬性规则】
1. 忠于原意，不得臆造草稿中没有的场地信息、数据或要求；可补充衔接词使行文通顺。
2. 结构上整理为"① 任务背景"与"② 学生任务"两部分（若草稿缺其一，按草稿实际内容输出，不强行编造缺失部分）。
3. 语言简洁，控制在 100–500 字；不使用 emoji、不使用 Markdown 标题符号。
4. 只输出一个 JSON 对象，不输出任何解释文字。
【输出 JSON 结构】
{ "intro": "润色后的任务简介正文" }
【任务简介草稿】
${text}`;
}

export function buildParseInquiryPrompt(text: string): string {
  return `你是植物造景课程的任务设计助手。请从下方【需求文本】中提取"学生可问问题与 AI 回答"条目，用于学生提问时 AI 按条目作答。
【硬性规则】
1. 每个条目包含：主题（topic，短词组，如"光照格局"）、触发关键词（keywords，学生提问中出现即命中该条目的词，2-5 个）、重要性（importance，"critical"=影响方案成败的关键问题，否则"normal"）、AI 回答（answer，依据文本内容作答，80 字以内）。
2. 只提取文本中明确涉及的内容，禁止臆造；无法归类的忽略。
3. 条目数量 3-10 条；关键条目（critical）不超过总数一半。
4. 只输出一个 JSON 对象，不输出任何解释文字。
【输出 JSON 结构】
{ "entries": [{ "topic": "主题", "keywords": ["关键词1", "关键词2"], "importance": "critical 或 normal", "answer": "AI 回答内容" }] }
【需求文本】
${text}`;
}

export function buildGenRubricsPrompt(payload: {
  title: string;
  subtitle?: string;
  intro?: string;
  entries?: { topic: string; importance: string; answer: string }[];
}): string {
  const stages = Object.entries(STAGE_NAMES)
    .map(([k, v]) => `${k}=${v}`)
    .join("；");
  const entryText = (payload.entries ?? [])
    .map((e) => `- ${e.topic}（${e.importance === "critical" ? "关键" : "普通"}）：${e.answer}`)
    .join("\n");
  return `你是植物造景课程的评分标准设计助手。请依据下方【任务信息】，为六个阶段各生成一组评分维度，供 AI 评阅与学生自评参考。
【阶段清单】${stages}
【硬性规则】
1. 每个阶段生成 2-4 个评分维度；每个维度含：名称（label，短词组）、权重（weight，整数，同阶段各维度权重之和为 100）、评分说明（desc，说明该维度考察什么、怎样算好，40 字以内）。
2. 评分维度须紧扣任务信息中的场地条件、学生任务与关键问题，不得写成与任务无关的通用套话。
3. 只输出一个 JSON 对象，不输出任何解释文字。
【输出 JSON 结构】
{ "rubricsByStage": { "S1": [{ "label": "维度名", "weight": 40, "desc": "评分说明" }], "S2": [...], "S3": [...], "S4": [...], "S5": [...], "S6": [...] } }
【任务信息】
任务名称：${payload.title}
副标题：${payload.subtitle || "（无）"}
任务简介：${payload.intro || "（无）"}
学生可问问题与 AI 回答：
${entryText || "（无）"}`;
}
