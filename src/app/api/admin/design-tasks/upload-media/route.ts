import { NextRequest, NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase-server";
import { currentMode } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "plant-images";
const LIMITS = { image: 5 * 1024 * 1024, video: 50 * 1024 * 1024, model: 20 * 1024 * 1024 };
const LIMIT_LABEL = { image: "5MB", video: "50MB", model: "20MB" } as const;

type Kind = "image" | "video" | "model";

function modelExt(name: string, mime: string): string | null {
  const n = name.toLowerCase();
  if (n.endsWith(".glb") || mime === "model/gltf-binary") return "glb";
  if (n.endsWith(".gltf") || mime === "model/gltf+json" || mime === "model/gltf") return "gltf";
  return null;
}

export async function POST(request: NextRequest) {
  const teacher = await requireTeacher();
  if (!teacher) return NextResponse.json({ error: "无权限" }, { status: 403 });
  if (currentMode() !== "cloud") {
    return NextResponse.json({ error: "当前为本地数据模式，无法上传媒体" }, { status: 400 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const taskId = String(form.get("taskId") ?? "").trim();
  const kind = String(form.get("kind") ?? "image") as Kind;
  if (!(file instanceof File)) return NextResponse.json({ error: "缺少文件" }, { status: 400 });
  if (!taskId) return NextResponse.json({ error: "缺少 taskId" }, { status: 400 });
  if (!["image", "video", "model"].includes(kind)) return NextResponse.json({ error: "不支持的媒体类型" }, { status: 400 });
  if (file.size > LIMITS[kind]) return NextResponse.json({ error: `文件不能超过 ${LIMIT_LABEL[kind]}` }, { status: 400 });

  const admin = getAdminClient();
  const base = process.env.COZE_SUPABASE_URL;
  // 唯一文件名：同一任务可上传多个资源而互不覆盖
  const uid = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  let objectPath: string;
  let contentType: string;
  let body: Buffer;

  if (kind === "image") {
    if (!file.type.startsWith("image/")) return NextResponse.json({ error: "仅支持图片文件" }, { status: 400 });
    const sharp = (await import("sharp")).default;
    body = await sharp(Buffer.from(await file.arrayBuffer()))
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    objectPath = `task-media/${taskId}/${uid}.webp`;
    contentType = "image/webp";
  } else if (kind === "video") {
    if (!/^video\/(mp4|webm)$/.test(file.type)) return NextResponse.json({ error: "仅支持 MP4 / WebM 视频" }, { status: 400 });
    const ext = file.type === "video/mp4" ? "mp4" : "webm";
    body = Buffer.from(await file.arrayBuffer());
    objectPath = `task-media/${taskId}/${uid}.${ext}`;
    contentType = file.type;
  } else {
    const ext = modelExt(file.name, file.type);
    if (!ext) return NextResponse.json({ error: "仅支持 GLB / GLTF 3D 模型" }, { status: 400 });
    body = Buffer.from(await file.arrayBuffer());
    objectPath = `task-media/${taskId}/${uid}.${ext}`;
    contentType = ext === "glb" ? "model/gltf-binary" : "model/gltf+json";
  }

  const { error: upErr } = await admin.storage.from(BUCKET).upload(objectPath, body, { contentType, upsert: true });
  if (upErr) return NextResponse.json({ error: `上传失败：${upErr.message}` }, { status: 500 });

  const url = base ? `${base}/storage/v1/object/public/${BUCKET}/${objectPath}` : `${BUCKET}/${objectPath}`;
  return NextResponse.json({ ok: true, url, kind });
}
