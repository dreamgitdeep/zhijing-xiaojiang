import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, BookOpen, MessageCircle, PenTool, Target, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getSessionUser } from "@/lib/auth";
import { loadDataset } from "@/lib/data";
import { emptyLearningDashboard, getLearningDashboard, type LearningDashboard, type LearningPlant } from "@/lib/repo";
import { isCloudConfigured } from "@/lib/supabase-server";
import { TrendChart } from "@/components/learning/TrendChart";
import { MasteryCompare } from "@/components/learning/MasteryCompare";
import { DesignTranscript } from "@/components/learning/DesignTranscript";
import { getMyDesignTranscripts, type DesignTranscriptTask } from "@/lib/design";

export const dynamic = "force-dynamic";

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

function StatCard({ icon, label, value, suffix, tone, index }: { icon: React.ReactNode; label: string; value: number | string; suffix?: string; tone: string; index: number }) {
  return (
    <div className="lift rise flex items-center gap-4 rounded-xl bg-surface p-6 shadow-card" style={{ animationDelay: `${index * 70}ms` }}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white shadow-card ${tone}`}>
        {icon}
      </div>
      <div>
        <p className="text-fs-title font-medium text-on-surface">
          {value}
          {suffix && <span className="ml-0.5 text-fs-sub font-medium text-on-surface-variant">{suffix}</span>}
        </p>
        <p className="text-fs-label text-on-surface-variant">{label}</p>
      </div>
    </div>
  );
}

function PlantGrid({ title, plants, badge }: { title: string; plants: LearningPlant[]; badge?: string }) {
  return (
    <section className="rounded-xl bg-surface p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-fs-body font-medium text-on-surface">{title}</h2>
        <span className="text-fs-label text-on-surface-variant">{plants.length} 株</span>
      </div>
      {plants.length === 0 ? (
        <p className="py-6 text-center text-fs-sub text-on-surface-variant/70">暂无记录</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {plants.map((p) => (
            <Link
              key={p.plantId}
              href={`/plant-quiz?plantId=${p.plantId}`}
              className="group overflow-hidden rounded-lg border-neo border-ink bg-surface-container/40 transition-all hover:-translate-y-0.5 hover:shadow-card"
            >
              <div className="relative h-20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumb} alt={p.name} className="h-full w-full object-cover" />
                {badge && (
                  <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-success px-1.5 py-0.5 text-fs-label font-medium text-white">
                    <BadgeCheck className="h-3 w-3" />
                    {badge}
                  </span>
                )}
              </div>
              <div className="px-2 py-1.5">
                <p className="truncate text-fs-label font-medium text-on-surface">{p.name}</p>
                <p className="text-fs-label text-on-surface-variant">最佳 {p.bestScore}/{p.total}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/** 仅用于单次得分的展示配色分档，与掌握判定阈值无关 */
const DISPLAY_GOOD_RATIO = 0.8;
const DISPLAY_FAIR_RATIO = 0.6;

export default async function LearningPage() {
  const user = await getSessionUser();
  if (!user || user.role === "teacher") redirect(user?.role === "teacher" ? "/admin" : "/");

  let dash: LearningDashboard = emptyLearningDashboard();
  if (isCloudConfigured()) {
    try {
      dash = await getLearningDashboard(user.id);
    } catch {
      dash = emptyLearningDashboard();
    }
  }

  let transcripts: DesignTranscriptTask[] = [];
  if (isCloudConfigured()) {
    try {
      transcripts = await getMyDesignTranscripts(user.id);
    } catch {
      transcripts = [];
    }
  }

  const dataset = await loadDataset();
  const isEmpty = dash.stats.totalAttempts === 0;
  const hasTrendData = dash.trend.some((t) => t.count > 0);

  return (
    <AppShell user={user}>
      <div className="student-vivid w-full space-y-5 py-6">
        <section className="rise flex flex-col justify-between gap-4 rounded-xl border-neo border-ink bg-primary p-6 shadow-card sm:flex-row sm:items-end sm:p-8">
          <div>
            <p className="text-fs-title font-bold text-on-primary">学习进度</p>
            <p className="mt-1 text-fs-sub font-medium text-on-primary/75">把图鉴里的植物一株一株练成掌握</p>
          </div>
          <p className="text-left text-hero-number tabular-nums tracking-tight text-on-primary sm:text-right">
            {dash.stats.mastered}
            <span className="ml-2 align-baseline text-fs-section font-bold text-on-primary/75">株已掌握</span>
          </p>
        </section>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard index={1} tone="grad-sprout" icon={<BookOpen className="h-5 w-5" />} label="练习中" value={dash.stats.practiced} />
          <StatCard index={2} tone="grad-water" icon={<Target className="h-5 w-5" />} label="累计练习" value={dash.stats.totalAttempts} suffix="次" />
          <StatCard index={3} tone="grad-sun" icon={<TrendingUp className="h-5 w-5" />} label="平均正确率" value={dash.stats.avgAccuracy} suffix="%" />
          <StatCard index={4} tone="grad-blossom" icon={<MessageCircle className="h-5 w-5" />} label="AI 问答" value={dash.stats.chatCount} suffix="条" />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-xl bg-surface p-6 shadow-card">
            <h2 className="mb-4 text-fs-body font-medium text-on-surface">近 7 天练习趋势</h2>
            {hasTrendData ? (
              <TrendChart trend={dash.trend} />
            ) : (
              <div className="flex h-[var(--size-chart-md)] flex-col items-center justify-center gap-3">
                <p className="text-fs-sub text-on-surface-variant/70">{isEmpty ? "还没有练习记录" : "近 7 天还没有练习记录"}</p>
                <Link href="/catalog" className="rounded-full bg-primary px-4 py-1.5 text-fs-label font-medium text-on-primary transition-opacity hover:opacity-90">
                  {isEmpty ? "去植物图鉴开始第一次练习" : "去练习"}
                </Link>
              </div>
            )}
          </section>

          <section className="rounded-xl bg-surface p-6 shadow-card">
            <h2 className="mb-4 text-fs-body font-medium text-on-surface">最近练习记录</h2>
            {dash.recentAttempts.length === 0 ? (
              <p className="py-6 text-center text-fs-sub text-on-surface-variant/70">暂无练习记录</p>
            ) : (
              <ul className="divide-y divide-outline-variant/15">
                {dash.recentAttempts.map((a) => (
                  <li key={a.id}>
                    <Link href={`/plant-quiz?plantId=${a.plantId}`} className="flex items-center justify-between py-2.5 transition-colors hover:bg-surface-container/40">
                      <span className="text-fs-sub font-medium text-on-surface">{a.plantName}</span>
                      <span className="flex items-center gap-3">
                        <span className={`text-fs-sub font-medium ${a.total > 0 && a.score / a.total >= DISPLAY_GOOD_RATIO ? "text-success" : a.total > 0 && a.score / a.total >= DISPLAY_FAIR_RATIO ? "text-warning" : "text-error"}`}>
                          {a.score}/{a.total}
                        </span>
                        <span className="text-fs-label text-on-surface-variant">{fmtTime(a.createdAt)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="rounded-xl bg-surface p-6 shadow-card">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-fs-body font-medium text-on-surface">掌握情况对比</h2>
            <span className="text-fs-label text-on-surface-variant">正确率来自练习历史聚合 · 掌握状态为当前判定</span>
          </div>
          {dash.plantAccuracy.length === 0 ? (
            <p className="py-6 text-center text-fs-sub text-on-surface-variant/70">还没有练习记录，先去图鉴练一练吧</p>
          ) : (
            <MasteryCompare plants={dash.plantAccuracy} />
          )}
        </section>

        <PlantGrid title="已掌握植物" plants={dash.masteredPlants} badge="已掌握" />
        <PlantGrid title="练习中植物" plants={dash.inProgress} />

        {transcripts.length > 0 ? (
          <DesignTranscript transcripts={transcripts} />
        ) : (
          <section className="flex flex-col items-center gap-3 rounded-xl border-neo border-dashed border-outline-variant/40 bg-surface/60 p-8 text-center">
            <PenTool className="h-8 w-8 text-on-surface-variant/60" />
            <div>
              <h2 className="text-fs-body font-medium text-on-surface">植景设计成果</h2>
              <p className="mt-1 text-fs-sub text-on-surface-variant">暂无设计成果，去植景设计画板创作你的第一份作品</p>
            </div>
            <Link href="/design" className="rounded-full bg-primary px-5 py-2 text-fs-sub font-medium text-on-primary transition-opacity hover:opacity-90">
              前往植景设计
            </Link>
          </section>
        )}
      </div>
    </AppShell>
  );
}
