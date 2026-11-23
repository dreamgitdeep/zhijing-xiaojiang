"use client";

/**
 * S5 画布：载入 S3 分区（只读多边形），承接右栏拖入的植物落位，支持落位拖动/跨区移动/聚焦。
 * 复用 ZoningCanvas 的坐标系（canvasGeom + getScreenCTM 逆旋转 + viewBox 缩放）。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw, RotateCw, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { canvasGeom } from "./ZoningCanvas";
import { PlantGlyph, pointInPolygon, type Placement } from "./plant-symbols";
import type { LayerKey } from "@/lib/types";

export interface CanvasZone {
  id: string;
  name: string;
  color: string;
  points: [number, number][];
}

export interface CanvasPlacement extends Placement {
  zoneId: string;
}

interface Props {
  asset: string;
  base: [number, number, number, number];
  zones: CanvasZone[];
  placements: CanvasPlacement[];
  layerOf: (plantId: string) => LayerKey;
  codeOf: (plantId: string) => string;
  selectedZoneId: string | null;
  onSelectZone: (id: string | null) => void;
  selectedPlacementId: string | null;
  onSelectPlacement: (id: string | null) => void;
  onDropPlant: (plantId: string, pt: [number, number], zoneId: string | null) => void;
  onMovePlacement: (id: string, pt: [number, number], zoneId: string | null) => void;
  // 无分区几何（S3 手绘上传模式）时，落位归入该分区
  fallbackZoneId?: string | null;
}

const GLYPH_BASE: Record<LayerKey, number> = { tree: 50, shrub: 38, herb: 28, vine: 36, bamboo: 32 };

export function PlantingCanvas({
  asset, base, zones, placements, layerOf, codeOf,
  selectedZoneId, onSelectZone, selectedPlacementId, onSelectPlacement,
  onDropPlant, onMovePlacement, fallbackZoneId = null,
}: Props) {
  const { S, C, imgX, imgY, bw, bh } = canvasGeom(base);
  const svgRef = useRef<SVGSVGElement>(null);
  const [angle, setAngle] = useState(0);
  const [view, setView] = useState({ x: 0, y: 0, w: S });
  const [moving, setMoving] = useState<{ id: string; pt: [number, number]; moved: boolean } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  const zoomAt = useCallback(
    (cx: number, cy: number, factor: number) => {
      setView((v) => {
        const nw = clamp(v.w * factor, S / 8, S);
        if (nw === v.w) return v;
        const k = nw / v.w;
        return { w: nw, x: clamp(cx - (cx - v.x) * k, 0, S - nw), y: clamp(cy - (cy - v.y) * k, 0, S - nw) };
      });
    },
    [S]
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
      zoomAt(p.x, p.y, e.deltaY > 0 ? 1.15 : 1 / 1.15);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const zoomPct = Math.round((S / view.w) * 100);
  const zk = view.w / S;

  function clientToContent(clientX: number, clientY: number): [number, number] | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    const rad = (-angle * Math.PI) / 180;
    const dx = p.x - C;
    const dy = p.y - C;
    return [C + dx * Math.cos(rad) - dy * Math.sin(rad), C + dx * Math.sin(rad) + dy * Math.cos(rad)];
  }

  // 只渲染/命中有几何的分区；手绘上传模式的分区无 points
  const geomZones = zones.filter((z) => (z.points?.length ?? 0) >= 3);
  const hasGeom = geomZones.length > 0;

  function zoneAt(pt: [number, number]): string | null {
    if (!hasGeom) return fallbackZoneId;
    for (const z of geomZones) if (pointInPolygon(pt, z.points)) return z.id;
    return null;
  }

  /* —— HTML5 拖拽：右栏植物 → 画布分区 —— */
  function onDragOverCanvas(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOver(true);
  }
  function onDropCanvas(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const plantId = e.dataTransfer.getData("text/plant-id");
    if (!plantId) return;
    const pt = clientToContent(e.clientX, e.clientY);
    if (!pt) return;
    onDropPlant(plantId, pt, zoneAt(pt));
  }

  /* —— 指针事件：拖动已有落位 —— */
  function startMove(e: React.PointerEvent, pl: CanvasPlacement) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setMoving({ id: pl.id, pt: [pl.x, pl.y], moved: false });
    onSelectPlacement(pl.id);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!moving) return;
    const pt = clientToContent(e.clientX, e.clientY);
    if (!pt) return;
    setMoving((m) => (m ? { ...m, pt, moved: true } : m));
  }
  function onPointerUp() {
    if (!moving) return;
    if (moving.moved) {
      onMovePlacement(moving.id, moving.pt, zoneAt(moving.pt));
    }
    setMoving(null);
  }

  const labelSize = S * 0.024 * zk;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b-neo border-outline-variant/25 px-3 py-2">
        <span className="text-fs-label text-on-surface-variant">
          {hasGeom ? "从右侧拖入植物到分区 · 拖动符号可微调或跨区移动" : "手绘模式无分区边界：先在下方标签选中目标分区，再拖入或点击画布落位"}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" title="放大" onClick={() => zoomAt(view.x + view.w / 2, view.y + view.w / 2, 1 / 1.25)} className="rounded-full bg-surface-container p-1.5 text-on-surface-variant transition hover:bg-surface-container/70">
            <ZoomIn className="h-4 w-4" />
          </button>
          <button type="button" title="缩小" onClick={() => zoomAt(view.x + view.w / 2, view.y + view.w / 2, 1.25)} className="rounded-full bg-surface-container p-1.5 text-on-surface-variant transition hover:bg-surface-container/70">
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="w-11 text-right text-fs-label tabular-nums text-on-surface-variant">{zoomPct}%</span>
          <span className="mx-0.5 h-4 w-px bg-outline-variant/40" />
          <button type="button" title="左转 15°" onClick={() => setAngle((a) => (a - 15 + 360) % 360)} className="rounded-full bg-surface-container p-1.5 text-on-surface-variant transition hover:bg-surface-container/70">
            <RotateCcw className="h-4 w-4" />
          </button>
          <input type="range" min={0} max={359} value={angle} onChange={(e) => setAngle(Number(e.target.value))} className="w-24 accent-[var(--color-primary)]" aria-label="旋转画布" />
          <button type="button" title="右转 15°" onClick={() => setAngle((a) => (a + 15) % 360)} className="rounded-full bg-surface-container p-1.5 text-on-surface-variant transition hover:bg-surface-container/70">
            <RotateCw className="h-4 w-4" />
          </button>
          <button type="button" title="复位（角度与缩放）" onClick={() => { setAngle(0); setView({ x: 0, y: 0, w: S }); }} className="rounded-full bg-surface-container p-1.5 text-on-surface-variant transition hover:bg-surface-container/70">
            <Undo2 className="h-4 w-4" />
          </button>
          <span className="w-10 text-right text-fs-label tabular-nums text-on-surface-variant">{angle}°</span>
        </div>
      </div>

      <div className={`relative min-h-0 flex-1 bg-surface-container/40 ${dragOver ? "ring-2 ring-inset ring-ink" : ""}`}>
        <svg
          ref={svgRef}
          viewBox={`${view.x} ${view.y} ${view.w} ${view.w}`}
          className="h-full w-full cursor-default touch-none"
          onDragOver={onDragOverCanvas}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDropCanvas}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClick={() => { if (!moving) { onSelectPlacement(null); onSelectZone(null); } }}
        >
          <g transform={`rotate(${angle} ${C} ${C})`}>
            <image href={asset} x={imgX} y={imgY} width={bw} height={bh} />
            {geomZones.map((z) => {
              const cx = z.points.reduce((s, p) => s + p[0], 0) / z.points.length;
              const cy = z.points.reduce((s, p) => s + p[1], 0) / z.points.length;
              const sel = z.id === selectedZoneId;
              return (
                <g
                  key={z.id}
                  className="cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); onSelectPlacement(null); onSelectZone(z.id); }}
                >
                  <polygon
                    points={z.points.map((p) => p.join(",")).join(" ")}
                    fill={z.color}
                    fillOpacity={sel ? 0.5 : 0.28}
                    stroke={z.color}
                    strokeWidth={(sel ? S * 0.004 : S * 0.002) * zk}
                    strokeLinejoin="round"
                  />
                  <text x={cx} y={cy} fontSize={labelSize} textAnchor="middle" fill="var(--color-on-surface)" stroke="var(--color-surface)" strokeWidth={labelSize / 6} paintOrder="stroke" className="select-none font-medium">
                    {z.name}
                  </text>
                </g>
              );
            })}
            {placements.map((pl) => {
              const isMoving = moving?.id === pl.id;
              const [px, py] = isMoving ? moving!.pt : [pl.x, pl.y];
              const layer = layerOf(pl.plantId);
              const r = GLYPH_BASE[layer] * zk;
              return (
                <g
                  key={pl.id}
                  className="cursor-grab"
                  onPointerDown={(e) => startMove(e, pl)}
                  onClick={(e) => e.stopPropagation()}
                >
                  <PlantGlyph x={px} y={py} r={r} layer={layer} code={codeOf(pl.plantId)} selected={selectedPlacementId === pl.id} dim={isMoving} />
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
