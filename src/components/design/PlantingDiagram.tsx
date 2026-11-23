"use client";

/**
 * S5 种植设计图 —— 程序化精确渲染（主方案）。
 * 分区色块 + 每株植物按落位坐标绘制符号 + 图例（代号↔植物名）+ 手绘纸感样式。
 * 植物落位与画布完全一致（同一套内容坐标），可核对；可导出 SVG / PNG。
 */
import { useMemo, useRef } from "react";
import { Download, Image as ImageIcon } from "lucide-react";
import { canvasGeom } from "./ZoningCanvas";
import { PlantGlyph, LAYER_LABEL, type Placement } from "./plant-symbols";
import type { CanvasZone, CanvasPlacement } from "./PlantingCanvas";
import type { LayerKey } from "@/lib/types";
import { DIAGRAM_INK, DIAGRAM_MUTED, DIAGRAM_PAPER, LEGEND_BG, LEGEND_CODE_BG } from "@/config/design-palette";

interface Props {
  base: [number, number, number, number];
  zones: CanvasZone[];
  placements: CanvasPlacement[];
  nameOf: (plantId: string) => string;
  layerOf: (plantId: string) => LayerKey;
  codes: Map<string, string>;
  title: string;
}

const DIAGRAM_GLYPH: Record<LayerKey, number> = { tree: 42, shrub: 30, herb: 20, vine: 28, bamboo: 24 };


