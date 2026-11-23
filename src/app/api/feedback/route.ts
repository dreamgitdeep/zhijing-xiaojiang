import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getAdminClient, isCloudConfigured } from "@/lib/supabase-server";

export const runtime = "nodejs";

const MAX_LEN = 1000;
// 进程内限流：每用户每小时 5 条、每天 20 条
const stamps = new Map<string, number[]>();

function limited(userId: string): string | null {
  const now = Date.now();
  const arr = (stamps.get(userId) ?? []).filter((t) => now - t < 24 * 3600 * 1000);
  if (arr.filter((t) => now - t < 3600 * 1000).length >= 5) return "反馈太频繁，请一小时后再试";
  if (arr.length >= 20) return "今日反馈次数已达上限，请明天再试";
  arr.push(now);
  stamps.set(userId, arr);
  if (stamps.size > 4000) stamps.delete(stamps.keys().next().value as string);
  return null;
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "请先登录再提交反馈" }, { status: 401 });

  let body: { content?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (content.length < 5) return Response.json({ error: "反馈内容至少 5 个字" }, { status: 400 });
  if (content.length > MAX_LEN) return Response.json({ error: `反馈内容过长（最多 ${MAX_LEN} 字）` }, { status: 400 });

  const hit = limited(user.id);
  if (hit) return Response.json({ error: hit }, { status: 429 });

  if (!isCloudConfigured()) {
    return Response.json({ error: "当前为本地数据模式，反馈暂无法保存" }, { status: 503 });
  }

  try {
    await getAdminClient().from("feedbacks").insert({
      user_id: user.id,
      user_name: user.name,
      role: user.role,
      content,
    });
  } catch {
    return Response.json({ error: "提交失败，请稍后再试" }, { status: 500 });
  }
  return Response.json({ ok: true });
}
