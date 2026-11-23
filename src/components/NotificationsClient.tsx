"use client";
import { Bell, CheckCheck, Inbox, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface NotificationItem {
  id: string;
  title: string;
  content: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export interface NotificationsCopy {
  title: string;
  unreadSuffix: string;
  allRead: string;
  markAllRead: string;
  empty: string;
  emptyHint: string;
  retry: string;
  loadFailedPrefix: string;
  loadFailed: string;
  authRequired: string;
  viewTask: string;
}

export default function NotificationsClient({ copy }: { copy: NotificationsCopy }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      if (!res.ok) throw new Error(res.status === 401 ? copy.authRequired : data.error || copy.loadFailed);
      setItems((data.items ?? []) as NotificationItem[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const unread = items.filter((n) => !n.read_at).length;

  async function openItem(item: NotificationItem) {
    if (!item.read_at) {
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n)));
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [item.id] }),
      }).catch(() => {});
    }
  }

  async function markAll() {
    if (unread === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-measure">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-container">
            <Bell className="h-5 w-5 text-foreground" />
          </span>
          <div>
            <p className="text-fs-title font-medium text-on-surface">{copy.title}</p>
            <p className="text-fs-label text-on-surface-variant">{unread > 0 ? `${unread} ${copy.unreadSuffix}` : copy.allRead}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={markAll}
          disabled={unread === 0 || markingAll}
          className="flex items-center gap-1.5 rounded-lg border-neo border-ink bg-primary-container px-4 py-2 text-fs-sub font-medium text-on-primary-container transition-colors hover:bg-primary hover:text-on-primary disabled:cursor-not-allowed disabled:opacity-45">
          <CheckCheck className="h-4 w-4" />
          {copy.markAllRead}
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {loading ? (
          [0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface-container" />)
        ) : error ? (
          <div className="rounded-2xl bg-surface p-6 text-center shadow-card">
            <p className="text-fs-body text-on-surface-variant">{copy.loadFailedPrefix}{error}</p>
            <button
              type="button"
              onClick={load}
              className="mx-auto mt-3 flex items-center gap-1.5 rounded-lg border-neo border-ink bg-primary-container px-4 py-2 text-fs-sub font-medium text-on-primary-container transition-colors hover:bg-primary hover:text-on-primary">
              <RefreshCw className="h-4 w-4" />
              {copy.retry}
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl bg-surface p-10 text-center shadow-card">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface-container">
              <Inbox className="h-7 w-7 text-on-surface-variant" />
            </span>
            <p className="mt-4 text-fs-card font-medium text-on-surface">{copy.empty}</p>
            <p className="mt-1 text-fs-sub text-on-surface-variant">{copy.emptyHint}</p>
          </div>
        ) : (
          items.map((item) => {
            const body = (
              <div className="flex items-start gap-3 rounded-2xl bg-surface p-5 shadow-card transition-shadow hover:shadow-float">
                <span
                  className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${item.read_at ? "bg-transparent" : "bg-primary"}`}
                  aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className={`truncate text-fs-card font-medium ${item.read_at ? "text-on-surface-variant" : "text-on-surface"}`}>{item.title}</p>
                    <p className="shrink-0 text-fs-label text-on-surface-variant">{fmtTime(item.created_at)}</p>
                  </div>
                  <p className={`mt-1.5 text-fs-body leading-relaxed ${item.read_at ? "text-on-surface-variant" : "text-on-surface"}`}>{item.content}</p>
                  {item.link && <p className="mt-2 text-fs-sub font-medium text-foreground">{copy.viewTask}</p>}
                </div>
              </div>
            );
            return item.link ? (
              <Link key={item.id} href={item.link} onClick={() => openItem(item)} className="block">
                {body}
              </Link>
            ) : (
              <button key={item.id} type="button" onClick={() => openItem(item)} className="block w-full text-left">
                {body}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
