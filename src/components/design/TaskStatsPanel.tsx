"use client";

import type { StudentTaskRow, TaskStats } from "@/lib/design-stats";

function fmtRate(rate: number | null): string {
  if (rate == null) return "—";
  return `${Math.round(rate * 100)}%`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** 任务统计展示面板——任务管理详情与学情看板共用，数据来自同一接口，天然同口径 */
export function TaskStatsPanel({ stats, students }: { stats: TaskStats; students?: StudentTaskRow[] }) {
  const empty = stats.submittedCount === 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 min-[480px]:grid-cols-4">
        <div className="rounded-lg bg-surface-container/60 px-4 py-3">
          <p className="text-fs-label text-on-surface-variant">应提交</p>
          <p className="mt-1 text-fs-section font-medium text-on-surface">{stats.expectedCount} 人</p>
        </div>
        <div className="rounded-lg bg-surface-container/60 px-4 py-3">
          <p className="text-fs-label text-on-surface-variant">已提交</p>
          <p className="mt-1 text-fs-section font-medium text-on-surface">{stats.submittedCount} 人</p>
        </div>
        <div className="rounded-lg bg-surface-container/60 px-4 py-3">
          <p className="text-fs-label text-on-surface-variant">提交率</p>
          <p className="mt-1 text-fs-section font-medium text-foreground">{fmtRate(stats.submissionRate)}</p>
        </div>
        <div className="rounded-lg bg-surface-container/60 px-4 py-3">
          <p className="text-fs-label text-on-surface-variant">达标（总分≥{stats.passScore}）</p>
          <p className="mt-1 text-fs-section font-medium text-on-surface">{stats.passedCount} 人</p>
        </div>
      </div>

      {empty ? (
        <p className="rounded-lg border-neo border-outline-variant/30 px-4 py-6 text-center text-fs-sub text-on-surface-variant">暂无提交</p>
      ) : (
        <div>
          <p className="mb-2 text-fs-label text-on-surface-variant">阶段完成分布（达标线 {stats.passScore} 分）</p>
          <div className="space-y-2">
            {stats.stageStats.map((s) => (
              <div key={s.key} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-fs-sub text-on-surface" title={s.name}>
                  {s.key} {s.name}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-container">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: stats.expectedCount > 0 ? `${Math.min(100, (s.passed / stats.expectedCount) * 100)}%` : "0%" }}
                  />
                </div>
                <span className="w-28 shrink-0 text-right text-fs-label text-on-surface-variant">
                  提交 {s.submitted} · 通过 {s.passed}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-fs-label text-on-surface-variant">最近提交：{fmtTime(stats.lastSubmissionAt)}</p>
        </div>
      )}

      {students && students.length > 0 && (
        <div className="overflow-x-auto rounded-lg border-neo border-outline-variant/30">
          <table className="w-full min-w-[var(--size-modal-md)] text-left">
            <thead>
              <tr className="bg-surface-container/60 text-fs-label text-on-surface-variant">
                <th className="px-3 py-2 font-medium">学号</th>
                <th className="px-3 py-2 font-medium">姓名</th>
                <th className="px-3 py-2 font-medium">班级</th>
                <th className="px-3 py-2 font-medium" title="已掌握植物数">掌握</th>
                <th className="px-3 py-2 font-medium" title="练习记录条数">练习</th>
                <th className="px-3 py-2 font-medium" title="智能问答消息数">问答</th>
                <th className="px-3 py-2 font-medium">最近活跃</th>
                {stats.stageStats.map((s) => (
                  <th key={s.key} className="px-3 py-2 font-medium">{s.key} 最佳</th>
                ))}
                <th className="px-3 py-2 font-medium">总分</th>
                <th className="px-3 py-2 font-medium">最终成绩</th>
                <th className="px-3 py-2 font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.userId} className="border-t-neo border-outline-variant/20 text-fs-sub">
                  <td className="px-3 py-2 text-on-surface-variant">{s.studentNo || "—"}</td>
                  <td className="px-3 py-2 text-on-surface">{s.name}</td>
                  <td className="px-3 py-2 text-on-surface-variant">{s.className || "未分班"}</td>
                  <td className="px-3 py-2 text-on-surface">{s.mastered}</td>
                  <td className="px-3 py-2 text-on-surface-variant">{s.attempts}</td>
                  <td className="px-3 py-2 text-on-surface-variant">{s.chatCount}</td>
                  <td className="px-3 py-2 text-on-surface-variant">{fmtTime(s.lastActiveAt)}</td>
                  {stats.stageStats.map((st) => (
                    <td key={st.key} className="px-3 py-2 text-on-surface">
                      {s.stageBest[st.key] != null ? s.stageBest[st.key] : "—"}
                    </td>
                  ))}
                  <td className="px-3 py-2 font-medium text-on-surface">{s.submitted ? s.totalScore : "—"}</td>
                  <td className="px-3 py-2 font-medium text-foreground">{s.finalScore != null ? s.finalScore : "—"}</td>
                  <td className="px-3 py-2">
                    {!s.submitted ? (
                      <span className="rounded-full bg-surface-container px-2 py-0.5 text-fs-label text-on-surface-variant">未提交</span>
                    ) : s.passed ? (
                      <span className="rounded-full bg-success/10 px-2 py-0.5 text-fs-label text-success">已达标</span>
                    ) : (
                      <span className="rounded-full bg-warning/10 px-2 py-0.5 text-fs-label text-warning">进行中</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
