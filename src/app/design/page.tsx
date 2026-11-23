import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Gauge } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { loadDataset } from "@/lib/data";
import { AppShell } from "@/components/AppShell";
import { getRun, listPublishedTasks } from "@/lib/design";
import { PAGE_COPY } from "@/config/pages";

const COPY = PAGE_COPY.designList;

export const metadata: Metadata = { title: "植景设计 · 植景小匠" };
export const dynamic = "force-dynamic";

export default async function DesignPage() {
  const [user, dataset] = await Promise.all([getSessionUser(), loadDataset()]);
  const tasks = await listPublishedTasks(user?.classCode ?? null);

  const runs = user
    ? await Promise.all(tasks.map((t) => getRun(t.id, user.id).catch(() => null)))
    : tasks.map(() => null);

  return (
    <AppShell user={user}>
      <div className="student-vivid w-full py-6">
        {tasks.length === 0 ? (
          <div className="mt-16 flex flex-col items-center gap-3 text-on-surface-variant">
            <p className="text-fs-sub">{COPY.empty}</p>
          </div>
        ) : (
          <>
            <p className="text-right text-fs-sub text-on-surface-variant">
              {COPY.totalPrefix} {tasks.length} {COPY.totalSuffix}
            </p>
            <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(var(--size-card-min),1fr))] gap-5">
            {tasks.map((t, i) => {
              const run = runs[i];
              return (
                <Link
                  key={t.id}
                  href={`/design/${t.id}`}
                  className="lift rise group overflow-hidden rounded-xl bg-surface shadow-card"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="relative h-44 overflow-hidden bg-surface-container">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.coverUrl} alt={t.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    {run && (
                      <span
                        className={`absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-fs-label font-medium ${
                          run.status === "completed" ? "bg-success text-on-success" : "bg-primary text-on-primary"
                        }`}
                      >
                        {run.status === "completed" ? COPY.statusCompleted : `${COPY.statusProgressPrefix} ${run.current_stage}`}
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    <h2 className="text-fs-card font-medium text-on-surface">{t.title}</h2>
                    {t.subtitle && <p className="mt-0.5 text-fs-label text-on-surface-variant">{t.subtitle}</p>}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {t.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="rounded-full bg-primary-container/60 px-2.5 py-0.5 text-fs-label text-on-primary-container">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t-neo border-outline-variant/20 pt-3 text-fs-label text-on-surface-variant">
                      <span className="flex items-center gap-1.5">
                        <Gauge className="h-3.5 w-3.5" /> {t.difficulty}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" /> {COPY.estMinutesPrefix} {t.estMinutes} {COPY.estMinutesSuffix}
                      </span>
                      <span className="font-medium text-foreground transition-transform group-hover:translate-x-0.5">{COPY.enterCase}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
