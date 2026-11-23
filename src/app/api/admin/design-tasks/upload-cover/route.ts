import { NextRequest, NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase-server";
import { currentMode } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "plant-images";
const MAX_SIZE = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const teacher = await requireTeacher();
  if (!teacher) return NextResponse.json({ error: "无权限" }, { status: 403 });
  if (currentMode() !== "cloud") {
    return NextResponse.json({ error: "当前为本地数据模式，无法上传图片" }, { status: 400 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const taskId = String(form.get("taskId") ?? "").trim();
  if (!(file instanceof File)) return NextResponse.json({ error: "缺少图片文件" }, { status: 400 });
  if (!taskId) return NextResponse.json({ error: "缺少 taskId" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "仅支持图片文件" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "封面图不能超过 5MB" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const sharp = (await import("sharp")).default;
  const webp = await sharp(buffer)
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  const objectPath = `task-covers/${taskId}.webp`;
  const { error: upErr } = await getAdminClient()
    .storage.from(BUCKET)
    .upload(objectPath, webp, { contentType: "image/webp", upsert: true });
  if (upErr) return NextResponse.json({ error: `上传失败：${upErr.message}` }, { status: 500 });

  const base = process.env.COZE_SUPABASE_URL;
  const url = base ? `${base}/storage/v1/object/public/${BUCKET}/${objectPath}` : `${BUCKET}/${objectPath}`;
  return NextResponse.json({ ok: true, url });
}
