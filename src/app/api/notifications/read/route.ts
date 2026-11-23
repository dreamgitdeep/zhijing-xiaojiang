import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getAdminClient, isCloudConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!isCloudConfigured()) return NextResponse.json({ ok: true });
  const body = await req.json().catch(() => ({}));
  const { ids, all } = body as { ids?: string[]; all?: boolean };
  if (!all && (!Array.isArray(ids) || ids.length === 0))
    return NextResponse.json({ error: "ids 或 all 必填" }, { status: 400 });
  let query = getAdminClient()
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  if (!all) query = query.in("id", ids as string[]);
  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
