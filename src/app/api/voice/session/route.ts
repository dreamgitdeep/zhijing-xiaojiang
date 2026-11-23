import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getAdminClient, isCloudConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export const QUOTA_CALLS_PER_DAY = 5;

function todayCN(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!isCloudConfigured()) {
    return NextResponse.json({ allowed: true, used: 0, quota: QUOTA_CALLS_PER_DAY });
  }
  const admin = getAdminClient();
  const date = todayCN();
  const { data: row, error } = await admin
    .from("voice_usage")
    .select("call_count")
    .eq("user_id", user.id)
    .eq("usage_date", date)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "USAGE_READ_FAILED" }, { status: 500 });
  }
  const used = row?.call_count ?? 0;
  if (used >= QUOTA_CALLS_PER_DAY) {
    return NextResponse.json({ allowed: false, used, quota: QUOTA_CALLS_PER_DAY });
  }
  const next = used + 1;
  const write = row
    ? admin
        .from("voice_usage")
        .update({ call_count: next })
        .eq("user_id", user.id)
        .eq("usage_date", date)
    : admin
        .from("voice_usage")
        .insert({ user_id: user.id, usage_date: date, call_count: 1 });
  const { error: writeError } = await write;
  if (writeError) {
    return NextResponse.json({ error: "USAGE_WRITE_FAILED" }, { status: 500 });
  }
  return NextResponse.json({ allowed: true, used: next, quota: QUOTA_CALLS_PER_DAY });
}
