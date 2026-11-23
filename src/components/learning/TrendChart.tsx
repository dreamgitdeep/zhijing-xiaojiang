"use client";

import dynamic from "next/dynamic";

/**
 * 动态加载 recharts 趋势图：recharts 体积较大，用 next/dynamic(ssr:false) 将其
 * 隔离为仅学习管理页按需加载的独立 chunk，不增大其它页面首屏体积。
 */
const TrendBarChart = dynamic(() => import("./TrendBarChart"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[var(--size-chart-md)] w-full items-center justify-center">
      <span className="text-fs-label text-on-surface-variant">图表加载中…</span>
    </div>
  ),
});

export function TrendChart({ trend }: { trend: { date: string; count: number }[] }) {
  return <TrendBarChart trend={trend} />;
}
