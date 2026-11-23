"use client";

/**
 * S5 平面布局与种植设计。
 * 中栏画布载入 S3 分区，右栏为 S4 植物清单（按分区分组，可拖拽落位）；
 * 画布下方按分区填写建设计划；「生成」产出程序化精确种植图 + 可选 AI 手绘示意；提交后 AI 评阅。
 */
import { useEffect, useMemo, useState } from "react";
import { GripVertical, ImageIcon, Sparkles, Trash2, X } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import type { StudentRun } from "@/lib/design";
import { ReviewCard } from "./ReviewCard";
import { PlantingCanvas, type CanvasPlacement, type CanvasZone } from "./PlantingCanvas";
import { PlantingDiagram } from "./PlantingDiagram";
import { assignPlantCodes, LAYER_COLOR, LAYER_LABEL, type Placement } from "./plant-symbols";
import { EMPTY_CONDITIONS, LIGHT_COND_LABEL, WATER_COND_LABEL, USAGE_COND_LABEL, type PlantPick, type ZoneConditions } from "@/lib/plant-compliance";
import type { LayerKey } from "@/lib/types";

interface Props {
  user: SessionUser | null;
  task: Record<string, any>;
  nongyuan: Record<string, any>;
  run: StudentRun | null;
  plants: PlantPick[];
  onRun: (r: StudentRun) => void;
  onUnlocked: () => void;
}

interface S5Zone {
  zoneId: string;
  name: string;
  color: string;
  points: [number, number][];
  conditions: ZoneConditions;
  plan: string;
  placements: Placement[];
}

const uid = () => Math.random().toString(36).slice(2, 10);

