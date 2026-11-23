"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ImageOff, Plus } from "lucide-react";
import type { TaskStats } from "@/lib/design-stats";
import { PublishClassModal } from "./PublishClassModal";
import { RemindModal } from "./RemindModal";
import { TaskStatsModal } from "./TaskStatsModal";

interface TaskRow {
  id: string;
  title: string;
  subtitle: string | null;
  intro: string | null;
  cover_url: string | null;
  difficulty: string | null;
  status: string;
  published_classes: string[];
  updated_at: string;
}

interface ClassOption {
  id: string;
  name: string;
  inviteCode: string;
  students: number;
}

const STATUS_LABEL: Record<string, string> = { draft: "草稿", published: "已发布", archived: "已归档" };

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function DesignTasksAdmin({
  headerTitle,
  headerDesc,
  newTaskLabel,
}: {
  headerTitle: string;
  headerDesc: string;
  newTaskLabel: string;
}) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [statsByTask, setStatsByTask] = useState<Record<string, TaskStats>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"library" | "published">("library");
  const [publishTarget, setPublishTarget] = useState<TaskRow | null>(null);
  const [statsTarget, setStatsTarget] = useState<TaskRow | null>(null);
  const [remindTarget, setRemindTarget] = useState<TaskRow | null>(null);
  const [publishing, setPublishing] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/design-tasks");
    if (res.ok) setTasks((await res.json()).tasks ?? []);
    // 已发布任务的学生统计：一次请求拿全部，卡片不逐个查询
    fetch("/api/admin/design-task-stats")
      .then((r) => (r.ok ? r.json() : { stats: [] }))
      .then((d) => {
        const map: Record<string, TaskStats> = {};
        for (const s of d.stats ?? []) map[s.taskId] = s;
        setStatsByTask(map);
      })
      .catch(() => {});
    setLoading(false);
  }
  useEffect(() => {
    load();
    fetch("/api/admin/classes")
      .then((r) => r.json())
      .then((d) => setClasses(d.classes ?? []))
      .catch(() => {});
  }, []);

  // 任务库保留全部任务（含已发布）：教师需在不同时间面向不同班级重复发布
  const published = useMemo(() => tasks.filter((t) => t.status === "published"), [tasks]);
  const list = tab === "library" ? tasks : published;
  const classNameOf = (code: string) => classes.find((c) => c.inviteCode === code)?.name ?? code;

  async function create() {
    const res = await fetch("/api/admin/design-tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    if (res.ok) {
      const { id } = await res.json();
      location.href = `/admin/design-tasks/${id}`;
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/design-tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      window.alert(data.error ?? "操作失败");
      return false;
    }
    return true;
  }

  async function confirmPublish(codes: string[]) {
    if (!publishTarget) return;
    setPublishing(true);
    // 空班级 = 从所有班级撤回 → 任务回到草稿；否则发布/更新所选班级
    const ok =
      codes.length === 0
        ? await patch(publishTarget.id, { status: "draft", publishedClasses: [] })
        : await patch(publishTarget.id, { status: "published", publishedClasses: codes });
    setPublishing(false);
    setPublishTarget(null);
    if (ok) {
      setTab(codes.length === 0 ? "library" : "published");
      load();
    }
  }

  async function remove(t: TaskRow) {
    if (!window.confirm(`确认删除任务「${t.title}」？学生的练习记录将一并删除，不可恢复。`)) return;
    const res = await fetch(`/api/admin/design-tasks/${t.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      window.alert(body.error ?? "删除失败");
      return;
    }
    load();
  }

  const tabCls = (active: boolean) =>
    `rounded-full px-4 py-2 text-fs-body font-medium transition ${active ? "bg-primary text-on-primary shadow-card" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"}`;

  const textBtnCls = "rounded-lg bg-surface-container px-2.5 py-1.5 text-fs-sub font-medium text-on-surface-variant transition hover:bg-primary-container hover:text-on-primary-container";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-fs-section font-medium text-on-surface"><span className="h-5 w-1 rounded-full bg-lavender" />{headerTitle}</h2>
          <p className="mt-1 text-fs-label text-on-surface-variant">{headerDesc}</p>
        </div>
        <button type="button" onClick={create} className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-fs-body font-medium text-on-primary shadow-card transition hover:opacity-90">
          <Plus className="h-4 w-4" /> {newTaskLabel}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setTab("library")} className={tabCls(tab === "library")}>
          任务库（{tasks.length}）
        </button>
        <button type="button" onClick={() => setTab("published")} className={tabCls(tab === "published")}>
          已发布的任务（{published.length}）
        </button>
      </div>

      {loading ? (
        <p className="rounded-xl bg-surface px-4 py-10 text-center text-fs-sub text-on-surface-variant shadow-card">加载中…</p>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl bg-surface px-4 py-14 text-center shadow-card">
          <p className="text-fs-sub text-on-surface-variant">
            {tab === "library" ? "任务库暂无任务" : "还没有已发布的任务"}
          </p>
          <p className="text-fs-label text-on-surface-variant">
            {tab === "library" ? "点击「新建任务」创建草稿，编辑完成后可选择班级发布" : "在任务库中编辑任务后，点击卡片上的「发布」选择班级"}
          </p>
          <button type="button" onClick={create} className="mt-1 flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-fs-body font-medium text-on-primary transition hover:opacity-90">
            <Plus className="h-4 w-4" /> 新建任务
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 min-[1440px]:grid-cols-3">
          {list.map((t) => (
            <article key={t.id} className="flex flex-col overflow-hidden rounded-xl border-neo border-lavender/25 bg-surface shadow-leaf transition hover:shadow-float">
              <div className="relative h-36 shrink-0 overflow-hidden bg-surface-container">
                {t.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.cover_url} alt={t.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-on-surface-variant/60">
                    <ImageOff className="h-6 w-6" />
                    <span className="text-fs-label">暂无封面</span>
                  </div>
                )}
                <span
                  className={`absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-fs-label font-medium ${
                    t.status === "published" ? "bg-success text-on-success" : t.status === "archived" ? "bg-surface-container-high text-on-surface-variant" : "bg-primary-container text-on-primary-container"
                  }`}
                >
                  {STATUS_LABEL[t.status] ?? t.status}
                </span>
              </div>

              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-fs-card font-medium text-on-surface">{t.title}</h3>
                {t.subtitle && <p className="mt-0.5 text-fs-label text-on-surface-variant">{t.subtitle}</p>}
                <p className="mt-2 line-clamp-2 text-fs-sub text-on-surface-variant">{t.intro?.trim() || "暂无简介"}</p>

                {tab === "published" && t.published_classes?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {t.published_classes.map((code) => (
                      <span key={code} className="rounded-full bg-primary-container/50 px-2.5 py-0.5 text-fs-label text-on-primary-container">
                        {classNameOf(code)}
                      </span>
                    ))}
                  </div>
                )}

                {tab === "published" && (
                  <div className="mt-3 rounded-lg bg-surface-container px-3 py-2 text-fs-label text-on-surface-variant">
                    {(() => {
                      const s = statsByTask[t.id];
                      if (!s) return "学生统计：加载中…";
                      if (s.submittedCount === 0) return "学生统计：暂无提交";
                      const rate = s.submissionRate == null ? "—" : `${Math.round(s.submissionRate * 100)}%`;
                      return `学生统计：已提交 ${s.submittedCount}/${s.expectedCount} · 提交率 ${rate} · 达标 ${s.passedCount} 人`;
                    })()}
                  </div>
                )}

                <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                  <span className="shrink-0 text-fs-label text-on-surface-variant">更新于 {fmtTime(t.updated_at)}</span>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <Link href={`/admin/design-tasks/${t.id}`} className={textBtnCls}>
                      编辑
                    </Link>
                    {tab === "published" ? (
                      <>
                        <button type="button" onClick={() => setStatsTarget(t)} className={textBtnCls}>
                          统计
                        </button>
                        <button type="button" onClick={() => setRemindTarget(t)} className={textBtnCls}>
                          提醒
                        </button>
                        <button type="button" onClick={() => setPublishTarget(t)} className={textBtnCls}>
                          管理班级
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => setPublishTarget(t)} className={textBtnCls}>
                          发布
                        </button>
                        {t.status !== "published" && (
                          <button type="button" onClick={() => void remove(t)} className={`${textBtnCls} hover:bg-error/10 hover:text-error`}>
                            删除
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <PublishClassModal
        open={publishTarget !== null}
        taskTitle={publishTarget?.title ?? ""}
        initialCodes={publishTarget?.published_classes ?? []}
        busy={publishing}
        onConfirm={(codes) => void confirmPublish(codes)}
        onClose={() => setPublishTarget(null)}
      />

      {statsTarget && <TaskStatsModal taskId={statsTarget.id} taskTitle={statsTarget.title} onClose={() => setStatsTarget(null)} />}

      {remindTarget && <RemindModal taskId={remindTarget.id} taskTitle={remindTarget.title} onClose={() => setRemindTarget(null)} />}
    </div>
  );
}
