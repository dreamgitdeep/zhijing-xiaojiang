"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Expand, Hand, RotateCcw, RotateCw, Trash2, Undo2, Waypoints, ZoomIn, ZoomOut } from "lucide-react";
import { pointInPolygon } from "./plant-symbols";

/** 简笔铅笔图标：描边空心笔杆 + 明显尖头 + 笔尖分界线，一眼可辨，避免被看成十字架 */
function PencilIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {/* 笔杆 + 削尖木头：斜置铅笔轮廓，左下收尖成笔尖 */}
      <path d="M5 19l.9-3.6L16.5 4.8a2.2 2.2 0 0 1 3.1 3.1L9 18.5 5 19z" />
      {/* 笔尖分界线：区分木头与铅芯 */}
      <path d="M7.2 13.4l3.6 3.6" />
    </svg>
  );
}

export interface Zone {
  id: string;
  name: string;
  color: string;
  points: [number, number][];
  note?: string;
}

interface Props {
  asset: string;
  /** 底图像素尺寸 [x, y, w, h]，用于推导画布坐标系 */
  base: [number, number, number, number];
  zones: Zone[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDraftClose: (points: [number, number][]) => void;
  onUndo?: () => void;
  canUndo?: boolean;
  onDeleteSelected?: () => void;
  hasSelection?: boolean;
  disabled?: boolean;
}

type Tool = "pencil" | "polygon" | "pan";

const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** 由底图尺寸推导画布坐标系（正方形，容纳 360° 旋转） */
export function canvasGeom(base: [number, number, number, number]) {
  const [, , bw, bh] = base;
  const S = Math.ceil(Math.hypot(bw, bh)) + 20;
  return { S, C: S / 2, imgX: (S - bw) / 2, imgY: (S - bh) / 2, bw, bh };
}

/** Ramer–Douglas–Peucker 折线简化 */
function rdp(pts: [number, number][], eps: number): [number, number][] {
  if (pts.length <= 2) return pts;
  const [first, last] = [pts[0], pts[pts.length - 1]];
  let maxD = 0;
  let idx = 0;
  const [x1, y1] = first;
  const [x2, y2] = last;
  const len = Math.hypot(x2 - x1, y2 - y1) || 1e-9;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((y2 - y1) * pts[i][0] - (x2 - x1) * pts[i][1] + x2 * y1 - y2 * x1) / len;
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD > eps) {
    const left = rdp(pts.slice(0, idx + 1), eps);
    const right = rdp(pts.slice(idx), eps);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

export function ZoningCanvas({ asset, base, zones, selectedId, onSelect, onDraftClose, onUndo, canUndo, onDeleteSelected, hasSelection, disabled }: Props) {
  const { S, C, imgX, imgY, bw, bh } = canvasGeom(base);

  const svgRef = useRef<SVGSVGElement>(null);
  const [angle, setAngle] = useState(0);
  const [tool, setTool] = useState<Tool>("pencil");
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [draft, setDraft] = useState<[number, number][]>([]);
  const [cursor, setCursor] = useState<[number, number] | null>(null);
  const [stroke, setStroke] = useState<[number, number][]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [panning, setPanning] = useState(false);
  // 缩放：用 viewBox 窗口表示，放大=窗口变小。view.w ∈ [S/8, S]
  const [view, setView] = useState({ x: 0, y: 0, w: S });

  const closeThreshold = S * 0.02;
  const drawing = draft.length > 0;
  const activePan = spaceHeld || tool === "pan";

  // 手势会话（单指/鼠标）：按下时的视图与逆变换矩阵，平移计算无漂移
  const sessionRef = useRef<{ pointerId: number; startX: number; startY: number; moved: boolean; view0: { x: number; y: number; w: number }; inv0: DOMMatrix } | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; mid: { x: number; y: number } } | null>(null);
  const strokeRef = useRef<[number, number][] | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  const flash = useCallback((msg: string) => {
    setHint(msg);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(null), 2600);
  }, []);