export function PlantingDiagram({ base, zones, placements, nameOf, layerOf, codes, title }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { imgX, imgY, bw, bh } = canvasGeom(base);

  // 目标平面高度与缩放，右侧留图例栏
  const PH = 1200;
  const scale = PH / bh;
  const planW = bw * scale;
  const PAD = 60;
  const LEGEND_W = 360;
  const GAP = 48;
  const TOTAL_W = PAD * 2 + planW + GAP + LEGEND_W;
  const TOTAL_H = PAD * 2 + PH + 70; // 顶部留标题

  // 图例：落位中出现过的植物（按代号排序）
  const legend = useMemo(() => {
    const seen = new Map<string, { name: string; layer: LayerKey; code: string; count: number }>();
    for (const pl of placements) {
      const cur = seen.get(pl.plantId);
      if (cur) cur.count += 1;
      else seen.set(pl.plantId, { name: nameOf(pl.plantId), layer: layerOf(pl.plantId), code: codes.get(pl.plantId) ?? "?", count: 1 });
    }
    return [...seen.entries()].sort((a, b) => a[1].code.localeCompare(b[1].code));
  }, [placements, nameOf, layerOf, codes]);

  function serializeSvg(): string | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(TOTAL_W));
    clone.setAttribute("height", String(TOTAL_H));
    return new XMLSerializer().serializeToString(clone);
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function exportSvg() {
    const str = serializeSvg();
    if (!str) return;
    downloadBlob(new Blob([str], { type: "image/svg+xml;charset=utf-8" }), "种植设计图.svg");
  }

  function exportPng() {
    const str = serializeSvg();
    if (!str) return;
    const img = new Image();
    const svgUrl = URL.createObjectURL(new Blob([str], { type: "image/svg+xml;charset=utf-8" }));
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = TOTAL_W * 2;
      canvas.height = TOTAL_H * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = DIAGRAM_PAPER;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, "种植设计图.png");
        URL.revokeObjectURL(svgUrl);
      }, "image/png");
    };
    img.src = svgUrl;
  }

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-success/15 px-3 py-1 text-fs-label font-medium text-success">程序化精确种植图 · 落位与画布一致</span>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={exportSvg} className="flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-1.5 text-fs-label text-on-surface-variant transition hover:bg-surface-container/70">
            <Download className="h-3.5 w-3.5" /> 导出 SVG
          </button>
          <button type="button" onClick={exportPng} className="flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-1.5 text-fs-label text-on-surface-variant transition hover:bg-surface-container/70">
            <ImageIcon className="h-3.5 w-3.5" /> 导出 PNG
          </button>
        </div>
      </div>

      <div className="overflow-auto rounded-2xl border-neo border-outline-variant/30 bg-surface p-2 shadow-card">
        <svg ref={svgRef} viewBox={`0 0 ${TOTAL_W} ${TOTAL_H}`} className="h-auto w-full" style={{ minWidth: 560 }}>
          <defs>
            <filter id="zj-rough" x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="2" result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale="3" />
            </filter>
          </defs>

          {/* 纸张底 + 手绘边框 */}
          <rect x={0} y={0} width={TOTAL_W} height={TOTAL_H} fill={DIAGRAM_PAPER} />
          <rect x={14} y={14} width={TOTAL_W - 28} height={TOTAL_H - 28} fill="none" stroke={DIAGRAM_INK} strokeWidth={2} rx={18} opacity={0.5} />

          {/* 标题 */}
          <text x={PAD} y={PAD - 8} fontSize={30} fontWeight={700} fill={DIAGRAM_INK} fontFamily="inherit">
            {title} · 种植设计图
          </text>

          {/* 平面图（内容坐标 → 平面坐标）；无几何的手绘上传分区不画边界 */}
          <g transform={`translate(${PAD} ${PAD + 50}) scale(${scale}) translate(${-imgX} ${-imgY})`}>
            {zones.filter((z) => (z.points?.length ?? 0) >= 3).map((z) => {
              const cx = z.points.reduce((s, p) => s + p[0], 0) / z.points.length;
              const cy = z.points.reduce((s, p) => s + p[1], 0) / z.points.length;
              return (
                <g key={z.id}>
                  <polygon
                    points={z.points.map((p) => p.join(",")).join(" ")}
                    fill={z.color}
                    fillOpacity={0.3}
                    stroke={z.color}
                    strokeWidth={3}
                    strokeLinejoin="round"
                    filter="url(#zj-rough)"
                  />
                  <text x={cx} y={cy} fontSize={26} textAnchor="middle" fill={DIAGRAM_INK} stroke={DIAGRAM_PAPER} strokeWidth={5} paintOrder="stroke" fontWeight={600}>
                    {z.name}
                  </text>
                </g>
              );
            })}
            {placements.map((pl) => (
              <PlantGlyph key={pl.id} x={pl.x} y={pl.y} r={DIAGRAM_GLYPH[layerOf(pl.plantId)]} layer={layerOf(pl.plantId)} code={codes.get(pl.plantId)} />
            ))}
          </g>

          {/* 图例 */}
          <g transform={`translate(${PAD + planW + GAP} ${PAD + 50})`}>
            <text x={0} y={0} fontSize={22} fontWeight={700} fill={DIAGRAM_INK}>图例（代号 ↔ 植物）</text>
            <rect x={-12} y={16} width={LEGEND_W - 20} height={Math.max(legend.length * 46 + 20, 60)} fill={LEGEND_BG} stroke={DIAGRAM_INK} strokeWidth={1.5} rx={10} opacity={0.9} />
            {legend.length === 0 ? (
              <text x={4} y={48} fontSize={17} fill={DIAGRAM_MUTED}>（尚未落位植物）</text>
            ) : (
              legend.map(([, it], i) => (
                <g key={it.code} transform={`translate(8 ${40 + i * 46})`}>
                  <PlantGlyph x={16} y={0} r={15} layer={it.layer} code="" />
                  <text x={16} y={5} fontSize={13} textAnchor="middle" fontWeight={700} fill={DIAGRAM_INK} stroke={LEGEND_CODE_BG} strokeWidth={2} paintOrder="stroke">{it.code}</text>
                  <text x={42} y={-2} fontSize={17} fontWeight={600} fill={DIAGRAM_INK}>{it.name}</text>
                  <text x={42} y={16} fontSize={13} fill={DIAGRAM_MUTED}>{LAYER_LABEL[it.layer]} · ×{it.count}</text>
                </g>
              ))
            )}
          </g>
        </svg>
      </div>
    </div>
  );
}
