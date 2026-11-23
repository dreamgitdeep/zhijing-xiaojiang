import { NextResponse } from "next/server";
import { ImageGenerationClient, Config } from "coze-coding-dev-sdk";
import { loadDataset } from "@/lib/data";
import { requireUserToken } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const cache = new Map<string, string>();

const LIMIT_PER_MINUTE = 3;
const LIMIT_PER_DAY = 30;
// userId -> 真实生成（非缓存命中）时间戳
const usage = new Map<string, number[]>();

function checkRateLimit(userId: string): { ok: true } | { ok: false; reason: string } {
  const now = Date.now();
  const stamps = (usage.get(userId) ?? []).filter((t) => now - t < 24 * 3600 * 1000);
  const lastMinute = stamps.filter((t) => now - t < 60 * 1000).length;
  if (lastMinute >= LIMIT_PER_MINUTE) return { ok: false, reason: "生成太频繁，请稍后再试（每分钟最多 3 次）" };
  if (stamps.length >= LIMIT_PER_DAY) return { ok: false, reason: "今日生成次数已达上限（每天 30 次），请明天再试" };
  stamps.push(now);
  usage.set(userId, stamps);
  if (usage.size > 2000) usage.delete(usage.keys().next().value as string);
  return { ok: true };
}

export async function POST(req: Request) {
  let user;
  try {
    user = (await requireUserToken()).user;
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED", message: "请先登录后再生成造景效果图" }, { status: 401 });
  }

  let body: { plantId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  if (!body.plantId) return NextResponse.json({ error: "plantId required" }, { status: 400 });

  const cached = cache.get(body.plantId);
  if (cached) return NextResponse.json({ url: cached });

  const dataset = await loadDataset();
  const plant = dataset.plants.find((p) => p.id === body.plantId);
  if (!plant) return NextResponse.json({ error: "PLANT_NOT_FOUND" }, { status: 404 });

  const limit = checkRateLimit(user.id);
  if (!limit.ok) return NextResponse.json({ error: "RATE_LIMITED", message: limit.reason }, { status: 429 });

  const prompt =
    `中国风社区园林景观实景，${plant.name}（${plant.latin}）作为${plant.category ?? "观赏"}植物应用于庭院造景，` +
    `与草坪、花境、步道自然搭配，真实园艺摄影风格，柔和阳光，画面清新自然，细节丰富`;
  try {
    const client = new ImageGenerationClient(new Config());
    const res = await client.generate({ prompt, size: "2K" });
    const helper = client.getResponseHelper(res);
    const url = helper.success ? helper.imageUrls?.[0] : undefined;
    if (!url) return NextResponse.json({ error: "GENERATE_FAILED" }, { status: 502 });
    cache.set(body.plantId, url);
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
