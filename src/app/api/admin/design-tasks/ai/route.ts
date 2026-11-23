import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth";
import { buildGenRubricsPrompt, buildParseInquiryPrompt, buildPolishPrompt, callLlmJson, STAGE_NAMES } from "@/lib/task-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_TEXT_LEN = 8000;
const LIMIT_PER_MINUTE = 10;
const LIMIT_PER_DAY = 200;
const usage = new Map<string, number[]>();

function checkRateLimit(userId: string): { ok: true } | { ok: false; reason: string } {
  const now = Date.now();
  const stamps = (usage.get(userId) ?? []).filter((t) => now - t < 24 * 3600 * 1000);
  const lastMinute = stamps.filter((t) => now - t < 60 * 1000).length;
  if (lastMinute >= LIMIT_PER_MINUTE) return { ok: false, reason: "AI 使用太频繁，请稍后再试（每分钟最多 10 次）" };
  if (stamps.length >= LIMIT_PER_DAY) return { ok: false, reason: "今日 AI 使用次数已达上限（每天 200 次），请明天再试" };
  stamps.push(now);
  usage.set(userId, stamps);
  if (usage.size > 2000) usage.delete(usage.keys().next().value as string);
  return { ok: true };
}

function str(v: unknown, max = 2000): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

export async function POST(req: Request) {
  const teacher = await requireTeacher();
  if (!teacher) return NextResponse.json({ error: "FORBIDDEN", message: "仅教师可使用" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "";
  if (!["polish", "parseInquiry", "genRubrics"].includes(action)) {
    return NextResponse.json({ error: "BAD_ACTION", message: "未知操作" }, { status: 400 });
  }

  const limit = checkRateLimit(teacher.id);
  if (!limit.ok) return NextResponse.json({ error: "RATE_LIMITED", message: limit.reason }, { status: 429 });

  try {
    if (action === "polish") {
      const text = str(body.text, MAX_TEXT_LEN).trim();
      if (!text) return NextResponse.json({ error: "EMPTY_TEXT", message: "请先填写要润色的任务简介" }, { status: 400 });
      const parsed = await callLlmJson(buildPolishPrompt(text));
      const intro = str(parsed?.intro, 2000).trim();
      if (!intro) return NextResponse.json({ error: "AI_FAILED", message: "润色失败，请重试" }, { status: 502 });
      return NextResponse.json({ ok: true, intro });
    }

    if (action === "parseInquiry") {
      const text = str(body.text, MAX_TEXT_LEN).trim();
      if (!text) return NextResponse.json({ error: "EMPTY_TEXT", message: "请先填写需求文本" }, { status: 400 });
      const parsed = await callLlmJson(buildParseInquiryPrompt(text));
      const rawEntries = Array.isArray(parsed?.entries) ? (parsed!.entries as unknown[]) : [];
      const entries = rawEntries
        .map((e) => (typeof e === "object" && e !== null ? (e as Record<string, unknown>) : null))
        .filter((e): e is Record<string, unknown> => Boolean(e && str((e as Record<string, unknown>).topic)))
        .map((e) => ({
          topic: str(e.topic, 60),
          keywords: Array.isArray(e.keywords) ? (e.keywords as unknown[]).map((k) => str(k, 30)).filter(Boolean) : [],
          importance: e.importance === "critical" ? "critical" : "normal",
          answer: str(e.answer, 500),
        }));
      if (!entries.length) return NextResponse.json({ error: "AI_FAILED", message: "未能从文本中识别出有效条目，请补充内容后重试" }, { status: 502 });
      return NextResponse.json({ ok: true, entries });
    }

    // genRubrics
    const title = str(body.title, 120).trim();
    if (!title) return NextResponse.json({ error: "EMPTY_TITLE", message: "请先填写任务名称" }, { status: 400 });
    const parsed = await callLlmJson(
      buildGenRubricsPrompt({
        title,
        subtitle: str(body.subtitle, 120),
        intro: str(body.intro, MAX_TEXT_LEN),
        entries: Array.isArray(body.entries) ? (body.entries as { topic: string; importance: string; answer: string }[]) : [],
      }),
    );
    const rawStages = (parsed?.rubricsByStage ?? {}) as Record<string, unknown>;
    const rubricsByStage: Record<string, { key: string; label: string; weight: number; desc: string }[]> = {};
    for (const sk of Object.keys(STAGE_NAMES)) {
      const list = Array.isArray(rawStages[sk]) ? (rawStages[sk] as unknown[]) : [];
      rubricsByStage[sk] = list
        .map((r) => (typeof r === "object" && r !== null ? (r as Record<string, unknown>) : null))
        .filter((r): r is Record<string, unknown> => Boolean(r && str((r as Record<string, unknown>).label)))
        .map((r, i) => ({
          key: `r${i + 1}`,
          label: str(r.label, 60),
          weight: Math.max(0, Math.min(100, Math.round(Number(r.weight ?? 0)))),
          desc: str(r.desc, 200),
        }));
    }
    const total = Object.values(rubricsByStage).reduce((n, l) => n + l.length, 0);
    if (!total) return NextResponse.json({ error: "AI_FAILED", message: "评分标准生成失败，请重试" }, { status: 502 });
    return NextResponse.json({ ok: true, rubricsByStage });
  } catch {
    return NextResponse.json({ error: "AI_FAILED", message: "AI 服务暂不可用，请稍后重试" }, { status: 502 });
  }
}
