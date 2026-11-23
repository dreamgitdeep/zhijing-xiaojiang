import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getAdminClient, isCloudConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!isCloudConfigured()) return NextResponse.json({ items: [], unread: 0 });
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const items = data ?? [];
  const unread = items.filter((n) => !n.read_at).length;
  return NextResponse.json({ items, unread });
}