  // 围绕 (cx, cy) 缩放；factor<1 放大。保持该点在屏幕上不动
  const zoomAt = useCallback(
    (cx: number, cy: number, factor: number) => {
      setView((v) => {
        const nw = clamp(v.w * factor, S / 8, S);
        if (nw === v.w) return v;
        const k = nw / v.w;
        return {
          w: nw,
          x: clamp(cx - (cx - v.x) * k, 0, S - nw),
          y: clamp(cy - (cy - v.y) * k, 0, S - nw),
        };
      });
    },
    [S]
  );

  // 滚轮缩放（围绕鼠标位置）
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

  // 空格临时抓手
  useEffect(() => {
    const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName);
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isTyping(e.target)) return;
      e.preventDefault();
      setSpaceHeld(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      setSpaceHeld(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const zoomPct = Math.round((S / view.w) * 100);
  const zk = view.w / S; // 视觉尺寸补偿系数（放大时 <1）

  function clientToSquare(clientX: number, clientY: number): [number, number] | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return [p.x, p.y];
  }

  // 屏幕(正方形 viewBox)坐标 → 逆旋转回内容坐标
  function toContent(pt: [number, number]): [number, number] {
    const rad = (-angle * Math.PI) / 180;
    const dx = pt[0] - C;
    const dy = pt[1] - C;
    return [C + dx * Math.cos(rad) - dy * Math.sin(rad), C + dx * Math.sin(rad) + dy * Math.cos(rad)];
  }

  function clientToContent(clientX: number, clientY: number): [number, number] | null {
    const sq = clientToSquare(clientX, clientY);
    return sq ? toContent(sq) : null;
  }

  function zoneAt(pt: [number, number]): string | null {
    for (let i = zones.length - 1; i >= 0; i--) {
      if (pointInPolygon(pt, zones[i].points)) return zones[i].id;
    }
    return null;
  }

  /* —— 铅笔笔迹收尾：简化 + 闭合 —— */
  function finalizeStroke(raw: [number, number][]) {
    setStroke([]);
    if (raw.length < 3) return;
    const autoClosed = dist(raw[0], raw[raw.length - 1]) < closeThreshold;
    let pts = autoClosed ? raw.slice(0, -1) : raw;
    let eps = S * 0.0025;
    pts = rdp(pts, eps);
    while (pts.length > 100) {
      eps *= 1.6;
      pts = rdp(pts, eps);
    }
    if (pts.length < 3) {
      flash("笔迹太短，请画出一个围合区域");
      return;
    }
    if (!autoClosed) flash("起笔与收笔未相接，已用直线闭合成区");
    onDraftClose(pts);
  }

  /* —— Pointer Events 手势层 —— */
  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (disabled) return;
    const svg = svgRef.current;
    if (!svg) return;
    svg.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // 双指 → 捏合缩放 + 平移
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      pinchRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      strokeRef.current = null;
      setStroke([]);
      sessionRef.current = null;
      return;
    }

    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    sessionRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false, view0: { ...view }, inv0: ctm.inverse() };

    if (tool === "pencil" && !activePan) {
      const pt = clientToContent(e.clientX, e.clientY);
      if (pt) {
        strokeRef.current = [pt];
        setStroke([pt]);
      }
    }
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || !pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // 捏合：缩放（围绕双指中点）+ 平移（中点位移）
    if (pinchRef.current && pointersRef.current.size >= 2) {
      const [a, b] = [...pointersRef.current.values()];
      const nd = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const nm = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const ctm = svg.getScreenCTM();
      if (ctm) {
        const inv = ctm.inverse();
        const midSq = new DOMPoint(nm.x, nm.y).matrixTransform(inv);
        zoomAt(midSq.x, midSq.y, pinchRef.current.dist / nd);
        const m0 = new DOMPoint(pinchRef.current.mid.x, pinchRef.current.mid.y).matrixTransform(inv);
        const m1 = new DOMPoint(nm.x, nm.y).matrixTransform(inv);
        setView((v) => ({ ...v, x: clamp(v.x - (m1.x - m0.x), 0, S - v.w), y: clamp(v.y - (m1.y - m0.y), 0, S - v.w) }));
      }
      pinchRef.current = { dist: nd, mid: nm };
      return;
    }

    const s = sessionRef.current;
    if (!s || s.pointerId !== e.pointerId) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (!s.moved && Math.hypot(dx, dy) > 4) s.moved = true;

    // 铅笔：采样笔迹
    if (strokeRef.current) {
      const pt = clientToContent(e.clientX, e.clientY);
      if (pt) {
        const arr = strokeRef.current;
        if (dist(arr[arr.length - 1], pt) >= S * 0.004) {
          arr.push(pt);
          setStroke([...arr]);
        }
      }
      return;
    }

    // 平移：拖动工具 / 空格 / 落点模式按住拖动
    if (activePan || (tool === "polygon" && s.moved)) {
      const p0 = new DOMPoint(s.startX, s.startY).matrixTransform(s.inv0);
      const p1 = new DOMPoint(e.clientX, e.clientY).matrixTransform(s.inv0);
      setPanning(true);
      setView({
        w: s.view0.w,
        x: clamp(s.view0.x - (p1.x - p0.x), 0, S - s.view0.w),
        y: clamp(s.view0.y - (p1.y - p0.y), 0, S - s.view0.w),
      });
      return;
    }

    // 落点模式：顶点预览跟随
    if (tool === "polygon" && drawing) {
      const pt = clientToContent(e.clientX, e.clientY);
      if (pt) setCursor(pt);
    }
  }

  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    setPanning(false);

    if (strokeRef.current) {
      const raw = strokeRef.current;
      strokeRef.current = null;
      if (pointersRef.current.size === 0) {
        if (raw.length < 3) {
          // 轻点（未拖拽）：选中/取消点中的分区，而不是报"笔迹太短"
          setStroke([]);
          onSelect(zoneAt(raw[0]));
        } else {
          finalizeStroke(raw);
        }
      } else setStroke([]);
      return;
    }

    const s = sessionRef.current;
    if (!s || s.pointerId !== e.pointerId) return;
    sessionRef.current = null;
    if (disabled || s.moved) return;

    // 未位移 = 点击
    const pt = clientToContent(e.clientX, e.clientY);
    if (!pt) return;
    if (tool === "polygon" && !activePan) {
      if (draft.length >= 3 && dist(pt, draft[0]) < closeThreshold) {
        onDraftClose(draft);
        setDraft([]);
        setCursor(null);
        return;
      }
      setDraft((d) => [...d, pt]);
      return;
    }
    onSelect(zoneAt(pt));
  }

  const cancelDraw = () => {
    setDraft([]);
    setCursor(null);
  };
  const closeDraft = () => {
    if (draft.length >= 3) onDraftClose(draft);
    setDraft([]);
    setCursor(null);
  };

  const labelSize = S * 0.024 * zk;
  const cursorCls = activePan ? (panning ? "cursor-grabbing" : "cursor-grab") : "cursor-crosshair";

  const toolBtn = (t: Tool, icon: React.ReactNode, label: string) => (
    <button
      type="button"
      title={label}
      disabled={disabled}
      onClick={() => {
        setTool(t);
        if (t !== "polygon") cancelDraw();
      }}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-fs-label font-medium transition disabled:opacity-40 ${
        tool === t ? "border-neo bg-primary text-on-primary shadow-2xs" : "text-on-surface-variant hover:bg-surface-container"
      }`}
    >
      {icon} {label}
    </button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 工具条：绘制工具 + 缩放旋转 */}
      <div className="flex flex-wrap items-center gap-2 border-b-neo border-outline-variant/25 px-3 py-2">
        <div className="flex items-center gap-1">
          {toolBtn("pencil", <PencilIcon className="h-[18px] w-[18px]" />, "铅笔")}
          {toolBtn("polygon", <Waypoints className="h-3.5 w-3.5" />, "落点")}
          {toolBtn("pan", <Hand className="h-3.5 w-3.5" />, "拖动")}
        </div>
        {tool === "pencil" && !drawing && (
          <span className="text-fs-label text-on-surface-variant">拖拽画曲线围合成区 · 轻点图中分区可选中</span>
        )}
        {tool === "polygon" && (
          <span className="flex items-center gap-2">
            {drawing && (
              <>
                <button
                  type="button"
                  onClick={closeDraft}
                  disabled={draft.length < 3}
                  className="rounded-full bg-success px-3 py-1.5 text-fs-label font-medium text-on-surface transition hover:brightness-105 disabled:opacity-40"
                >
                  闭合（{draft.length} 点）
                </button>
                <button type="button" onClick={cancelDraw} className="rounded-full bg-surface-container px-3 py-1.5 text-fs-label text-on-surface-variant transition hover:bg-surface-container/70">
                  取消
                </button>
              </>
            )}
            <span className="text-fs-label text-on-surface-variant">{drawing ? "点击落点 · 点首顶点或「闭合」成区" : "点击落点围合分区"}</span>
          </span>
        )}
        {tool === "pan" && <span className="text-fs-label text-on-surface-variant">拖拽平移画布 · 点击分区可选中</span>}
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" title="撤回" onClick={onUndo} disabled={!canUndo || disabled} className="rounded-full bg-surface-container p-1.5 text-on-surface-variant transition hover:bg-surface-container/70 disabled:opacity-40">
            <Undo2 className="h-4 w-4" />
          </button>
          <button type="button" title="删除选中分区" onClick={onDeleteSelected} disabled={!hasSelection || disabled} className="rounded-full bg-surface-container p-1.5 text-error transition hover:bg-error/10 disabled:opacity-40">
            <Trash2 className="h-4 w-4" />
          </button>
          <span className="mx-0.5 h-4 w-px bg-outline-variant/40" />
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
          <input
            type="range"
            min={0}
            max={359}
            value={angle}
            onChange={(e) => setAngle(Number(e.target.value))}
            className="w-24 accent-[var(--color-primary)]"
            aria-label="旋转画布"
          />
          <button type="button" title="右转 15°" onClick={() => setAngle((a) => (a + 15) % 360)} className="rounded-full bg-surface-container p-1.5 text-on-surface-variant transition hover:bg-surface-container/70">
            <RotateCw className="h-4 w-4" />
          </button>
          <button type="button" title="复位（角度与缩放）" onClick={() => { setAngle(0); setView({ x: 0, y: 0, w: S }); }} className="rounded-full bg-surface-container p-1.5 text-on-surface-variant transition hover:bg-surface-container/70">
            <Expand className="h-4 w-4" />
          </button>
          <span className="w-10 text-right text-fs-label tabular-nums text-on-surface-variant">{angle}°</span>
        </div>
      </div>

      {/* 画布 */}
      <div className="relative min-h-0 flex-1 bg-surface-container/40">
        <svg
          ref={svgRef}
          viewBox={`${view.x} ${view.y} ${view.w} ${view.w}`}
          className={`h-full w-full touch-none ${cursorCls}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => setCursor(null)}
        >
          <g transform={`rotate(${angle} ${C} ${C})`}>
            <image href={asset} x={imgX} y={imgY} width={bw} height={bh} />
            {zones.map((z) => {
              const cx = z.points.reduce((s, p) => s + p[0], 0) / z.points.length;
              const cy = z.points.reduce((s, p) => s + p[1], 0) / z.points.length;
              const sel = z.id === selectedId;
              return (
                <g key={z.id}>
                  <polygon
                    points={z.points.map((p) => p.join(",")).join(" ")}
                    fill={z.color}
                    fillOpacity={sel ? 0.5 : 0.32}
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
            {/* 落点草稿 */}
            {drawing && (
              <g>
                <polyline
                  points={[...draft, ...(cursor ? [cursor] : [])].map((p) => p.join(",")).join(" ")}
                  fill="none"
                  stroke="var(--color-primary)"
                  strokeWidth={S * 0.002 * zk}
                  strokeDasharray={`${S * 0.006 * zk} ${S * 0.004 * zk}`}
                />
                {draft.map((p, i) => (
                  <circle key={i} cx={p[0]} cy={p[1]} r={(i === 0 ? S * 0.008 : S * 0.005) * zk} fill={i === 0 ? "var(--color-success)" : "var(--color-primary)"} stroke="var(--color-surface)" strokeWidth={S * 0.0015 * zk} />
                ))}
              </g>
            )}
            {/* 铅笔笔迹 */}
            {stroke.length > 0 && (
              <polyline
                points={stroke.map((p) => p.join(",")).join(" ")}
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth={S * 0.003 * zk}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </g>
        </svg>
        {hint && (
          <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-lg border-neo bg-surface px-3 py-1.5 text-fs-label text-on-surface shadow-card">
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}
