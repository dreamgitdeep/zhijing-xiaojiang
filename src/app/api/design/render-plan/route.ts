import { NextResponse } from "next/server";
import { ImageGenerationClient, Config } from "coze-coding-dev-sdk";
import { requireUserToken } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LIMIT_PER_MINUTE = 2;
const LIMIT_PER_DAY = 15;
const usage = new Map<string, number[]>();
const cache = new Map<string, string>();

function checkRateLimit(userId: string): { ok: true } | { ok: false; reason: string } {
  const now = Date.now();
  const stamps = (usage.get(userId) ?? []).filter((t) => now - t < 24 * 3600 * 1000);
  const lastMinute = stamps.filter((t) => now - t < 60 * 1000).length;
  if (lastMinute >= LIMIT_PER_MINUTE) return { ok: false, reason: "生成太频繁，请稍后再试（每分钟最多 2 次）" };
  if (stamps.length >= LIMIT_PER_DAY) return { ok: false, reason: "今日生成次数已达上限（每天 15 次），请明天再试" };
  stamps.push(now);
  usage.set(userId, stamps);
  if (usage.size > 2000) usage.delete(usage.keys().next().value as string);
  return { ok: true };
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return String(h);
}

export async function POST(req: Request) {
  let userId: string;
  try {
    userId = (await requireUserToken()).user.id;
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED", message: "请先登录后再生成示意图" }, { status: 401 });
  }

  let body: { summary?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const summary = (body.summary ?? "").trim().slice(0, 800);
  if (!summary) return NextResponse.json({ error: "summary required" }, { status: 400 });

  const key = hash(summary);
  const cached = cache.get(key);
  if (cached) return NextResponse.json({ url: cached, note: "AI 效果示意，非精确种植图" });

  const limit = checkRateLimit(userId);
  if (!limit.ok) return NextResponse.json({ error: "RATE_LIMITED", message: limit.reason }, { status: 429 });

  const prompt =
    `社区花园种植设计手绘效果图，水彩 + 马克笔手绘风格，温暖纸张质感，俯视平面视角。` +
    `设计内容：${summary}。` +
    `呈现乔灌草层次搭配、分区花境与步道，色调清新自然，线条松弛有手绘感，画面干净，不要文字标注。`;

  try {
    const client = new ImageGenerationClient(new Config());
    const res = await client.generate({ prompt, size: "2K" });
    const helper = client.getResponseHelper(res);
    const url = helper.success ? helper.imageUrls?.[0] : undefined;
    if (!url) return NextResponse.json({ error: "GENERATE_FAILED" }, { status: 502 });
    cache.set(key, url);
    if (cache.size > 300) cache.delete(cache.keys().next().value as string);
    return NextResponse.json({ url, note: "AI 效果示意，非精确种植图" });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
