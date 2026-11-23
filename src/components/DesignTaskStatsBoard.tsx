"use client";

import { useCallback, useEffect, useState } from "react";
import type { StudentTaskRow, TaskStats } from "@/lib/design-stats";
import { TaskStatsPanel } from "@/components/design/TaskStatsPanel";

interface TaskOption {
  taskId: string;
  title: string;
}

// 学情看板内的「任务完成情况」模块：与任务管理页共用 /api/admin/design-task-stats，口径唯一
export function DesignTaskStatsBoard() {
  const [options, setOptions] = useState<TaskOption[]>([]);
  const [statsByTask, setStatsByTask] = useState<Record<string, TaskStats>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ stats: TaskStats; students: StudentTaskRow[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadDetail = useCallback((taskId: string) => {
    setDetailLoading(true);
    fetch(`/api/admin/design-task-stats?taskId=${encodeURIComponent(taskId)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "加载统计失败");
        setDetail({ stats: data.stats, students: data.students ?? [] });
      })
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/admin/design-task-stats")
      .then(async (res) => {
        const data = await res.json();
        const list: TaskStats[] = data.stats ?? [];
        const map: Record<string, TaskStats> = {};
        for (const s of list) map[s.taskId] = s;
        setStatsByTask(map);
        setOptions(list.map((s) => ({ taskId: s.taskId, title: s.title })));
        if (list.length > 0) {
          setActiveId(list[0].taskId);
          loadDetail(list[0].taskId);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [loadDetail]);

  const pick = (taskId: string) => {
    setActiveId(taskId);
    setDetail(null);
    loadDetail(taskId);
  };

  return (
    <section className="overflow-hidden rounded-xl border-neo border-sun/25 bg-sun-container/40 shadow-leaf">
      <div className="h-1.5 bg-sun" />
      <div className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-fs-card font-medium text-on-surface">
            <span className="h-4 w-1 rounded-full bg-sun" />
            任务完成情况
          </h3>
          <p className="mt-0.5 text-fs-label text-on-surface-variant">已发布任务的学生提交与达标统计，与任务管理页同一口径</p>
        </div>
        {options.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {options.map((o) => (
              <button
                key={o.taskId}
                type="button"
                onClick={() => pick(o.taskId)}
                className={`rounded-full px-3 py-1.5 text-fs-label transition ${
                  o.taskId === activeId ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                {o.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <p className="px-2 py-8 text-center text-fs-sub text-on-surface-variant">加载中…</p>
      ) : options.length === 0 ? (
        <p className="px-2 py-8 text-center text-fs-sub text-on-surface-variant">暂无已发布的任务</p>
      ) : detailLoading && !detail ? (
        <p className="px-2 py-8 text-center text-fs-sub text-on-surface-variant">加载中…</p>
      ) : detail ? (
        <TaskStatsPanel stats={detail.stats} students={detail.students} />
      ) : (
        <p className="px-2 py-8 text-center text-fs-sub text-on-surface-variant">统计加载失败，请刷新重试</p>
      )}
      </div>
    </section>
  );
}
