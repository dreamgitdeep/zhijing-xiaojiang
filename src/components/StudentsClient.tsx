"use client";

import { useMemo, useState } from "react";
import { Download, Search, X } from "lucide-react";
import ClassAdmin from "./ClassAdmin";
import { DesignTaskStatsBoard } from "./DesignTaskStatsBoard";
import LearningAnalyticsChat from "./LearningAnalyticsChat";

export interface StudentView {
  userId: string;
  name: string;
  studentNo: string;
  className: string;
  mastered: number;
  attempts: number;
  avgScore: number | null;
  lastActive: string | null;
}

interface ClassInfo {
  className: string;
  studentCount: number;
  avgMastered: number;
}

interface RecentActivity {
  name: string;
  plantName: string;
  score: number;
  total: number;
  createdAt: string;
}

interface DetailData {
  plantGrid: { plantId: string; name: string; mastered: boolean; manual: boolean; bestScore: number }[];
  recentAttempts: { id: number; plantName: string; score: number; total: number; createdAt: string }[];
}

type SortKey = "mastered" | "active" | "avg";

function formatLastActive(iso: string | null): string {
  if (!iso) return "未活跃";
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (diffDays <= 0) return `今天 ${hm}`;
  if (diffDays === 1) return `昨天 ${hm}`;
  if (diffDays < 7) return `${diffDays} 天前`;
  return `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 仅用于单次得分的展示配色分档，与掌握判定阈值无关 */
const DISPLAY_GOOD_RATIO = 0.8;
const DISPLAY_LOW_RATIO = 0.7;

function scoreColor(ratio: number): string {
  if (ratio >= DISPLAY_GOOD_RATIO) return "text-success font-medium";
  if (ratio < DISPLAY_LOW_RATIO) return "text-warning font-medium";
  return "text-on-surface font-medium";
}

const BAR_COLORS = ["bg-primary", "bg-water", "bg-sun", "bg-blossom", "bg-sprout", "bg-lavender"];

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  return formatLastActive(iso);
}

export default function StudentsClient({
  students,
  classes,
  recentActivity,
  totalPlants,
}: {
  students: StudentView[];
  classes: ClassInfo[];
  recentActivity: RecentActivity[];
  totalPlants: number;
}) {
  const [className, setClassName] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("mastered");
  const [keyword, setKeyword] = useState("");
  const [detail, setDetail] = useState<{ name: string; data: DetailData } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [resetCode, setResetCode] = useState<{ studentNo: string; code: string; expiresAt: string } | null>(null);
  const [resetPending, setResetPending] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  async function genResetCode(studentNo: string) {
    setResetPending(studentNo);
    setResetError(null);
    try {
      const res = await fetch("/api/admin/reset-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentNo }),
      });
      const data = await res.json();
      if (data.ok) {
        setResetCode({ studentNo, code: data.code, expiresAt: data.expiresAt });
      } else {
        setResetError(data.error || "生成失败，请重试");
      }
    } catch {
      setResetError("网络异常，请重试");
    } finally {
      setResetPending(null);
    }
  }

  const filtered = useMemo(() => {
    const kw = keyword.trim();
    const list = students.filter(
      (s) =>
        (className === "all" || s.className === className) &&
        (!kw || s.name.includes(kw) || s.studentNo.includes(kw)),
    );
    return [...list].sort((a, b) => {
      if (sortKey === "avg") return (b.avgScore ?? 0) - (a.avgScore ?? 0);
      if (sortKey === "active") {
        const ta = a.lastActive ? new Date(a.lastActive).getTime() : 0;
        const tb = b.lastActive ? new Date(b.lastActive).getTime() : 0;
        return tb - ta;
      }
      return b.mastered - a.mastered;
    });
  }, [students, className, keyword, sortKey]);

  const maxAvg = Math.max(...classes.map((c) => c.avgMastered), 1);

  function exportMatrix() {
    const header = ["姓名", "学号", "班级", "已掌握", "练习次数", "平均正确率", "最近活跃"];
    const rows = filtered.map((s) => [
      s.name,
      s.studentNo,
      s.className,
      s.mastered,
      s.attempts,
      s.avgScore === null ? "-" : `${Math.round(s.avgScore * 100)}%`,
      formatLastActive(s.lastActive),
    ]);
    return { header, rows };
  }

  function download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportData(fmt: "xlsx" | "csv" | "json") {
    const { header, rows } = exportMatrix();
    const stamp = new Date().toISOString().slice(0, 10);
    if (fmt === "json") {
      const objs = rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r])));
      download(new Blob([JSON.stringify(objs, null, 2)], { type: "application/json" }), `学情看板_${stamp}.json`);
      return;
    }
    if (fmt === "csv") {
      const lines = rows.map((r) =>
        r
          .map((v) => {
            const s = String(v);
            return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(","),
      );
      download(
        new Blob(["\uFEFF" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" }),
        `学情看板_${stamp}.csv`,
      );
      return;
    }
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws["!cols"] = header.map((h, i) => ({ wch: i === 0 || i === 2 ? 12 : 10 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "学情看板");
    XLSX.writeFile(wb, `学情看板_${stamp}.xlsx`);
  }

  async function openDetail(s: StudentView) {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/student-detail?userId=${encodeURIComponent(s.userId)}`);
      if (!res.ok) throw new Error("加载失败");
      const data = (await res.json()) as DetailData;
      setDetail({ name: s.name, data });
    } catch {
      alert("加载学生明细失败，请稍后重试");
    } finally {
      setLoadingDetail(false);
    }
  }

  const selectCls =
    "h-9 rounded-md border-neo border-outline-variant/30 bg-surface px-3 text-fs-sub text-on-surface focus:border-primary focus:outline-none";

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <LearningAnalyticsChat />
      <ClassAdmin />
      <div className="lg:col-span-5">
        <DesignTaskStatsBoard />
      </div>
      <section className="overflow-hidden rounded-xl border-neo border-water/25 bg-water-container/50 shadow-leaf lg:col-span-3">
        <div className="h-1.5 bg-water" />
        <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-medium text-on-surface">
            <span className="h-4 w-1 rounded-full bg-water" />
            班级掌握对比
          </h2>
          <span className="text-fs-label text-on-surface-variant">人均已掌握（种）</span>
        </div>
        {classes.length === 0 ? (
          <p className="text-fs-sub text-on-surface-variant">暂无班级数据</p>
        ) : (
          <div className="space-y-3">
            {classes.map((c, i) => (
              <div key={c.className} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-fs-sub text-on-surface">{c.className}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface/80">
                  <div
                    className={`h-full rounded-full ${BAR_COLORS[i % BAR_COLORS.length]} transition-all duration-300`}
                    style={{ width: `${Math.round((c.avgMastered / maxAvg) * 100)}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-fs-sub font-medium text-on-surface">
                  {c.avgMastered}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 border-t-neo border-outline-variant/30 pt-3 text-fs-label text-on-surface-variant">
          数值为人均掌握植物种数，建议对薄弱班级结合课堂抽查强化课后练习。
        </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border-neo border-sprout/25 bg-sprout-container/50 shadow-leaf lg:col-span-2">
        <div className="h-1.5 bg-sprout" />
        <div className="p-6">
        <h2 className="mb-4 flex items-center gap-2 font-medium text-on-surface">
          <span className="h-4 w-1 rounded-full bg-sprout" />
          最近练习动态
        </h2>
        {recentActivity.length === 0 ? (
          <p className="text-fs-sub text-on-surface-variant">暂无练习记录</p>
        ) : (
          <ul className="space-y-3">
            {recentActivity.slice(0, 5).map((a, i) => (
              <li key={`${a.name}-${a.createdAt}-${i}`} className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-fs-label font-medium text-on-surface-variant shadow-card">
                  {a.name.slice(0, 1)}
                </div>
                <p className="flex-1 text-fs-sub text-on-surface">
                  <span className="font-medium">{a.name}</span> 完成了「{a.plantName}」的练习，
                  <span className={scoreColor(a.total > 0 ? a.score / a.total : 0)}>
                    答对 {a.score}/{a.total} 题
                  </span>
                </p>
                <span className="shrink-0 text-fs-label text-on-surface-variant">{relativeTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border-neo border-primary/20 bg-surface shadow-leaf lg:col-span-5">
        <div className="h-1.5 bg-primary" />
        <div className="flex flex-wrap items-center gap-3 border-b-neo border-outline-variant/20 p-5">
          <select value={className} onChange={(e) => setClassName(e.target.value)} className={selectCls}>
            <option value="all">全部班级</option>
            {classes.map((c) => (
              <option key={c.className} value={c.className}>
                {c.className}
              </option>
            ))}
          </select>
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className={selectCls}>
            <option value="mastered">按掌握数排序</option>
            <option value="active">按最近活跃排序</option>
            <option value="avg">按平均正确率排序</option>
          </select>
          <div className="relative min-w-[var(--size-col-narrow)] max-w-xs flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索学生姓名 / 学号"
              className="h-9 w-full rounded-md border-neo border-outline-variant/30 bg-surface pl-9 pr-3 text-fs-sub text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            {(
              [
                ["xlsx", "导出 Excel"],
                ["csv", "导出 CSV"],
                ["json", "导出 JSON"],
              ] as const
            ).map(([fmt, label]) => (
              <button
                key={fmt}
                onClick={() => void exportData(fmt)}
                className="flex h-9 items-center gap-2 rounded-md border-neo border-outline-variant/30 px-3 text-fs-sub font-medium text-on-surface transition-colors hover:bg-surface-container"
              >
                <Download className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-fs-sub">
            <thead>
              <tr className="border-b-neo border-outline-variant/20 bg-surface-container/50 text-left text-on-surface-variant">
                <th className="px-4 py-3 font-medium">学生</th>
                <th className="px-4 py-3 font-medium">学号</th>
                <th className="px-4 py-3 font-medium">班级</th>
                <th className="w-48 px-4 py-3 font-medium">已掌握</th>
                <th className="px-4 py-3 font-medium">练习次数</th>
                <th className="px-4 py-3 font-medium">平均正确率</th>
                <th className="px-4 py-3 font-medium">最近活跃</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {filtered.map((s) => (
                <tr key={s.userId} className="transition-colors hover:bg-surface-container/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-fs-label font-medium text-on-primary-container">
                        {(s.name || "?").slice(0, 1)}
                      </div>
                      <span className="font-medium text-on-surface">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-fs-label text-on-surface-variant">{s.studentNo || "-"}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{s.className || "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-container-high">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${totalPlants > 0 ? Math.round((s.mastered / totalPlants) * 100) : 0}%` }}
                        />
                      </div>
                      <span className="whitespace-nowrap text-fs-label font-medium text-on-surface">
                        {s.mastered} / {totalPlants}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">{s.attempts}</td>
                  <td className="px-4 py-3">
                    {s.avgScore === null ? (
                      <span className="text-on-surface-variant">-</span>
                    ) : (
                      <span className={scoreColor(s.avgScore / 100)}>{Math.round(s.avgScore)}%</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">{formatLastActive(s.lastActive)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => genResetCode(s.studentNo)}
                        disabled={resetPending !== null}
                        className="h-8 rounded-md border-neo border-outline-variant/30 px-3 text-fs-label font-medium text-on-surface transition-colors hover:bg-surface-container disabled:opacity-50"
                      >
                        {resetPending === s.studentNo ? "生成中…" : "重置码"}
                      </button>
                      <button
                        onClick={() => openDetail(s)}
                        disabled={loadingDetail}
                        className="h-8 rounded-md border-neo border-outline-variant/30 px-3 text-fs-label font-medium text-on-surface transition-colors hover:bg-surface-container disabled:opacity-50"
                      >
                        明细
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-fs-sub text-on-surface-variant">
                    暂无学生数据（学生注册并练习后此处将展示学情）
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5 backdrop-blur-sm"
          onClick={() => setDetail(null)}
        >
          <div
            className="max-h-[var(--size-modal-vh)] w-full max-w-2xl overflow-y-auto rounded-xl bg-surface p-6 shadow-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-fs-card font-medium text-on-surface">{detail.name} · 学习明细</h3>
              <button
                onClick={() => setDetail(null)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <h4 className="mb-2 text-fs-sub font-medium text-on-surface">
              掌握状态（{detail.data.plantGrid.length}）
            </h4>
            {detail.data.plantGrid.length === 0 ? (
              <p className="mb-4 text-fs-sub text-on-surface-variant">尚未掌握任何植物</p>
            ) : (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {detail.data.plantGrid.map((m) => (
                  <span
                    key={m.plantId}
                    className={
                      m.mastered
                        ? "rounded-full bg-success/10 px-2.5 py-1 text-fs-label text-success"
                        : "rounded-full bg-surface-container px-2.5 py-1 text-fs-label text-on-surface-variant"
                    }
                  >
                    {m.name}
                    {m.manual ? " ·手动" : ""}
                  </span>
                ))}
              </div>
            )}

            <h4 className="mb-2 text-fs-sub font-medium text-on-surface">最近 10 次练习</h4>
            {detail.data.recentAttempts.length === 0 ? (
              <p className="text-fs-sub text-on-surface-variant">暂无练习记录</p>
            ) : (
              <table className="w-full text-fs-sub">
                <thead>
                  <tr className="border-b-neo border-outline-variant/20 text-left text-fs-label text-on-surface-variant">
                    <th className="py-2 font-medium">植物</th>
                    <th className="py-2 font-medium">得分</th>
                    <th className="py-2 font-medium">时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {detail.data.recentAttempts.map((a) => (
                    <tr key={a.id}>
                      <td className="py-2 text-on-surface">{a.plantName}</td>
                      <td className="py-2">
                        <span className={scoreColor(a.score / a.total)}>
                          {a.score}/{a.total}
                        </span>
                      </td>
                      <td className="py-2 text-on-surface-variant">
                        {new Date(a.createdAt).toLocaleString("zh-CN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {(resetCode || resetError) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5 backdrop-blur-sm"
          onClick={() => {
            setResetCode(null);
            setResetError(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-xl bg-surface p-6 shadow-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            {resetCode ? (
              <>
                <h3 className="mb-3 text-fs-card font-medium text-on-surface">
                  重置码已生成 · 学号 {resetCode.studentNo}
                </h3>
                <p className="mb-3 select-all rounded-lg bg-surface-container px-4 py-3 text-center text-fs-title font-medium tracking-widest text-foreground">
                  {resetCode.code}
                </p>
                <p className="mb-4 text-fs-sub text-on-surface-variant">
                  请将重置码线下告知学生，15 分钟内有效，仅可使用一次。
                </p>
                <p className="mb-4 text-fs-label text-on-surface-variant">
                  有效期至 {new Date(resetCode.expiresAt).toLocaleString("zh-CN")}
                </p>
                <button
                  onClick={() => setResetCode(null)}
                  className="w-full rounded-lg bg-primary py-3 text-fs-sub font-medium text-on-primary transition-opacity hover:opacity-90"
                >
                  我已记录
                </button>
              </>
            ) : (
              <>
                <h3 className="mb-3 text-fs-card font-medium text-on-surface">生成重置码失败</h3>
                <p className="mb-4 text-fs-sub text-error">{resetError}</p>
                <button
                  onClick={() => setResetError(null)}
                  className="w-full rounded-lg bg-primary py-3 text-fs-sub font-medium text-on-primary transition-opacity hover:opacity-90"
                >
                  关闭
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
