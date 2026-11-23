import { NextRequest, NextResponse } from "next/server";
import { requireUserToken } from "@/lib/auth";
import { createResetCode } from "@/lib/auth-service";

export const runtime = "nodejs";

// 生成接口限频：每位教师每分钟最多 5 次（进程内滑窗）
const GEN_LIMIT_PER_MIN = 5;
const genHits = new Map<string, number[]>();

function allowTeacher(teacherId: string): boolean {
  const now = Date.now();
  const hits = (genHits.get(teacherId) ?? []).filter((t) => now - t < 60_000);
  if (hits.length >= GEN_LIMIT_PER_MIN) {
    genHits.set(teacherId, hits);
    return false;
  }
  hits.push(now);
  genHits.set(teacherId, hits);
  return true;
}

export async function POST(req: NextRequest) {
  let teacherId: string;
  let role: string;
  try {
    const auth = await requireUserToken();
    teacherId = auth.user.id;
    role = auth.user.role;
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (role !== "teacher") {
    return NextResponse.json({ error: "仅教师可操作" }, { status: 403 });
  }
  if (!allowTeacher(teacherId)) {
    return NextResponse.json({ error: "生成过于频繁，请稍后再试" }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const result = await createResetCode({
    studentNo: String(body?.studentNo ?? ""),
    teacherId
  });
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, code: result.code, expiresAt: result.expiresAt });
}
