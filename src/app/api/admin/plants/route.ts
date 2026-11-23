import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase-server";
import { upsertPlant } from "@/lib/repo";
import { loadDataset } from "@/lib/data";
import type { Plant } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const teacher = await requireTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "仅教师可操作" }, { status: 403 });
  }
  const body = await req.json();
  const plant = body?.plant as Plant | undefined;
  if (!plant || typeof plant.id !== "string" || typeof plant.name !== "string") {
    return NextResponse.json({ error: "数据不完整" }, { status: 400 });
  }
  try {
    await upsertPlant(plant as unknown as Record<string, unknown>, plant.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "保存失败" },
      { status: 500 },
    );
  }
}

export async function GET() {
  const teacher = await requireTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "仅教师可操作" }, { status: 403 });
  }
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("plants")
    .select("data")
    .order("id", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const local = JSON.parse(
    await fs.readFile(path.join(process.cwd(), "public/data/plants.json"), "utf-8"),
  ) as { filters: unknown; quizDimensions: unknown };
  return NextResponse.json(
    {
      filters: local.filters,
      quizDimensions: local.quizDimensions,
      plants: (data ?? []).map((r: { data: Plant }) => r.data),
    },
    {
      headers: {
        "Content-Disposition": 'attachment; filename="plants-export.json"',
      },
    },
  );
}
