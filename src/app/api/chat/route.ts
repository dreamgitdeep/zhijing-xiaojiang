import { NextRequest } from "next/server";
import { LLMClient } from "coze-coding-dev-sdk";
import { loadDataset } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";
import { matchPlantByName } from "@/lib/plant-match";
import { getAdminClient } from "@/lib/supabase-server";
import { fallbackAnswer } from "@/lib/chat-fallback";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };

// 单条消息截断长度与请求体上限（安全加固 P1-1）
const MAX_CONTENT_CHARS = 2000;
const MAX_BODY_BYTES = 64 * 1024;

// 双轨限流（安全加固 P1-1）：登录按用户、游客按 IP，键前缀区分、互不挤占。
// 参数与键名沿用 AI 路由族（plant-render / ai-search 等）的分钟+天双窗口模式。
const LIMITS = {
  user: { minute: 20, day: 300 },
  guest: { minute: 5, day: 30 },
};
const usage = new Map<string, number[]>();

function checkRateLimit(
  key: string,
  minuteLimit: number,
  dayLimit: number,
  dayHint: string
): { ok: true } | { ok: false; reason: string } {
  const now = Date.now();
  const stamps = (usage.get(key) ?? []).filter((t) => now - t < 24 * 3600 * 1000);
  const lastMinute = stamps.filter((t) => now - t < 60 * 1000).length;
  if (lastMinute >= minuteLimit) {
    return { ok: false, reason: `提问太频繁，请稍后再试（每分钟最多 ${minuteLimit} 次）` };
  }
  if (stamps.length >= dayLimit) {
    return { ok: false, reason: `今日提问次数已达上限（每天 ${dayLimit} 次）${dayHint}，请明天再试` };
  }
  stamps.push(now);
  usage.set(key, stamps);
  if (usage.size > 4000) usage.delete(usage.keys().next().value as string);
  return { ok: true };
}

function sseChunk(delta: string) {
  return `data: ${JSON.stringify({ delta })}\n\n`;
}

function buildSystemPrompt(plantBlock: string) {
  return [
    "你是《植物造景》课程的教学助教，面向高职院校园林/景观专业学生。",
    "回答要求：口吻亲切专业，讲解准确简洁；总字数控制在 300 字以内。",
    "使用 Markdown 输出：当问题涉及具体植物时，按「**观赏特性**」「**造景应用**」「**养护要点**」三个小节组织，每节 1-3 条要点；其他问题用简短分点回答。",
    "涉及有毒或受限植物时必须给出安全提示与教学处理建议。",
    plantBlock
      ? `回答必须基于以下植物图鉴资料，不要编造资料之外的习性数据：\n${plantBlock}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function plantBlockOf(plant: Record<string, unknown> | undefined) {
  if (!plant) return "";
  const { id, name, latin, alias, category, layer, light, water, soil, height, canopy, ornamentalPart, color, usage, region, phenology, isWarning, warning, safeForChildren } = plant;
  return JSON.stringify({ id, name, latin, alias, category, layer, light, water, soil, height, canopy, ornamentalPart, color, usage, region, phenology, isWarning, warning, safeForChildren });
}

export async function POST(req: NextRequest) {
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return Response.json({ error: "请求内容过长，请精简后重试" }, { status: 400 });
  }

  let body: { messages?: ChatMessage[]; plantId?: string; conversationId?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const messages = (body.messages ?? [])
    .filter(
      (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim()
    )
    .map((m) => ({ ...m, content: m.content.slice(0, MAX_CONTENT_CHARS) }));
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) {
    return Response.json({ error: "messages required" }, { status: 400 });
  }

  const user = await getSessionUser();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = user
    ? checkRateLimit(`user:${user.id}`, LIMITS.user.minute, LIMITS.user.day, "")
    : checkRateLimit(`ip:${ip}`, LIMITS.guest.minute, LIMITS.guest.day, "，登录后可获得更多提问额度");
  if (!limit.ok) {
    return Response.json({ error: "RATE_LIMITED", message: limit.reason }, { status: 429 });
  }

  const dataset = await loadDataset();
  const plant =
    matchPlantByName(lastUser.content, dataset.plants) ??
    (body.plantId ? dataset.plants.find((p) => p.id === body.plantId) : undefined);
  const plantBlock = plantBlockOf(plant as unknown as Record<string, unknown> | undefined);

  const conversationId =
    typeof body.conversationId === "string" && body.conversationId.trim() ? body.conversationId.trim().slice(0, 64) : null;
  const source = body.source === "catalog" ? "catalog" : "chat";
  const persist = user
    ? { userId: user.id, plantId: plant?.id ?? null, conversationId, source }
    : null;

  const llmMessages: ChatMessage[] = [
    { role: "user", content: buildSystemPrompt(plantBlock) },
    ...messages.slice(-12),
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let answer = "";
      let fallback = false;
      try {
        const client = new LLMClient();
        const events = client.stream(llmMessages, {
          model: "doubao-seed-2-0-lite-260215",
        });
        for await (const event of events) {
          const delta = typeof event?.content === "string" ? event.content : event?.content?.toString() ?? "";
          if (!delta) continue;
          answer += delta;
          controller.enqueue(encoder.encode(sseChunk(delta)));
        }
      } catch {
        fallback = true;
        const text = fallbackAnswer(dataset, plant?.id, lastUser.content);
        const step = 90;
        for (let i = 0; i < text.length; i += step) {
          const part = text.slice(i, i + step);
          answer += part;
          controller.enqueue(encoder.encode(sseChunk(part)));
        }
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
        if (persist && answer) {
          try {
            const admin = getAdminClient();
            await admin.from("chat_messages").insert([
              { user_id: persist.userId, plant_id: persist.plantId, conversation_id: persist.conversationId, role: "user", content: lastUser.content, source: persist.source },
              { user_id: persist.userId, plant_id: persist.plantId, conversation_id: persist.conversationId, role: "assistant", content: answer, source: persist.source },
            ]);
          } catch {
            // 历史保存失败不影响回答
          }
        }
        if (fallback) {
          console.warn("[chat] llm unavailable, served from local plant data");
        }
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
