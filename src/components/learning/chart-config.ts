/**
 * 学习管理页图表配色与配置（集中定义，勿在组件内散落硬编码）。
 * 新野兽派：平涂实色 + 黑描边，不用渐变/透明度分档。
 * 主色柠檬黄=普通柱，天蓝=峰值柱，灰色网点=零值占位，黑=轴线与描边。
 */

export interface TrendPoint {
  /** X 轴短标签，如 "9-10"，今天为 "今天" */
  label: string;
  /** hover/tap 提示用的完整日期，如 "9 月 10 日" */
  fullDate: string;
  count: number;
  isToday: boolean;
  isPeak: boolean;
}

export const CHART = {
  /** 柱体主色：柠檬黄平涂 */
  barFill: "var(--color-primary)",
  /** 峰值柱：天蓝平涂 */
  peakFill: "var(--color-secondary)",
  /** 零值柱位：灰色网点纹理（SVG pattern，id 见 TrendBarChart） */
  zeroFill: "url(#trendDots)",
  /** 描边与轴线：墨黑 */
  ink: "var(--neo-ink)",
  /** 坐标刻度文字 */
  tick: "var(--color-on-surface-variant)",
  /** 柱顶数值标签 */
  valueLabel: "var(--color-on-surface)",
  /** 刻度字号（与 --text-fs-label 同步，SVG 属性不支持 var() 故用数值） */
  tickFontSize: 13,
  /** 柱顶数值字号 */
  valueFontSize: 13,
  /** 柱顶数值字重 */
  valueFontWeight: 500
} as const;

/** 单根柱子的填充与描边：平涂实色 + 黑描边；峰值蓝柱；今天加粗描边 */
export function barStyle(p: TrendPoint): { fill: string; fillOpacity: number; stroke?: string; strokeWidth?: number } {
  if (p.count <= 0) return { fill: CHART.zeroFill, fillOpacity: 1, stroke: CHART.ink, strokeWidth: 1.5 };
  if (p.isPeak) return { fill: CHART.peakFill, fillOpacity: 1, stroke: CHART.ink, strokeWidth: 1.5 };
  const base = { fill: CHART.barFill, fillOpacity: 1, stroke: CHART.ink, strokeWidth: 1.5 };
  return p.isToday ? { ...base, strokeWidth: 2.5 } : base;
}
