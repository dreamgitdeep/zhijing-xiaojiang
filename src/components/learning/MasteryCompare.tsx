import Link from "next/link";
import type { LearningPlantAccuracy } from "@/lib/repo";

/**
 * 掌握情况对比：正确率最高 / 最低各 5 株。
 * 形式选「排行列表 + 迷你条形」而非横向条形图：每项需可点击跳转 + 掌握徽章 + 百分比，
 * 天然是列表语义；迷你条用 CSS 宽度百分比即可，无需再引入 recharts，保持轻量。
 * 正确率=quiz_attempts 历史聚合（Σscore/Σtotal）；掌握徽章=computeMastery 唯一口径。
 */

function MasteryBadge({ mastered }: { mastered: boolean }) {
  return mastered ? (
    <span className="shrink-0 rounded-full bg-primary-container px-2 py-0.5 text-fs-label font-medium text-on-primary-container">已掌握</span>
  ) : (
    <span className="shrink-0 rounded-full bg-surface-container-high px-2 py-0.5 text-fs-label font-medium text-on-surface-variant">练习中</span>
  );
}

function Row({ p, rank, tone }: { p: LearningPlantAccuracy; rank: number; tone: "high" | "low" }) {
  return (
    <li>
      <Link
        href={`/plant-quiz?plantId=${p.plantId}`}
        className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-container/40"
      >
        <span className="w-5 shrink-0 text-center text-fs-label font-medium text-on-surface-variant">{rank}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.thumb} alt={p.name} className="h-8 w-8 shrink-0 rounded-md object-cover" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-fs-sub font-medium text-on-surface">{p.name}</span>
            <span className="shrink-0 text-fs-sub font-medium text-on-surface">{p.accuracy}%</span>
          </span>
          <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
            <span
              className={`block h-full rounded-full ${tone === "high" ? "bg-primary" : "bg-warning"}`}
              style={{ width: `${Math.max(p.accuracy, 2)}%` }}
            />
          </span>
        </span>
        <MasteryBadge mastered={p.mastered} />
      </Link>
    </li>
  );
}

function RankList({ title, hint, plants, tone }: { title: string; hint: string; plants: LearningPlantAccuracy[]; tone: "high" | "low" }) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-fs-sub font-medium text-on-surface">{title}</h3>
        <span className="text-fs-label text-on-surface-variant">{hint}</span>
      </div>
      {plants.length === 0 ? (
        <p className="py-4 text-center text-fs-label text-on-surface-variant/70">暂无练习记录</p>
      ) : (
        <ul className="space-y-0.5">
          {plants.map((p, i) => (
            <Row key={p.plantId} p={p} rank={i + 1} tone={tone} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function MasteryCompare({ plants }: { plants: LearningPlantAccuracy[] }) {
  const sorted = [...plants].sort((a, b) => b.accuracy - a.accuracy || b.attempts - a.attempts);
  const top = sorted.slice(0, 5);
  const bottom = [...sorted].reverse().slice(0, 5);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <RankList title="正确率最高" hint="保持得不错" plants={top} tone="high" />
      <RankList title="正确率最低" hint="建议重点巩固" plants={bottom} tone="low" />
    </div>
  );
}
