"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { StudentTaskRow, TaskStats } from "@/lib/design-stats";
import { TaskStatsPanel } from "./TaskStatsPanel";

export function TaskStatsModal({ taskId, taskTitle, onClose }: { taskId: string; taskTitle: string; onClose: () => void }) {
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [students, setStudents] = useState<StudentTaskRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/design-task-stats?taskId=${encodeURIComponent(taskId)}`)
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? "加载统计失败");
        setStats(data.stats);
        setStudents(data.students ?? []);
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[var(--size-modal-vh)] w-full max-w-3xl overflow-y-auto rounded-2xl bg-surface p-6 shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-fs-card font-medium text-on-surface">学生完成情况 · {taskTitle}</h3>
            <p className="mt-0.5 text-fs-label text-on-surface-variant">任务完成与学情数据（掌握/练习/问答），仅展示发布范围内的学生</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-on-surface-variant transition hover:bg-surface-container" title="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>
        {error ? (
          <p className="rounded-lg bg-error/10 px-4 py-6 text-center text-fs-sub text-error">{error}</p>
        ) : !stats ? (
          <p className="px-4 py-10 text-center text-fs-sub text-on-surface-variant">加载中…</p>
        ) : (
          <TaskStatsPanel stats={stats} students={students ?? undefined} />
        )}
      </div>
    </div>
  );
}
