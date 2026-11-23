/**
 * 植景设计画布的内容配色与术语（SVG 插图专用，非 UI 皮肤色）。
 * UI 皮肤色一律走 globals.css 令牌；此处仅收录插图内容色，组件内不得再出现裸色值。
 */
import type { LayerKey } from "@/lib/types";

/** 种植设计图例：墨线手绘风 */
export const DIAGRAM_INK = "#111111";
export const DIAGRAM_PAPER = "#FBF3E4";
export const DIAGRAM_MUTED = "#4C4A44";
export const LEGEND_BG = "#FFFCF3";
export const LEGEND_CODE_BG = "#FFFFFF";

/** 各层次植物符号的配色（填充 / 描边） */
export const LAYER_COLOR: Record<LayerKey, { fill: string; stroke: string }> = {
  tree: { fill: "#3E8E5A", stroke: "#1F5B38" },
  shrub: { fill: "#6AB04C", stroke: "#3C7A22" },
  herb: { fill: "#A8D08D", stroke: "#5E8F43" },
  vine: { fill: "#4C9F70", stroke: "#2A6B48" },
  bamboo: { fill: "#7FB069", stroke: "#4A7A38" }
};

/** 层次中文名（画布图例共用） */
export const LAYER_LABEL: Record<LayerKey, string> = {
  tree: "乔木",
  shrub: "灌木",
  herb: "草本",
  vine: "藤本",
  bamboo: "竹类"
};

/** 画布中选中植物的描边高亮色 */
export const SELECTED_STROKE = "#E4572E";

/** 符号代号文字：深底白描边光晕（保证可读性） */
export const SYMBOL_CODE_FILL = "#1F2A24";
export const SYMBOL_CODE_HALO = "#FFFFFF";

/** S3 功能分区色板（8 色循环，按取用顺序） */
export const ZONING_PALETTE = [
  "#2F7A4F",
  "#C0563B",
  "#3B6FC0",
  "#B58A2E",
  "#7A4FC0",
  "#2E8FA3",
  "#C04F7A",
  "#5A6672"
];
