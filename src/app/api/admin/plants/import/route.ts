import { NextRequest, NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth";
import { importPlants } from "@/lib/repo";
import type { Plant } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const teacher = await requireTeacher();
  if (!teacher) return NextResponse.json({ error: "无权限" }, { status: 403 });

  let body: { plants?: Plant[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  const list = body.plants;
  if (!Array.isArray(list) || list.length === 0) {
    return NextResponse.json({ error: "plants 数组为空" }, { status: 400 });
  }
  if (list.length > 300) {
    return NextResponse.json({ error: "单次最多导入 300 种" }, { status: 400 });
  }
  for (const p of list) {
    if (!p.id || !p.name || !p.category || !p.layer) {
      return NextResponse.json(
        { error: `数据缺少必要字段（id/name/category/layer）：${p.id ?? p.name ?? "未知"}` },
        { status: 400 },
      );
    }
  }
  try {
    const result = await importPlants(list.map((p) => ({ id: p.id, data: p as unknown as Record<string, unknown> })));
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "导入失败" }, { status: 500 });
  }
}
