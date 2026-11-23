import { NextRequest, NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase-server";
import { currentMode } from "@/lib/repo";

export const runtime = "nodejs";

const BUCKET = "plant-images";

export async function POST(request: NextRequest) {
  const teacher = await requireTeacher();
  if (!teacher) return NextResponse.json({ error: "无权限" }, { status: 403 });
  if (currentMode() !== "cloud") {
    return NextResponse.json({ error: "当前为本地数据模式，无法上传图片" }, { status: 400 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const plantId = String(form.get("plantId") ?? "");
  const kind = String(form.get("kind") ?? "full");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少图片文件" }, { status: 400 });
  }
  if (!plantId) return NextResponse.json({ error: "缺少 plantId" }, { status: 400 });
  if (!["full", "close"].includes(kind)) {
    return NextResponse.json({ error: "kind 必须是 full 或 close" }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "图片不能超过 8MB" }, { status: 400 });
  }

  const admin = getAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const sharp = (await import("sharp")).default;
  const webp = await sharp(buffer).webp({ quality: 82 }).toBuffer();
  const thumb = await sharp(buffer).resize(320, 320, { fit: "cover" }).webp({ quality: 78 }).toBuffer();

  const basePath = `${plantId}_${kind}`;
  const { error: upErr } = await admin.storage.from(BUCKET).upload(`${basePath}.webp`, webp, {
    contentType: "image/webp",
    upsert: true,
  });
  if (upErr) return NextResponse.json({ error: `上传失败：${upErr.message}` }, { status: 500 });

  const { error: thErr } = await admin.storage.from(BUCKET).upload(`thumbs/${plantId}.webp`, thumb, {
    contentType: "image/webp",
    upsert: true,
  });
  if (thErr) return NextResponse.json({ error: `缩略图上传失败：${thErr.message}` }, { status: 500 });

  const { data: plant } = await admin.from("plants").select("data").eq("id", plantId).maybeSingle();
  if (plant) {
    const data = plant.data as Record<string, unknown>;
    const images = (data.images ?? {}) as Record<string, string>;
    images[kind === "full" ? "full" : "close"] = `plant-images/${basePath}.webp`;
    images.thumb = `plant-images/thumbs/${plantId}.webp`;
    data.images = images;
    const { error: updErr } = await admin.from("plants").update({ data }).eq("id", plantId);
    if (updErr) return NextResponse.json({ error: `更新植物失败：${updErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, path: `plant-images/${basePath}.webp` });
}

