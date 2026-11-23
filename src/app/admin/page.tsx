import Link from "next/link";
import { BarChart3, BookCheck, ChevronRight, Database, PencilLine, UserCheck, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PAGE_COPY } from "@/config/pages";
import { requireTeacher } from "@/lib/auth";
import { getHardPlants, getTeacherStats, currentMode } from "@/lib/repo";

export const dynamic = "force-dynamic";

type Accent = "leaf" | "sprout" | "water" | "sun" | "blossom" | "lavender" | "bark";
const ACCENTS: Record<Accent, { band: string; chip: string; bg: string; border: string }> = {
  leaf: { band: "bg-primary", chip: "bg-primary-container text-on-primary-container", bg: "bg-primary-container/45", border: "border-ink" },
  sprout: { band: "bg-sprout", chip: "bg-sprout-container text-on-sprout-container", bg: "bg-sprout-container/60", border: "border-ink" },
  water: { band: "bg-water", chip: "bg-water-container text-on-water-container", bg: "bg-water-container/60", border: "border-ink" },
  sun: { band: "bg-sun", chip: "bg-sun-container text-on-sun-container", bg: "bg-sun-container/60", border: "border-ink" },
  blossom: { band: "bg-blossom", chip: "bg-blossom-container text-on-blossom-container", bg: "bg-blossom-container/60", border: "border-ink" },
  lavender: { band: "bg-lavender", chip: "bg-lavender-container text-on-lavender-container", bg: "bg-lavender-container/60", border: "border-ink" },
  bark: { band: "bg-bark", chip: "bg-bark-container text-on-bark-container", bg: "bg-bark-container/60", border: "border-ink" },
};
const BAR_COLORS = ["bg-primary", "bg-water", "bg-sun", "bg-blossom", "bg-sprout", "bg-lavender"];

