"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface ClassOption {
  id: string;
  name: string;
  inviteCode: string;
  students: number;
}

export function PublishClassModal({
  open,
  taskTitle,
  initialCodes,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  taskTitle: string;
  initialCodes?: string[];
  busy?: boolean;
  onConfirm: (codes: string[]) => void;
  onClose: () => void;
}) {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setPicked(initialCodes ?? []);
    setErr("");
    setLoading(true);
    fetch("/api/admin/classes")
      .then((r) => r.json())
      .then((d) => setClasses(d.classes ?? []))
      .catch(() => setErr("班级列表加载失败"))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  // 已有发布班级 → 「管理/撤回」模式；否则「首次发布」模式
  const isManaging = (initialCodes ?? []).length > 0;

  function toggle(code: string) {
    setPicked((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-float" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-fs-card font-medium text-on-surface">{isManaging ? "管理发布班级" : "选择发布班级"}</h3>
            <p className="mt-1 text-fs-label text-on-surface-variant">
              {isManaging
                ? `勾选要发布给的班级；取消勾选即从该班级撤回「${taskTitle}」。全部取消则任务回到草稿。`
                : `发布后，所选班级的学生可在「植景设计」中看到任务「${taskTitle}」`}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-on-surface-variant transition hover:bg-surface-container">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
          {loading && <p className="py-6 text-center text-fs-label text-on-surface-variant">加载班级中…</p>}
          {!loading && classes.length === 0 && (
            <p className="py-6 text-center text-fs-label text-on-surface-variant">
              {err || "暂无班级，请先在学情看板创建班级"}
            </p>
          )}
          {classes.map((c) => (
            <label
              key={c.id}
              className={`flex cursor-pointer items-center justify-between rounded-xl border-neo px-4 py-3 transition ${
                picked.includes(c.inviteCode) ? "border-primary bg-primary-container/30" : "border-outline-variant/25 hover:bg-surface-container/50"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={picked.includes(c.inviteCode)}
                  onChange={() => toggle(c.inviteCode)}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-fs-body text-on-surface">{c.name}</span>
              </span>
              <span className="text-fs-label text-on-surface-variant">{c.students} 人</span>
            </label>
          ))}
        </div>

        {err && classes.length > 0 && <p className="mt-2 text-fs-label text-error">{err}</p>}

        <div className="mt-5 flex items-center justify-end gap-2.5">
          <button type="button" onClick={onClose} className="rounded-full bg-surface-container px-4 py-2 text-fs-body font-medium text-on-surface transition hover:bg-surface-container-high">
            取消
          </button>
          <button
            type="button"
            disabled={busy || (!isManaging && picked.length === 0)}
            onClick={() => onConfirm(picked)}
            className="rounded-full bg-primary px-4 py-2 text-fs-body font-medium text-on-primary transition hover:opacity-90 disabled:opacity-50"
          >
            {busy
              ? "处理中…"
              : isManaging
                ? picked.length === 0
                  ? "确认全部撤回"
                  : `确认保存（${picked.length} 个班级）`
                : `确认发布（${picked.length} 个班级）`}
          </button>
        </div>
      </div>
    </div>
  );
}
