/**
 * S5 平面布局与种植设计 —— 植物符号与几何工具（画布与种植设计图共用）。
 * 符号按层次（乔/灌/草/藤/竹）取不同图形；同一植物用同一符号 + 固定代号，图例对应植物名。
 */
import type { LayerKey } from "@/lib/types";
import { LAYER_COLOR, LAYER_LABEL, SELECTED_STROKE, SYMBOL_CODE_FILL, SYMBOL_CODE_HALO } from "@/config/design-palette";

export { LAYER_COLOR, LAYER_LABEL };

export interface Placement {
  id: string;
  plantId: string;
  x: number;
  y: number;
}

/** 射线法：点是否在多边形内（用于落位归区） */
export function pointInPolygon(pt: [number, number], poly: [number, number][]): boolean {
  if (!poly || poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** 按首次出现顺序给不同植物分配代号（A、B、C…），同一植物恒定同一代号 */
export function assignPlantCodes(plantIdsInOrder: string[]): Map<string, string> {
  const codes = new Map<string, string>();
  let n = 0;
  for (const id of plantIdsInOrder) {
    if (codes.has(id)) continue;
    // A..Z，超出后用 A1、A2…
    const letter = String.fromCharCode(65 + (n % 26));
    const suffix = n >= 26 ? String(Math.floor(n / 26)) : "";
    codes.set(id, `${letter}${suffix}`);
    n += 1;
  }
  return codes;
}

interface GlyphProps {
  x: number;
  y: number;
  /** 符号半径（所在 SVG 坐标系的局部单位） */
  r: number;
  layer: LayerKey;
  code?: string;
  selected?: boolean;
  dim?: boolean;
}

/** 单株植物符号：按层次绘制图形 + 代号标签 */
export function PlantGlyph({ x, y, r, layer, code, selected, dim }: GlyphProps) {
  const c = LAYER_COLOR[layer] ?? LAYER_COLOR.tree;
  const opacity = dim ? 0.35 : 1;
  const strokeW = Math.max(r * 0.08, 0.6);
  const sel = selected ? SELECTED_STROKE : c.stroke;

  let shape: React.ReactNode;
  switch (layer) {
    case "tree":
      shape = (
        <>
          <circle cx={x} cy={y} r={r} fill={c.fill} fillOpacity={0.82} stroke={sel} strokeWidth={strokeW} />
          <circle cx={x} cy={y} r={r * 0.16} fill={sel} />
        </>
      );
      break;
    case "shrub":
      shape = (
        <circle cx={x} cy={y} r={r * 0.72} fill={c.fill} fillOpacity={0.8} stroke={sel} strokeWidth={strokeW} strokeDasharray={`${r * 0.28} ${r * 0.16}`} />
      );
      break;
    case "herb":
      shape = (
        <>
          <circle cx={x} cy={y} r={r * 0.4} fill={c.fill} fillOpacity={0.85} stroke={sel} strokeWidth={strokeW * 0.8} />
          <circle cx={x - r * 0.42} cy={y + r * 0.3} r={r * 0.24} fill={c.fill} fillOpacity={0.7} stroke={sel} strokeWidth={strokeW * 0.6} />
          <circle cx={x + r * 0.42} cy={y + r * 0.3} r={r * 0.24} fill={c.fill} fillOpacity={0.7} stroke={sel} strokeWidth={strokeW * 0.6} />
        </>
      );
      break;
    case "vine":
      shape = (
        <path
          d={`M ${x - r * 0.7} ${y + r * 0.4} q ${r * 0.35} ${-r * 0.9} ${r * 0.7} 0 q ${r * 0.35} ${r * 0.9} ${r * 0.7} 0`}
          fill="none"
          stroke={sel}
          strokeWidth={Math.max(strokeW * 1.4, 1)}
          strokeLinecap="round"
        />
      );
      break;
    case "bamboo":
      shape = (
        <>
          <line x1={x - r * 0.28} y1={y - r * 0.7} x2={x - r * 0.28} y2={y + r * 0.7} stroke={sel} strokeWidth={Math.max(strokeW * 1.3, 1)} strokeLinecap="round" />
          <line x1={x + r * 0.28} y1={y - r * 0.7} x2={x + r * 0.28} y2={y + r * 0.7} stroke={sel} strokeWidth={Math.max(strokeW * 1.3, 1)} strokeLinecap="round" />
        </>
      );
      break;
    default:
      shape = <circle cx={x} cy={y} r={r} fill={c.fill} stroke={sel} strokeWidth={strokeW} />;
  }

  return (
    <g opacity={opacity}>
      {shape}
      {code ? (
        <text
          x={x}
          y={y - r - r * 0.22}
          textAnchor="middle"
          fontSize={Math.max(r * 0.62, 3)}
          fontWeight={600}
          fill={SYMBOL_CODE_FILL}
          stroke={SYMBOL_CODE_HALO}
          strokeWidth={Math.max(r * 0.12, 0.4)}
          paintOrder="stroke"
        >
          {code}
        </text>
      ) : null}
    </g>
  );
}