export function StageLayout({ user, task, nongyuan, run, plants, onRun, onUnlocked }: Props) {
  const taskId = task.id;
  const passScore = task.passScore ?? 60;
  const rubrics = task.rubricsByStage?.S5 ?? [];
  const plantById = useMemo(() => new Map(plants.map((p) => [p.id, p])), [plants]);

  const canvasCfg = nongyuan.canvas ?? {};
  const asset: string = canvasCfg.asset ?? "";
  const base = (canvasCfg.viewBox ?? [0, 0, 1024, 2048]) as [number, number, number, number];

  // 前序产出：S3 分区（几何）+ S4 清单（条件/植物）
  const s3zones: { id: string; name: string; color: string; points: [number, number][] }[] = useMemo(
    () => (run?.stage_payloads?.S3 as any)?.payload?.zones ?? [],
    [run]
  );
  const s4zones: { zoneId: string; name: string; color: string; conditions: ZoneConditions; plantIds: string[] }[] = useMemo(
    () => (run?.stage_payloads?.S4 as any)?.payload?.zones ?? [],
    [run]
  );

  const buildInitial = (): S5Zone[] => {
    const s4ById = new Map(s4zones.map((z) => [z.zoneId, z]));
    const saved = ((run?.stage_payloads?.S5 as any)?.payload?.zones ?? []) as S5Zone[];
    const savedById = new Map(saved.map((z) => [z.zoneId, z]));
    return s3zones.map((z) => {
      const s4 = s4ById.get(z.id);
      const prev = savedById.get(z.id);
      return {
        zoneId: z.id,
        name: z.name,
        color: z.color,
        points: z.points,
        conditions: prev?.conditions ?? s4?.conditions ?? { ...EMPTY_CONDITIONS },
        plan: prev?.plan ?? "",
        placements: prev?.placements ?? [],
      };
    });
  };

  const storageKey = user ? `zjxj:design:${taskId}:S5:${user.id}` : "";
  const [zones, setZones] = useState<S5Zone[]>(buildInitial);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const [diagramOpen, setDiagramOpen] = useState(false);
  const [aiUrl, setAiUrl] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [review, setReview] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // 刷新恢复：草稿存 localStorage（服务端无 S5 记录时）
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw && !(run?.stage_payloads?.S5 as any)?.payload?.zones?.length) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved.zones)) {
          setZones((zs) =>
            zs.map((z) => {
              const d = saved.zones.find((d: any) => d.zoneId === z.zoneId);
              return d ? { ...z, plan: d.plan ?? z.plan, placements: d.placements ?? z.placements } : z;
            })
          );
        }
      }
    } catch {
      /* 草稿损坏忽略 */
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ zones: zones.map((z) => ({ zoneId: z.zoneId, plan: z.plan, placements: z.placements })) }));
    } catch {
      /* 存储满忽略 */
    }
  }, [ready, storageKey, zones]);

  // 刷新恢复：已有评阅
  useEffect(() => {
    const savedReview = run?.stage_reviews?.S5;
    const savedScore = run?.stage_scores?.S5;
    if (savedReview) {
      setReview({
        score: savedScore ?? 0,
        passed: (savedScore ?? 0) >= passScore,
        passScore,
        feedback: savedReview.feedback ?? "",
        cards: savedReview.cards ?? [],
        issues: savedReview.issues ?? [],
        keyPoints: savedReview.keyPoints ?? [],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPlants = zones.reduce((s, z) => s + z.placements.length, 0);
  const allPlacedIds = useMemo(() => zones.flatMap((z) => z.placements.map((p) => p.plantId)), [zones]);
  const codes = useMemo(() => assignPlantCodes(allPlacedIds), [allPlacedIds.join("|")]);

  const layerOf = (plantId: string): LayerKey => plantById.get(plantId)?.layer ?? "tree";
  const nameOf = (plantId: string): string => plantById.get(plantId)?.name ?? plantId;
  const codeOf = (plantId: string): string => codes.get(plantId) ?? "";

  const canvasZones: CanvasZone[] = zones.map((z) => ({ id: z.zoneId, name: z.name, color: z.color, points: z.points }));
  const flatPlacements: CanvasPlacement[] = zones.flatMap((z) => z.placements.map((p) => ({ ...p, zoneId: z.zoneId })));
  const focusedZone = zones.find((z) => z.zoneId === selectedZoneId) ?? null;
  const hasGeom = canvasZones.some((z) => (z.points?.length ?? 0) >= 3);

  // 手绘上传模式（S3 无分区几何）：默认选中第一个分区，落位归入所选分区
  useEffect(() => {
    if (!hasGeom && !selectedZoneId && zones.length > 0) setSelectedZoneId(zones[0].zoneId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasGeom, zones.length]);

  /* —— 落位操作 —— */
  function addPlacement(plantId: string, pt: [number, number], zoneId: string | null) {
    if (!zoneId) return; // 必须落在分区内
    setZones((zs) => zs.map((z) => (z.zoneId === zoneId ? { ...z, placements: [...z.placements, { id: uid(), plantId, x: pt[0], y: pt[1] }] } : z)));
  }
  function movePlacement(id: string, pt: [number, number], zoneId: string | null) {
    setZones((zs) => {
      let moved: Placement | null = null;
      let origin: string | null = null;
      for (const z of zs) {
        const f = z.placements.find((p) => p.id === id);
        if (f) {
          moved = f;
          origin = z.zoneId;
          break;
        }
      }
      if (!moved) return zs;
      const dest = zoneId ?? origin;
      return zs.map((z) => {
        const rest = z.placements.filter((p) => p.id !== id);
        if (z.zoneId === dest) return { ...z, placements: [...rest, { ...(moved as Placement), x: pt[0], y: pt[1] }] };
        return { ...z, placements: rest };
      });
    });
  }
  function removePlacement(id: string) {
    setZones((zs) => zs.map((z) => ({ ...z, placements: z.placements.filter((p) => p.id !== id) })));
    setSelectedPlacementId(null);
  }
  function setPlan(zoneId: string, plan: string) {
    setZones((zs) => zs.map((z) => (z.zoneId === zoneId ? { ...z, plan } : z)));
  }

  const selectedPlacement = flatPlacements.find((p) => p.id === selectedPlacementId) ?? null;

  /* —— 生成种植设计图（弹层）—— */
  const designSummary = useMemo(
    () =>
      zones
        .filter((z) => z.placements.length > 0)
        .map((z) => {
          const names = [...new Set(z.placements.map((p) => nameOf(p.plantId)))].join("、");
          return `${z.name}种植${names}`;
        })
        .join("；"),
    [zones, nameOf]
  );

  async function generateAiSketch() {
    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetch("/api/design/render-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: designSummary || "社区花园植物造景" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "生成失败");
      setAiUrl(data.url);
    } catch (e: any) {
      setAiError(e?.message || "生成失败，请稍后重试");
    } finally {
      setAiLoading(false);
    }
  }

  /* —— 提交评阅 —— */
  async function submit() {
    if (totalPlants === 0) return;
    setSubmitting(true);
    setSubmitError("");
    setReview(null);
    try {
      const payload = {
        zones: zones.map((z) => ({ zoneId: z.zoneId, name: z.name, color: z.color, conditions: z.conditions, plan: z.plan, placements: z.placements })),
      };
      const res = await fetch("/api/design/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, stageKey: "S5", payload, meta: { totalPlants, plansWritten: zones.filter((z) => z.plan.trim().length >= 10).length } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "提交失败");
      setReview(data);
      if (data.run) onRun(data.run);
      try {
        localStorage.removeItem(storageKey);
      } catch {}
    } catch (e: any) {
      setSubmitError(e?.message || "提交失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  /* —— 前序缺失的守卫 —— */
  if (s3zones.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-xl rounded-2xl bg-surface p-8 text-center shadow-card">
          <p className="text-fs-sub font-medium text-on-surface">还没有 S3 的功能分区</p>
          <p className="mt-2 text-fs-label text-on-surface-variant">请先完成「S3 功能分区与空间骨架」，画布会自动载入你的分区。</p>
        </div>
      </div>
    );
  }
  const paletteEmpty = s4zones.every((z) => !z.plantIds?.length);
  if (s4zones.length === 0 || paletteEmpty) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-xl rounded-2xl bg-surface p-8 text-center shadow-card">
          <p className="text-fs-sub font-medium text-on-surface">还没有 S4 的植物清单</p>
          <p className="mt-2 text-fs-label text-on-surface-variant">请先完成「S4 植物筛选与合规审查」，选好核心植物后再来做平面布局。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-3 lg:h-full lg:flex-row">
      {/* 中栏：画布 + 建设计划 */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 lg:h-full lg:overflow-y-auto lg:pr-1">
        <section className="overflow-hidden rounded-2xl bg-primary-container/40 shadow-card" style={{ minHeight: 440 }}>
          <PlantingCanvas
            asset={asset}
            base={base}
            zones={canvasZones}
            placements={flatPlacements}
            layerOf={layerOf}
            codeOf={codeOf}
            selectedZoneId={selectedZoneId}
            onSelectZone={setSelectedZoneId}
            selectedPlacementId={selectedPlacementId}
            onSelectPlacement={setSelectedPlacementId}
            onDropPlant={addPlacement}
            onMovePlacement={movePlacement}
            fallbackZoneId={selectedZoneId}
          />
        </section>

        {/* 建设计划（画布下方，按分区联动） */}
        <section className="rounded-2xl bg-sprout-container/50 p-5 shadow-card">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-fs-sub font-medium text-on-surface">分区建设计划</p>
            <span className="text-fs-label text-on-surface-variant">{hasGeom ? "点画布中的分区或下方标签切换" : "手绘模式无分区边界，用下方标签切换分区"}</span>
            {selectedPlacement && (
              <button
                type="button"
                onClick={() => removePlacement(selectedPlacement.id)}
                className="ml-auto flex items-center gap-1 rounded-full bg-error-container/70 px-3 py-1 text-fs-label text-error transition hover:brightness-105"
              >
                <Trash2 className="h-3.5 w-3.5" /> 移除所选植物（{nameOf(selectedPlacement.plantId)}）
              </button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {zones.map((z) => (
              <button
                key={z.zoneId}
                type="button"
                onClick={() => setSelectedZoneId(z.zoneId)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-fs-label transition ${
                  selectedZoneId === z.zoneId ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:bg-surface-container/70"
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: z.color }} />
                {z.name}
                <span className="opacity-70">·{z.placements.length}株</span>
              </button>
            ))}
          </div>
          {focusedZone ? (
            <div className="mt-3">
              <p className="text-fs-label text-on-surface-variant">
                {focusedZone.name}（{LIGHT_COND_LABEL[focusedZone.conditions.light]} / {WATER_COND_LABEL[focusedZone.conditions.water]} / {USAGE_COND_LABEL[focusedZone.conditions.usage]}）的建设计划：
              </p>
              <textarea
                value={focusedZone.plan}
                onChange={(e) => setPlan(focusedZone.zoneId, e.target.value)}
                maxLength={400}
                rows={4}
                placeholder="写清这个区怎么种、设计意图与搭配考虑（例如：以乔木遮荫为主，下层配花境，兼顾儿童安全……）"
                className="mt-2 w-full rounded-xl border-neo border-outline-variant/60 bg-surface-container/40 px-4 py-3 text-fs-body text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-ink"
              />
              <p className="mt-1 text-right text-fs-label text-on-surface-variant/60">{focusedZone.plan.length}/400</p>
            </div>
          ) : (
            <p className="mt-3 text-fs-label text-on-surface-variant/60">尚未选择分区。点击画布或上方标签以编辑对应分区的建设计划。</p>
          )}
        </section>
      </div>

      {/* 右栏：S4 植物清单（可拖拽）+ 生成/评阅 */}
      <aside className="flex flex-col gap-3 lg:w-[var(--size-panel-ratio)] lg:min-w-[var(--size-stage-side)] lg:overflow-y-auto">
        <section className="rounded-2xl bg-water-container/50 p-4 shadow-card">
          <p className="text-fs-sub font-medium text-on-surface">植物清单（S4）</p>
          <p className="mt-0.5 text-fs-label text-on-surface-variant">按住植物拖到左侧画布的分区内落位</p>
          <div className="mt-3 space-y-3">
            {s4zones.map((z) => (
              <div key={z.zoneId}>
                <p className="flex items-center gap-1.5 text-fs-label font-medium text-on-surface-variant">
                  <span className="h-2 w-2 rounded-full" style={{ background: z.color }} />
                  {z.name}
                </p>
                <div className="mt-1.5 space-y-1">
                  {(z.plantIds ?? []).map((pid) => {
                    const p = plantById.get(pid);
                    if (!p) return null;
                    const placedCount = allPlacedIds.filter((x) => x === pid).length;
                    return (
                      <div
                        key={pid}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plant-id", pid);
                          e.dataTransfer.effectAllowed = "copy";
                        }}
                        className="flex cursor-grab items-center gap-2 rounded-lg bg-surface-container/50 px-2.5 py-1.5 transition hover:bg-surface-container active:cursor-grabbing"
                      >
                        <GripVertical className="h-3.5 w-3.5 shrink-0 text-on-surface-variant/50" />
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: LAYER_COLOR[p.layer]?.fill }} />
                        <span className="min-w-0 flex-1 truncate text-fs-label text-on-surface">{p.name}</span>
                        <span className="shrink-0 text-fs-label text-on-surface-variant/60">{LAYER_LABEL[p.layer]}</span>
                        {placedCount > 0 && <span className="shrink-0 rounded-full bg-primary/15 px-1.5 text-fs-label text-foreground">×{placedCount}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {review ? (
          <ReviewCard review={review} onRetry={() => setReview(null)} onNext={review.passed ? onUnlocked : undefined} nextLabel="进入 S6 方案评估" />
        ) : (
          <section className="rounded-2xl bg-blossom-container/50 p-5 shadow-card">
            <p className="text-fs-card font-medium text-on-surface">AI 评阅 · 平面布局与种植设计</p>
            <p className="mt-1 text-fs-label text-on-surface-variant">落位植物并写好各区建设计划后，可先生成种植设计图，再提交评阅。</p>
            <ul className="mt-3 space-y-2">
              {(rubrics?.length ? rubrics : []).map((r: any) => (
                <li key={r.key} className="rounded-lg bg-surface-container/60 px-3 py-2">
                  <p className="text-fs-label font-medium text-on-surface">{r.label} · 权重 {r.weight}</p>
                  <p className="mt-0.5 text-fs-label text-on-surface-variant">{r.desc}</p>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg bg-surface-container/60 px-3 py-2 text-fs-label text-on-surface-variant">
              已落位 <span className="font-medium text-on-surface">{totalPlants}</span> 株植物，覆盖 <span className="font-medium text-on-surface">{zones.filter((z) => z.placements.length > 0).length}/{zones.length}</span> 个分区。
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setDiagramOpen(true)}
                disabled={totalPlants === 0}
                className="flex items-center justify-center gap-1.5 rounded-xl border-neo border-ink bg-primary px-4 py-2.5 text-fs-label font-medium text-on-primary transition hover:opacity-90 disabled:opacity-40"
              >
                <ImageIcon className="h-4 w-4" /> 生成种植设计图
              </button>
              {submitError && <p className="text-fs-label text-error">{submitError}</p>}
              <button
                type="button"
                onClick={submit}
                disabled={submitting || totalPlants === 0}
                className="rounded-xl bg-primary px-4 py-2.5 text-fs-label font-medium text-on-primary transition hover:brightness-105 disabled:opacity-40"
              >
                {submitting ? "评阅中…" : "提交 AI 评阅"}
              </button>
            </div>
          </section>
        )}
      </aside>

      {/* 生成结果弹层：精确种植图 + AI 手绘示意 */}
      {diagramOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={() => setDiagramOpen(false)}>
          <div className="max-h-[var(--size-modal-vh-xl)] w-full max-w-5xl overflow-y-auto rounded-2xl bg-surface p-5 shadow-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <p className="text-fs-card font-medium text-on-surface">种植设计图</p>
              <button type="button" onClick={() => setDiagramOpen(false)} className="ml-auto rounded-full bg-surface-container p-1.5 text-on-surface-variant transition hover:bg-surface-container/70" aria-label="关闭">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3">
              <PlantingDiagram base={base} zones={canvasZones} placements={flatPlacements} nameOf={nameOf} layerOf={layerOf} codes={codes} title={task.title ?? "社区花园"} />
            </div>
            <div className="mt-4 rounded-2xl border-neo border-outline-variant/30 bg-surface-container/40 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-fs-sub font-medium text-on-surface">AI 手绘效果示意（可选）</p>
                <span className="rounded-full bg-primary px-2.5 py-0.5 text-fs-label text-on-primary">AI 效果示意，非精确种植图</span>
                {!aiUrl && (
                  <button
                    type="button"
                    onClick={generateAiSketch}
                    disabled={aiLoading}
                    className="ml-auto flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-fs-label font-medium text-on-primary transition hover:brightness-105 disabled:opacity-40"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> {aiLoading ? "生成中…" : "生成手绘示意图"}
                  </button>
                )}
              </div>
              {aiError && <p className="mt-2 text-fs-label text-error">{aiError}</p>}
              {aiUrl && (
                <div className="mt-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={aiUrl} alt="AI 手绘种植效果示意" className="w-full rounded-xl border-neo border-outline-variant/30" />
                  <p className="mt-1.5 text-fs-label text-on-surface-variant">此为 AI 依据你的方案生成的效果示意，仅供表达参考；精确落位以上方种植设计图为准。</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
