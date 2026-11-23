import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getAdminClient, isCloudConfigured } from "@/lib/supabase-server";

export const runtime = "nodejs";

const BUCKET = "design-sketches";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!isCloudConfigured()) {
    return NextResponse.json({ error: "当前为本地数据模式，无法上传图片" }, { status: 400 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const taskId = String(form.get("taskId") ?? "").replace(/[^0-9a-zA-Z_-]/g, "") || "general";
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少图片文件" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "仅支持图片文件" }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "图片不能超过 8MB" }, { status: 400 });
  }

  const admin = getAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const sharp = (await import("sharp")).default;
  const webp = await sharp(buffer)
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  const path = `${user.id}/${taskId}/${Date.now()}.webp`;
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, webp, {
    contentType: "image/webp",
    upsert: false,
  });
  if (upErr) return NextResponse.json({ error: `上传失败：${upErr.message}` }, { status: 500 });

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ ok: true, url: pub.publicUrl });
}
