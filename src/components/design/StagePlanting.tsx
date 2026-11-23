"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Sprout, TriangleAlert, Info, CircleAlert, X } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import type { StudentRun } from "@/lib/design";
import { ReviewCard } from "./ReviewCard";
import { PlantPicker } from "./PlantPicker";
import {
  EMPTY_CONDITIONS,
  zoneHints,
  LIGHT_COND_LABEL,
  WATER_COND_LABEL,
  USAGE_COND_LABEL,
  type PlantPick,
  type ZoneConditions,
  type LightCond,
  type WaterCond,
  type UsageCond,
  type ComplianceHint,
} from "@/lib/plant-compliance";

interface Props {
  user: SessionUser | null;
  task: Record<string, any>;
  nongyuan: Record<string, any>;
  run: StudentRun | null;
  plants: PlantPick[];
  onRun: (r: StudentRun) => void;
  onUnlocked: () => void;
}

interface S4Zone {
  zoneId: string;
  name: string;
  color: string;
  conditions: ZoneConditions;
  plantIds: string[];
}

const LIGHT_OPTIONS: { v: LightCond; label: string }[] = [
  { v: "unknown", label: "光照·未标注" },
  { v: "sun", label: "强光为主" },
  { v: "semi", label: "半阴" },
  { v: "shade", label: "荫蔽" },
];
const WATER_OPTIONS: { v: WaterCond; label: string }[] = [
  { v: "unknown", label: "水分·未标注" },
  { v: "dry", label: "偏干" },
  { v: "moist", label: "湿润" },
  { v: "waterlog", label: "低洼易积水" },
];
const USAGE_OPTIONS: { v: UsageCond; label: string }[] = [
  { v: "unknown", label: "场景·未标注" },
  { v: "children", label: "儿童活动" },
  { v: "resting", label: "休憩停留" },
  { v: "ornamental", label: "观赏漫步" },
  { v: "production", label: "生产采摘" },
  { v: "eco", label: "生态保育" },
];

function CondSelect<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="rounded-lg border-neo border-outline-variant/60 bg-surface px-2 py-1 text-fs-label text-on-surface focus:outline-none focus:ring-2 focus:ring-ink"
    >
      {options.map((o) => (
        <option key={o.v} value={o.v}>{o.label}</option>
      ))}
    </select>
  );
}

function HintBar({ hint }: { hint: ComplianceHint }) {
  const styles =
    hint.level === "error"
      ? { wrap: "bg-error-container/70 text-error", Icon: CircleAlert }
      : hint.level === "warn"
        ? { wrap: "bg-primary text-on-primary", Icon: TriangleAlert }
        : { wrap: "bg-surface-container text-on-surface-variant", Icon: Info };
  const Icon = styles.Icon;
  return (
    <div className={`flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-fs-label ${styles.wrap}`}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{hint.text}</span>
    </div>
  );
}

