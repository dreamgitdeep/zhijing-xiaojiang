"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, Rectangle, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { barStyle, CHART, type TrendPoint } from "./chart-config";

/** 零值柱位可见小段高度（px），仅作"这里有柱位"的标示，不参与数值 */
const ZERO_STUB = 4;

/** 自定义柱体：非零画圆角柱（绿系深浅），零值画浅色小段标示柱位（不跳过空日） */
function TrendBarShape(props: { x?: number; y?: number; width?: number; height?: number; payload?: TrendPoint }) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
  if (!payload) return <g />;
  if (payload.count <= 0) {
    return <Rectangle x={x} y={y - ZERO_STUB} width={width} height={ZERO_STUB} radius={2} fill={CHART.zeroFill} stroke={CHART.ink} strokeWidth={1.5} />;
  }
  const s = barStyle(payload);
  return (
    <Rectangle
      x={x}
      y={y}
      width={width}
      height={height}
      radius={[3, 3, 0, 0]}
      fill={s.fill}
      fillOpacity={s.fillOpacity}
      stroke={s.stroke}
      strokeWidth={s.strokeWidth}
    />
  );
}

/** hover / tap 提示：日期 + 练习次数 */
function TrendTooltip({ active, payload }: { active?: boolean; payload?: { payload: TrendPoint }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border-neo border-ink bg-surface px-3 py-2 shadow-card">
      <p className="text-fs-label font-medium text-on-surface">
        {d.fullDate}
        {d.isToday ? "（今天）" : ""}
      </p>
      <p className="text-fs-label text-on-surface-variant">
        练习 <span className="font-medium text-on-surface">{d.count}</span> 次
      </p>
    </div>
  );
}

/**
 * 近 7 天练习趋势柱状图（仅学习管理页按需加载 recharts；ssr:false 纯客户端，无hydration 顾虑）。
 * 7 根柱位齐全（0 值保留占位）；品牌绿系深浅=值越大越深；峰值最深档；今天描边标示；
 * 柱顶数值标签（0 不显示）；弱化网格；圆角柱顶；尊重 prefers-reduced-motion。
 */
export default function TrendBarChart({ trend }: { trend: { date: string; count: number }[] }) {
  // 客户端专属组件（ssr:false），渲染时 window 必然可用
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 日期换算放在客户端（与图表同属 ssr:false），避免 SSR/CSR 跨天导致的水合不一致
  const data = useMemo<TrendPoint[]>(() => {
    const now = new Date();
    const todayKey = `${now.getMonth() + 1}-${now.getDate()}`;
    const max = Math.max(...trend.map((t) => t.count), 0);
    return trend.map((t) => {
      const [m, d] = t.date.split("-").map(Number);
      return {
        label: t.date === todayKey ? "今天" : t.date,
        fullDate: `${m} 月 ${d} 日`,
        count: t.count,
        isToday: t.date === todayKey,
        isPeak: max > 0 && t.count === max,
      };
    });
  }, [trend]);

  return (
    <div className="h-[var(--size-chart-md)] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 24, right: 8, bottom: 0, left: -14 }} barCategoryGap="28%">
          <defs>
            <pattern id="trendDots" width={6} height={6} patternUnits="userSpaceOnUse">
              <rect width={6} height={6} fill="var(--color-surface-container-high)" />
              <circle cx={1.6} cy={1.6} r={1.1} fill="var(--neo-ink)" opacity={0.55} />
            </pattern>
          </defs>
          <CartesianGrid vertical={false} stroke={CHART.ink} strokeOpacity={0.14} />
          <XAxis
            dataKey="label"
            interval={0}
            tickLine={false}
            axisLine={{ stroke: CHART.ink, strokeWidth: 2 }}
            tick={{ fill: CHART.tick, fontSize: CHART.tickFontSize }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={34}
            domain={[0, (dataMax: number) => Math.max(dataMax, 1)]}
            tick={{ fill: CHART.tick, fontSize: CHART.tickFontSize }}
          />
          <Tooltip cursor={{ fill: "transparent" }} content={<TrendTooltip />} />
          <Bar dataKey="count" maxBarSize={44} isAnimationActive={!reduced} shape={<TrendBarShape />}>
            <LabelList
              dataKey="count"
              position="top"
              formatter={(v: number) => (v > 0 ? String(v) : "")}
              style={{ fill: CHART.valueLabel, fontSize: CHART.valueFontSize, fontWeight: CHART.valueFontWeight }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
