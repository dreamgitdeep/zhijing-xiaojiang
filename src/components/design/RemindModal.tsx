"use client";

import { BellRing, X } from "lucide-react";
import { useEffect, useState } from "react";

interface PendingStudent {
  userId: string;
  name: string;
  studentNo: string;
  className: string;
  hasRun: boolean;
}

export function RemindModal({ taskId, taskTitle, onClose }: { taskId: string; taskTitle: string; onClose: () => void }) {
  const [pending, setPending] = useState<PendingStudent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/design-tasks/${taskId}/remind`)
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? "加载未完成学生失败");
        setPending(data.pending ?? []);
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  async function send() {
    if (sending || !pending || pending.length === 0) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/design-tasks/${taskId}/remind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "发送失败");
      setResult(`已提醒 ${data.reminded} 名学生${data.skipped ? `，${data.skipped} 名已有未读提醒未重复发送` : ""}`);
      setPending([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[var(--size-modal-vh)] w-full max-w-2xl flex-col rounded-2xl bg-surface p-6 shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-fs-card font-medium text-on-surface">提醒未完成任务的学生 · {taskTitle}</h3>
            <p className="mt-0.5 text-fs-label text-on-surface-variant">向发布班级内尚未完成任务的学生发送消息通知，学生在「消息通知」中查看</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-on-surface-variant transition hover:bg-surface-container" title="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && <p className="mb-3 rounded-lg bg-error/10 px-4 py-3 text-center text-fs-sub text-error">{error}</p>}
        {result && <p className="mb-3 rounded-lg bg-primary-container px-4 py-3 text-center text-fs-sub text-on-primary-container">{result}</p>}

        {pending === null && !result ? (
          <p className="px-4 py-10 text-center text-fs-sub text-on-surface-variant">加载中…</p>
        ) : pending !== null && pending.length === 0 && !result ? (
          <p className="rounded-lg bg-surface-container px-4 py-8 text-center text-fs-sub text-on-surface-variant">
            发布班级内的学生都已完成该任务，无需提醒
          </p>
        ) : pending !== null && pending.length > 0 ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border-neo border-outline-variant/30">
              <table className="w-full text-left text-fs-sub">
                <thead className="sticky top-0 bg-surface-container text-fs-label text-on-surface-variant">
                  <tr>
                    <th className="px-3 py-2 font-medium">姓名</th>
                    <th className="px-3 py-2 font-medium">学号</th>
                    <th className="px-3 py-2 font-medium">班级</th>
                    <th className="px-3 py-2 font-medium">进度</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((s) => (
                    <tr key={s.userId} className="border-t-neo border-outline-variant/20 text-on-surface">
                      <td className="px-3 py-2">{s.name}</td>
                      <td className="px-3 py-2">{s.studentNo || "—"}</td>
                      <td className="px-3 py-2">{s.className || "—"}</td>
                      <td className="px-3 py-2 text-on-surface-variant">{s.hasRun ? "已开始未完成" : "未开始"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-fs-label text-on-surface-variant">共 {pending.length} 名学生未完成</p>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 100))}
              placeholder="给学生留言（选填，100 字以内）"
              className="mt-2 w-full rounded-lg bg-surface-container px-4 py-2.5 text-fs-body text-on-surface outline-none transition placeholder:text-on-surface-variant/60 focus:ring-2 focus:ring-ink"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-full bg-surface-container px-5 py-2 text-fs-body font-medium text-on-surface-variant transition hover:bg-surface-container-high">
                取消
              </button>
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending}
                className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-fs-body font-medium text-on-primary shadow-card transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <BellRing className="h-4 w-4" />
                {sending ? "发送中…" : `发送提醒（${pending.length} 人）`}
              </button>
            </div>
          </>
        ) : null}

        {result && (
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={onClose} className="rounded-full bg-primary px-5 py-2 text-fs-body font-medium text-on-primary shadow-card transition hover:opacity-90">
              完成
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
