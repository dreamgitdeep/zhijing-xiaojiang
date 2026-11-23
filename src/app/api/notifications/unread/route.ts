import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getAdminClient, isCloudConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!isCloudConfigured()) return NextResponse.json({ unread: 0 });
  const { count, error } = await getAdminClient()
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ unread: count ?? 0 });
}
