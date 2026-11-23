import { NextRequest } from "next/server";
import { LLMClient, Config } from "coze-coding-dev-sdk";
import { getTaskFull } from "@/lib/design";
import { getAuthContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

const SYNONYMS: Record<string, string[]> = {
  光照: ["光照", "阳光", "晒太阳", "日照", "向阳", "荫"],
  排水: ["排水", "积水", "水涝", "涝", "下雨积水"],
  盐碱: ["盐碱", "盐渍", "碱性"],
  活动: ["活动", "人流", "客流", "聚集", "锻炼", "广场舞"],
  人群: ["老人", "儿童", "孩子", "小孩", "居民"],
  养护: ["养护", "管理", "修剪", "浇水", "预算", "成本", "省钱", "低维护"],
  安全: ["安全", "刺", "毒", "过敏", "飞絮", "果", "夹竹桃"],
  常绿: ["常绿", "落叶", "冬天", "四季"],
  层次: ["层次", "结构", "骨架", "上层", "中层", "下层", "地被", "草坪", "郁闭"],
  观赏: ["开花", "花", "观叶", "观果", "色叶", "季相", "秋色", "景观效果"],
};

function entryText(e: Record<string, any>): string {
  return [e.answer, e.tags?.join(" "), e.keywords?.join(" ")].join(" ");
}

function matchEntries(question: string, entries: Record<string, any>[]) {
  const scored = entries.map((e) => {
    let score = 0;
    const hits: string[] = [];
    for (const [group, words] of Object.entries(SYNONYMS)) {
      if (words.some((w) => question.includes(w))) {
        const text = entryText(e);
        if ((e.tags ?? []).includes(group) || words.some((w) => text.includes(w))) {
          score += 2;
          hits.push(group);
        }
      }
    }
    for (const kw of e.keywords ?? []) {
      if (kw.length >= 2 && question.includes(kw)) {
        score += 1.5;
        hits.push(kw);
      }
    }
    return { e, score, hits };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 2);
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401 });

  const body = await req.json();
  const { taskId, messages = [], hitEntryIds = [] } = body as { taskId: string; messages: { role: string; content: string }[]; hitEntryIds: string[] };
  const full = await getTaskFull(taskId);
  if (!full) return new Response(JSON.stringify({ error: "TASK_NOT_FOUND" }), { status: 404 });
  const { task, nongyuan } = full;

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const matched = lastUser ? matchEntries(lastUser.content, nongyuan.inquiry?.entries ?? []) : [];
  const newHits = matched.map((m) => m.e.id);
  const allHits = [...new Set([...(hitEntryIds ?? []), ...newHits])];
  const askedCount = messages.filter((m) => m.role === "user").length;
  const criticalHitCount = (nongyuan.inquiry?.criticalEntryIds ?? []).filter((id: string) => allHits.includes(id)).length;

  const facts = (task.case?.facts ?? []).map((f: any) => `- ${f.label ?? f.key}: ${f.value}`).join("\n");
  const entryCtx = (nongyuan.inquiry?.entries ?? [])
    .filter((e: any) => allHits.includes(e.id))
    .map((e: any) => `【${e.tags?.join("/")}】${e.answer}`)
    .join("\n");

  const system = `你是《植物造景》课程的"场地顾问 AI"，服务于任务"${task.name}"。
【案例背景】${task.case?.background ?? ""}
【场地事实】${facts}
【学生已问询到的资料】${entryCtx || "（学生尚未命中任何资料，可提示其围绕光照、排水、人群活动、养护等维度提问）"}
【边界】${JSON.stringify(task.aiBoundary ?? nongyuan.aiBoundary ?? {})}`;

  const prompt = `${system}

【硬性规则】
1. 只回答与植物造景/场地诊断/设计策略相关的问题；无关问题礼貌拉回。
2. 禁止直接给出完整植物清单或最终配置答案；学生询问"种什么"时，只给筛选维度与思路引导。
3. 禁止输出 referenceSolution 或任何最终答案内容。
4. 每次回答 ≤150 字，可用简短 markdown 列表；可引用"已问询到的资料"内容。
5. 当学生命中关键维度时，可简短肯定并引导下一步。`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "meta", askedCount, criticalHitCount, newHits })}\n\n`));
      try {
        const llm = new LLMClient();
        const events = llm.stream(
          [
            { role: "system", content: prompt },
            ...messages.slice(-8).map((m) => ({ role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant", content: m.content })),
          ],
          { model: "doubao-seed-2-0-lite-260215" }
        );
        for await (const event of events) {
          const text = typeof event?.content === "string" ? event.content : event?.content?.toString() ?? "";
          if (text) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", text })}\n\n`));
        }
      } catch {
        const fallback = "抱歉，AI 服务暂不可用。你可以围绕光照、土壤排水、人群活动、养护预算等维度继续提问，或先完成诊断表。";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", text: fallback })}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