export function StagePlanting({ user, task, nongyuan, run, plants, onRun, onUnlocked }: Props) {
  const taskId = task.id;
  const passScore = task.passScore ?? 60;
  const rubrics = task.rubricsByStage?.S4 ?? [];
  const plantById = useMemo(() => new Map(plants.map((p) => [p.id, p])), [plants]);

  // S3 分区（几何/名称来源）
  const s3zones: { id: string; name: string; color: string }[] = useMemo(
    () => (run?.stage_payloads?.S3 as any)?.payload?.zones ?? [],
    [run]
  );

  // S2 产出回显
  const s2 = (run?.stage_payloads?.S2 ?? {}) as any;
  const posOpts: { id: string; label: string }[] = nongyuan.positioningOptions ?? [];
  const priOpts: { id: string; label: string }[] = nongyuan.principleOptions ?? [];
  const primaryLabel = posOpts.find((o) => o.id === s2.primary)?.label ?? "";
  const principleLabels = (s2.principles ?? []).map((id: string) => priOpts.find((o) => o.id === id)?.label).filter(Boolean);

  // 初始化 S4 分区：以 S3 分区为骨架，合并已保存的 S4 条件/植物
  const buildInitial = (): S4Zone[] => {
    const saved = (run?.stage_payloads?.S4 as any)?.payload?.zones as S4Zone[] | undefined;
    const savedById = new Map((saved ?? []).map((z) => [z.zoneId, z]));
    return s3zones.map((z) => {
      const prev = savedById.get(z.id);
      return {
        zoneId: z.id,
        name: z.name,
        color: z.color,
        conditions: prev?.conditions ?? { ...EMPTY_CONDITIONS },
        plantIds: prev?.plantIds ?? [],
      };
    });
  };

  const storageKey = user ? `zjxj:design:${taskId}:S4:${user.id}` : "";
  const [zones, setZones] = useState<S4Zone[]>(buildInitial);
  const [pickerZone, setPickerZone] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const savedScore = run?.stage_scores?.S4 ?? null;
  const savedReview = run?.stage_reviews?.S4 as any;
  const [review, setReview] = useState<any>(
    savedReview
      ? {
          score: savedScore ?? 0,
          passed: (savedScore ?? 0) >= passScore,
          passScore,
          feedback: savedReview.feedback ?? "",
          cards: savedReview.cards ?? [],
          issues: savedReview.issues ?? [],
          keyPoints: savedReview.keyPoints ?? [],
        }
      : null
  );

  // 草稿恢复（仅当无服务端已存记录时读 localStorage）
  useEffect(() => {
    if (!storageKey || savedReview) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as S4Zone[];
      if (Array.isArray(draft) && draft.length) {
        const draftById = new Map(draft.map((z) => [z.zoneId, z]));
        setZones((cur) =>
          cur.map((z) => {
            const d = draftById.get(z.zoneId);
            return d ? { ...z, conditions: d.conditions ?? z.conditions, plantIds: d.plantIds ?? z.plantIds } : z;
          })
        );
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 草稿持久化
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!storageKey || savedReview) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try { localStorage.setItem(storageKey, JSON.stringify(zones)); } catch {}
    }, 400);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [zones, storageKey, savedReview]);

  const setCond = (zoneId: string, key: keyof ZoneConditions, v: string) => {
    setZones((zs) => zs.map((z) => (z.zoneId === zoneId ? { ...z, conditions: { ...z.conditions, [key]: v } } : z)));
  };
  const addPlant = (zoneId: string, p: PlantPick) => {
    setZones((zs) => zs.map((z) => (z.zoneId === zoneId && !z.plantIds.includes(p.id) ? { ...z, plantIds: [...z.plantIds, p.id] } : z)));
  };
  const removePlant = (zoneId: string, pid: string) => {
    setZones((zs) => zs.map((z) => (z.zoneId === zoneId ? { ...z, plantIds: z.plantIds.filter((x) => x !== pid) } : z)));
  };

  const totalPlants = zones.reduce((s, z) => s + z.plantIds.length, 0);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const payload = { zones };
      const res = await fetch("/api/design/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, stageKey: "S4", payload, meta: { totalPlants } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "提交失败");
      setReview(data);
      if (data.run) onRun(data.run);
      try { localStorage.removeItem(storageKey); } catch {}
    } catch (e: any) {
      setSubmitError(e?.message || "提交失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  const pickerTarget = zones.find((z) => z.zoneId === pickerZone);

  return (
    <div className="flex min-h-0 flex-col gap-3 lg:h-full lg:flex-row">
      {/* 中栏 */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 lg:h-full lg:overflow-y-auto lg:pr-1">
        {/* ② S2 原则 + S3 分区概览（只读） */}
        <section className="rounded-2xl bg-sprout-container/50 p-5 shadow-card">
          <p className="text-fs-label font-medium text-on-surface-variant">选植依据（只读）</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {primaryLabel && (
              <span className="rounded-full bg-primary-container px-3 py-1 text-fs-label font-medium text-on-primary-container">主定位 · {primaryLabel}</span>
            )}
            {principleLabels.map((l: string) => (
              <span key={l} className="rounded-full bg-surface-container px-3 py-1 text-fs-label text-on-surface-variant">{l}</span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5 border-t-neo border-outline-variant/40 pt-3">
            {s3zones.map((z) => (
              <span key={z.id} className="flex items-center gap-1.5 rounded-full bg-surface-container px-2.5 py-1 text-fs-label text-on-surface-variant">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: z.color }} />
                {z.name}
              </span>
            ))}
            {s3zones.length === 0 && <span className="text-fs-label text-on-surface-variant">未读取到 S3 分区，请先完成功能分区。</span>}
          </div>
        </section>

        {/* ③ 分区 → 植物清单 */}
        {zones.map((zone) => {
          const zonePlants = zone.plantIds.map((id) => plantById.get(id)).filter(Boolean) as PlantPick[];
          const hints = zoneHints({ zoneId: zone.zoneId, name: zone.name, conditions: zone.conditions, plants: zonePlants });
          return (
            <section key={zone.zoneId} className="rounded-2xl bg-primary-container/40 p-5 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: zone.color }} />
                  <h3 className="text-fs-card font-medium text-on-surface">{zone.name}</h3>
                  <span className="text-fs-label text-on-surface-variant">{zonePlants.length} 种</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPickerZone(zone.zoneId)}
                  className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-fs-label font-medium text-on-primary hover:bg-primary/90"
                >
                  <Plus className="h-3.5 w-3.5" />添加植物
                </button>
              </div>

              {/* 场地条件标注 */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-fs-label text-on-surface-variant">场地条件：</span>
                <CondSelect value={zone.conditions.light} options={LIGHT_OPTIONS} onChange={(v) => setCond(zone.zoneId, "light", v)} />
                <CondSelect value={zone.conditions.water} options={WATER_OPTIONS} onChange={(v) => setCond(zone.zoneId, "water", v)} />
                <CondSelect value={zone.conditions.usage} options={USAGE_OPTIONS} onChange={(v) => setCond(zone.zoneId, "usage", v)} />
              </div>

              {/* 已选植物缩略 */}
              {zonePlants.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {zonePlants.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 rounded-lg border-neo border-outline-variant/40 bg-surface-container/50 py-1 pl-1 pr-2">
                      {p.thumb ? (
                        <img src={p.thumb} alt={p.name} className="h-8 w-8 rounded-md object-cover" />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-container/60 text-fs-label text-on-primary-container">{p.name.slice(0, 1)}</span>
                      )}
                      <span className="text-fs-label text-on-surface">{p.name}</span>
                      {p.isWarning && <TriangleAlert className="h-3.5 w-3.5 text-error" />}
                      <button type="button" onClick={() => removePlant(zone.zoneId, p.id)} className="rounded-full p-0.5 text-on-surface-variant hover:bg-surface-container-high" aria-label={`移除${p.name}`}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 flex items-center gap-1.5 text-fs-label text-on-surface-variant">
                  <Sprout className="h-4 w-4" />还没选植物，点右上「添加植物」从图鉴中挑选。
                </p>
              )}

              {/* 合规提示（就地，不弹窗） */}
              {hints.length > 0 && (
                <div className="mt-3 space-y-1.5 border-t-neo border-outline-variant/40 pt-3">
                  {hints.map((h, i) => <HintBar key={i} hint={h} />)}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* 右栏 · AI 评阅 */}
      <aside className="lg:w-[var(--size-panel-ratio)] lg:min-w-[var(--size-stage-side)] lg:overflow-y-auto">
        {review ? (
          <ReviewCard review={review} onRetry={() => setReview(null)} onNext={review.passed ? onUnlocked : undefined} nextLabel="进入 S5 平面布局与种植设计" />
        ) : (
          <div className="rounded-2xl bg-blossom-container/50 p-5 shadow-card lg:sticky lg:top-4">
            <h3 className="text-fs-card font-medium text-on-surface">AI 评阅 · 植物筛选与合规审查</h3>
            <p className="mt-1 text-fs-label text-on-surface-variant">提交后结合你的设计定位、功能分区与案例背景评阅。</p>
            <ul className="mt-3 space-y-2">
              {(rubrics?.length ? rubrics : []).map((r: any) => (
                <li key={r.key} className="rounded-lg bg-surface-container/60 px-3 py-2">
                  <p className="text-fs-label font-medium text-on-surface">{r.label} · 权重 {r.weight}</p>
                  <p className="mt-0.5 text-fs-label text-on-surface-variant">{r.desc}</p>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg bg-surface-container/60 px-3 py-2 text-fs-label text-on-surface-variant">
              已选 <span className="font-medium text-on-surface">{totalPlants}</span> 种植物，覆盖 <span className="font-medium text-on-surface">{zones.filter((z) => z.plantIds.length > 0).length}/{zones.length}</span> 个分区。
            </div>
            {submitError && <p className="mt-2 text-fs-label text-error">{submitError}</p>}
            <button
              type="button"
              onClick={submit}
              disabled={submitting || zones.length === 0}
              className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-fs-body font-medium text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {submitting ? "正在评阅…" : "提交植物清单并评阅"}
            </button>
          </div>
        )}
      </aside>

      {/* ④ 植物选择器（本页弹层，不跳转） */}
      {pickerTarget && (
        <PlantPicker
          plants={plants}
          zoneName={pickerTarget.name}
          selectedIds={new Set(pickerTarget.plantIds)}
          onAdd={(p) => addPlant(pickerTarget.zoneId, p)}
          onClose={() => setPickerZone(null)}
        />
      )}
    </div>
  );
}