function StatCard({
  icon,
  label,
  value,
  sub,
  subTone,
  accent = "leaf",
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub: string;
  subTone?: "success" | "muted";
  accent?: Accent;
}) {
  const a = ACCENTS[accent];
  return (
    <div className={`overflow-hidden rounded-xl border-neo ${a.border} ${a.bg} shadow-leaf transition-shadow hover:shadow-float`}>
      <div className={`h-1.5 ${a.band}`} />
      <div className="p-6">
        <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${a.chip}`}>{icon}</div>
        <p className="text-fs-sub text-on-surface-variant">{label}</p>
        <p className="mt-1 text-fs-title font-medium text-on-surface">{value}</p>
        <p className={`mt-1 text-fs-label ${subTone === "success" ? "text-success" : "text-on-surface-variant"}`}>{sub}</p>
      </div>
    </div>
  );
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  return day === 1 ? "昨天" : `${day} 天前`;
}

export default async function AdminPage() {
  const teacher = await requireTeacher();

  const [stats, hard] = await Promise.all([getTeacherStats(), getHardPlants()]);
  const classes = stats.byClass;
  const cloud = currentMode() === "cloud";
  const maxAvg = Math.max(1, ...classes.map((c) => c.avgMastered));
  const leader = classes[0];

  return (
    <AppShell user={teacher} floral>
      <div className="w-full py-8">
        <PageHeader
          title={PAGE_COPY.admin.title}
          description={cloud ? PAGE_COPY.admin.descriptionCloud : PAGE_COPY.admin.descriptionLocal}
        />

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={<Users className="h-5 w-5" />}
            label="学生总数"
            value={String(stats.studentTotal)}
            sub={cloud ? "含全部注册学生" : "本地模式仅本机数据"}
            accent="leaf"
          />
          <StatCard
            icon={<UserCheck className="h-5 w-5" />}
            label="近 7 日活跃"
            value={String(stats.activeRecent)}
            sub={stats.studentTotal > 0 ? `活跃率 ${Math.round((stats.activeRecent / stats.studentTotal) * 100)}%` : "暂无学生"}
            accent="water"
          />
          <StatCard
            icon={<BookCheck className="h-5 w-5" />}
            label="平均掌握数"
            value={
              <>
                {stats.avgMastered.toFixed(1)}
                <span className="text-fs-sub font-medium text-on-surface-variant">/135</span>
              </>
            }
            sub="每名学生平均掌握植物数"
            accent="sun"
          />
          <StatCard
            icon={<PencilLine className="h-5 w-5" />}
            label="练习总次数"
            value={String(stats.attemptTotal)}
            sub="含全部练习提交记录"
            accent="blossom"
          />
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-5">
          <section className="overflow-hidden rounded-xl border-neo border-lavender/25 bg-lavender-container/50 shadow-leaf lg:col-span-3">
            <div className="h-1.5 bg-lavender" />
            <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-medium text-on-surface">
                <span className="h-4 w-1 rounded-full bg-lavender" />
                班级平均掌握数对比
              </h2>
              <span className="text-fs-label text-on-surface-variant">单位：种</span>
            </div>
            {classes.length === 0 ? (
              <p className="text-fs-sub text-on-surface-variant">暂无班级数据</p>
            ) : (
              <div className="space-y-4">
                {classes.slice(0, 6).map((c, i) => (
                  <div key={c.className} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 truncate text-fs-sub text-on-surface">{c.className}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface/80">
                      <div
                        className={`h-full rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`}
                        style={{ width: `${Math.max(4, Math.round((c.avgMastered / maxAvg) * 100))}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-fs-sub font-medium text-on-surface">
                      {c.avgMastered.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {leader && classes.length > 1 ? (
              <p className="mt-4 border-t-neo border-outline-variant/20 pt-3 text-fs-label text-on-surface-variant">
                {leader.className} 班平均掌握 {leader.avgMastered.toFixed(1)} 种、{leader.students} 人参与；建议结合课堂抽查强化薄弱班级练习。
              </p>
            ) : null}
            </div>
          </section>

          <div className="space-y-4 lg:col-span-2">
            <section className="overflow-hidden rounded-xl border-neo border-sprout/25 bg-sprout-container/50 shadow-leaf">
              <div className="h-1.5 bg-sprout" />
              <div className="p-6">
              <h2 className="mb-4 flex items-center gap-2 font-medium text-on-surface">
                <span className="h-4 w-1 rounded-full bg-sprout" />
                最近练习动态
              </h2>
              {stats.recentActivity.length === 0 ? (
                <p className="text-fs-sub text-on-surface-variant">暂无练习记录</p>
              ) : (
                <ul className="space-y-3.5">
                  {stats.recentActivity.slice(0, 5).map((a, i) => (
                    <li key={`${a.createdAt}-${i}`} className="flex items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-fs-label font-medium text-on-surface shadow-card">
                        {(a.name || "?").charAt(0)}
                      </span>
                      <div className="min-w-0 text-fs-sub text-on-surface">
                        <span className="font-medium">{a.name}</span> 完成练习{" "}
                        <span className="text-on-surface-variant">
                          {a.plantName} · {a.score}/{a.total}
                        </span>
                      </div>
                      <span className="ml-auto shrink-0 text-fs-label text-on-surface-variant">
                        {relativeTime(a.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border-neo border-bark/25 bg-bark-container/50 shadow-leaf">
              <div className="h-1.5 bg-bark" />
              <div className="p-6">
              <h2 className="mb-4 flex items-center gap-2 font-medium text-on-surface">
                <span className="h-4 w-1 rounded-full bg-bark" />
                掌握难点植物（得分率低于 60%）
              </h2>
              {hard.length === 0 ? (
                <p className="text-fs-sub text-on-surface-variant">暂无难点数据</p>
              ) : (
                <ul className="space-y-2.5">
                  {hard.slice(0, 4).map((h) => (
                    <li key={h.plantId} className="flex items-center gap-3 text-fs-sub">
                      <span className="flex-1 truncate text-on-surface">
                        {h.name}
                        <span className="ml-2 font-latin text-fs-label italic text-on-surface-variant">{h.plantId}</span>
                      </span>
                      <span className="rounded-full bg-error/10 px-2 py-0.5 text-fs-label font-medium text-error">
                        {Math.round(h.avgScoreRatio * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              </div>
            </section>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/admin-plants"
            className="flex items-center gap-4 rounded-xl border-neo border-sprout/25 bg-sprout-container/50 p-6 shadow-leaf transition-all hover:-translate-y-0.5 hover:shadow-float"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sprout text-on-primary">
              <Database className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block font-medium text-on-surface">植物数据管理</span>
              <span className="mt-0.5 block text-fs-sub text-on-surface-variant">
                维护 135 种植物档案、题库与图片，支持批量导入导出
              </span>
            </span>
            <ChevronRight className="ml-auto h-5 w-5 shrink-0 text-on-surface-variant" />
          </Link>
          <Link
            href="/admin-students"
            className="flex items-center gap-4 rounded-xl border-neo border-water/25 bg-water-container/50 p-6 shadow-leaf transition-all hover:-translate-y-0.5 hover:shadow-float"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-water text-on-primary">
              <BarChart3 className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block font-medium text-on-surface">学情看板</span>
              <span className="mt-0.5 block text-fs-sub text-on-surface-variant">
                学生掌握明细、班级对比分析，支持导出 CSV 备课
              </span>
            </span>
            <ChevronRight className="ml-auto h-5 w-5 shrink-0 text-on-surface-variant" />
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
