"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartSpec } from "@/lib/analytics/metrics";

const C = {
  /** 刻度字号（与全站最小字号 13px 对齐；SVG 属性不支持 var() 故用数值） */
  tickFontSize: 13,
  bar: "var(--color-primary)",
  line: "var(--neo-ink)",
  dot: "var(--color-primary)",
  ink: "var(--neo-ink)",
  tick: "var(--color-on-surface-variant)",
};

function ChartTooltip({ active, payload, label, unit }: { active?: boolean; payload?: { value: number | string }[]; label?: string; unit?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border-neo border-ink bg-surface px-3 py-2 shadow-card">
      <p className="text-fs-label font-medium text-on-surface">{label}</p>
      <p className="text-fs-label text-on-surface-variant">
        <span className="font-medium text-on-surface">{payload[0].value}</span>
        {unit ? ` ${unit}` : ""}
      </p>
    </div>
  );
}

/** AI 学情分析结果图（客户端专属，ssr:false 动态加载，避免 recharts 水合问题） */
export default function AnalyticsChart({ spec }: { spec: ChartSpec }) {
  const data = spec.data;
  if (!data || data.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="mb-2 text-fs-label font-medium text-on-surface-variant">{spec.title}</p>
      <div className="h-[var(--size-chart-sm)] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {spec.type === "line" ? (
            <LineChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: -14 }}>
              <CartesianGrid vertical={false} stroke={C.ink} strokeOpacity={0.14} />
              <XAxis dataKey={spec.xKey} tick={{ fontSize: C.tickFontSize, fill: C.tick }} axisLine={{ stroke: C.ink, strokeWidth: 2 }} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: C.tickFontSize, fill: C.tick }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip unit={spec.unit} />} cursor={{ stroke: C.ink }} />
              <Line type="monotone" dataKey={spec.yKey} stroke={C.line} strokeWidth={2.5} dot={{ r: 3.5, fill: C.dot, stroke: C.ink, strokeWidth: 1.5 }} activeDot={{ r: 5, fill: C.dot, stroke: C.ink, strokeWidth: 1.5 }} />
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: -14 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke={C.ink} strokeOpacity={0.14} />
              <XAxis dataKey={spec.xKey} tick={{ fontSize: C.tickFontSize, fill: C.tick }} axisLine={{ stroke: C.ink, strokeWidth: 2 }} tickLine={false} interval={0} />
              <YAxis tick={{ fontSize: C.tickFontSize, fill: C.tick }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip unit={spec.unit} />} cursor={{ fill: "var(--color-surface-container)" }} />
              <Bar dataKey={spec.yKey} fill={C.bar} stroke={C.ink} strokeWidth={1.5} radius={[3, 3, 0, 0]} maxBarSize={40} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
