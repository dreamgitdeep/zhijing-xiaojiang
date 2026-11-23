import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import NotificationsClient from "@/components/NotificationsClient";
import { PAGE_COPY } from "@/config/pages";

export const metadata: Metadata = { title: "消息通知 · 植景小匠" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await getSessionUser();
  return (
    <AppShell user={user}>
      <div className="w-full py-6">
        <NotificationsClient copy={PAGE_COPY.notifications} />
      </div>
    </AppShell>
  );
}
