"use client";

/**
 * S6 方案评估（收口阶段）。
 * 学生对照五维（生态/安全/景观/运维/适用）自评方案并写明依据，中栏同时回显终版方案图（S5 种植图）；
 * 右栏为 AI 评估报告：核验自评 · 出分 · 优点 · 问题清单 · 改进建议。通过后定稿，S6 分即最终成绩。
 */
import { useEffect, useMemo, useState } from "react";
import { Award, CheckCircle2, CircleAlert, Image as ImageIcon, Lightbulb, ListChecks, Send, Sparkles, XCircle } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import type { StudentRun } from "@/lib/design";
import { PlantingDiagram } from "./PlantingDiagram";
import { assignPlantCodes, LAYER_LABEL } from "./plant-symbols";
import type { CanvasPlacement, CanvasZone } from "./PlantingCanvas";
import type { PlantPick } from "@/lib/plant-compliance";
import type { LayerKey } from "@/lib/types";

interface Props {
  user: SessionUser | null;
  task: Record<string, any>;
  nongyuan: Record<string, any>;
  run: StudentRun | null;
  plants: PlantPick[];
  onRun: (r: StudentRun) => void;
}

const DIMS: { key: string; label: string; hint: string }[] = [
  { key: "eco", label: "生态性", hint: "植物是否适地适树、群落结构是否合理、生态效益如何" },
  { key: "safety", label: "安全性", hint: "有无有毒/带刺/致敏植物，儿童与通行安全是否保障" },
  { key: "landscape", label: "景观性", hint: "空间层次、季相变化、色彩与观赏效果是否到位" },
  { key: "ops", label: "运维性", hint: "后期养护难度、成本与可持续性如何" },
  { key: "fit", label: "适用性", hint: "是否满足场地功能需求、呼应设计定位与人群使用" },
];

interface DimEval {
  key: string;
  label: string;
  score: number;
  basis: string;
}

export function StageEvaluation({ user, task, nongyuan, run, plants, onRun }: Props) {
  const taskId = task.id;
  const passScore = task.passScore ?? 60;
  const rubrics = task.rubricsByStage?.S6 ?? [];
  const plantById = useMemo(() => new Map(plants.map((p) => [p.id, p])), [plants]);

  const canvasCfg = nongyuan.canvas ?? {};
  const base = (canvasCfg.viewBox ?? [0, 0, 1024, 2048]) as [number, number, number, number];

  // 前序产出：S3 分区（几何）+ S5 种植（落位/建设计划）
  const s3zones: { id: string; name: string; color: string; points: [number, number][] }[] = useMemo(
    () => (run?.stage_payloads?.S3 as any)?.payload?.zones ?? [],
    [run]
  );
  const s5zones: { zoneId: string; name: string; color: string; plan: string; placements: { id: string; plantId: string; x: number; y: number }[] }[] = useMemo(
    () => (run?.stage_payloads?.S5 as any)?.payload?.zones ?? [],
    [run]
  );

  /* —— 终版方案图（只读，复用 S5 种植图）—— */
  const canvasZones: CanvasZone[] = s3zones.map((z) => ({ id: z.id, name: z.name, color: z.color, points: z.points }));
  const flatPlacements: CanvasPlacement[] = s5zones.flatMap((z) => (z.placements ?? []).map((p) => ({ ...p, zoneId: z.zoneId })));
  const allPlacedIds = useMemo(() => flatPlacements.map((p) => p.plantId), [flatPlacements]);
  const codes = useMemo(() => assignPlantCodes(allPlacedIds), [allPlacedIds.join("|")]);
  const layerOf = (plantId: string): LayerKey => plantById.get(plantId)?.layer ?? "tree";
  const nameOf = (plantId: string): string => plantById.get(plantId)?.name ?? plantId;

  /* —— 五维自评状态 —— */
  const storageKey = user ? `zjxj:design:${taskId}:S6:${user.id}` : "";
  const buildInitial = (): DimEval[] => {
    const saved = ((run?.stage_payloads?.S6 as any)?.payload?.selfEval ?? []) as DimEval[];
    const byKey = new Map(saved.map((d) => [d.key, d]));
    return DIMS.map((d) => ({ key: d.key, label: d.label, score: byKey.get(d.key)?.score ?? 0, basis: byKey.get(d.key)?.basis ?? "" }));
  };
  const [dims, setDims] = useState<DimEval[]>(buildInitial);
  const [report, setReport] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // 刷新恢复：草稿存 localStorage（服务端无 S6 记录时）
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw && !(run?.stage_payloads?.S6 as any)?.payload?.selfEval?.length) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved.dims)) {
          setDims((ds) =>
            ds.map((d) => {
              const m = saved.dims.find((x: any) => x.key === d.key);
              return m ? { ...d, score: m.score ?? d.score, basis: m.basis ?? d.basis } : d;
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
      localStorage.setItem(storageKey, JSON.stringify({ dims }));
    } catch {
      /* 存储满忽略 */
    }
  }, [ready, storageKey, dims]);

  // 刷新恢复：已有评阅
  useEffect(() => {
    const savedReview = run?.stage_reviews?.S6;
    const savedScore = run?.stage_scores?.S6;
    if (savedReview) {
      setReport({
        score: savedScore ?? 0,
        passed: (savedScore ?? 0) >= passScore,
        passScore,
        feedback: savedReview.feedback ?? "",
        cards: savedReview.cards ?? [],
        issues: savedReview.issues ?? [],
        keyPoints: savedReview.keyPoints ?? [],
        strengths: savedReview.strengths ?? [],
        suggestions: savedReview.suggestions ?? [],
        selfEvalCheck: savedReview.selfEvalCheck ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalSelfScore = dims.reduce((s, d) => s + (Number(d.score) || 0), 0);
  const dimsScored = dims.filter((d) => Number(d.score) > 0).length;
  const basisTotalLen = dims.reduce((s, d) => s + d.basis.trim().length, 0);
  const canSubmit = dimsScored === DIMS.length && basisTotalLen >= 50 && !submitting;

  function setDim(key: string, patch: Partial<DimEval>) {
    setDims((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError("");
    setReport(null);
    try {
      const res = await fetch("/api/design/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, stageKey: "S6", payload: { selfEval: dims }, meta: {} }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "提交失败");
      setReport(data);
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
  if (s5zones.length === 0 || flatPlacements.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-xl rounded-2xl bg-surface p-8 text-center shadow-card">
          <p className="text-fs-sub font-medium text-on-surface">还没有 S5 的终版种植方案</p>
          <p className="mt-2 text-fs-label text-on-surface-variant">请先完成「S5 平面布局与种植设计」，落位植物后再来做方案评估。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-3 lg:h-full lg:flex-row">
      {/* 中栏：① 五维自评 + ② 终版方案图 */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 lg:h-full lg:overflow-y-auto lg:pr-1">
        {/* ① 五维自评 */}
        <section className="rounded-2xl bg-lavender-container/60 p-5 shadow-card">
          <div className="flex flex-wrap items-center gap-2">
            <ListChecks className="h-4.5 w-4.5 text-lavender" />
            <p className="text-fs-sub font-medium text-on-surface">五维自评</p>
            <span className="text-fs-label text-on-surface-variant">每维 0–20 分，依据要落到具体分区与植物</span>
            <span className="ml-auto rounded-full bg-surface-container px-3 py-1 text-fs-label text-on-surface-variant">
              自评合计 <span className="font-medium text-on-surface">{totalSelfScore}</span>/100
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {dims.map((d) => {
              const meta = DIMS.find((x) => x.key === d.key);
              return (
                <div key={d.key} className="rounded-xl bg-surface-container/50 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-fs-body font-medium text-on-surface">{d.label}</p>
                    <span className="text-fs-label text-on-surface-variant/70">{meta?.hint}</span>
                    <div className="ml-auto flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={20}
                        step={1}
                        value={d.score}
                        onChange={(e) => setDim(d.key, { score: Number(e.target.value) })}
                        className="h-1.5 w-36 cursor-pointer appearance-none rounded-full bg-outline-variant/50 accent-[var(--color-lavender)]"
                        aria-label={`${d.label}自评分`}
                      />
                      <span className="w-12 rounded-lg bg-surface px-2 py-1 text-center text-fs-label font-medium text-on-surface">{d.score} 分</span>
                    </div>
                  </div>
                  <textarea
                    value={d.basis}
                    onChange={(e) => setDim(d.key, { basis: e.target.value })}
                    maxLength={300}
                    rows={2}
                    placeholder={`写清「${d.label}」的自评依据，落到具体分区与植物（例如：入口区种植无刺、低维护的……）`}
                    className="mt-2 w-full rounded-xl border-neo border-outline-variant/60 bg-surface px-4 py-3 text-fs-body text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-lavender/30"
                  />
                  <p className="mt-1 text-right text-fs-label text-on-surface-variant/60">{d.basis.length}/300</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ② 终版方案图 */}
        <section className="overflow-hidden rounded-2xl bg-primary-container/40 shadow-card">
          <div className="flex items-center gap-2 px-5 pt-4">
            <ImageIcon className="h-4.5 w-4.5 text-foreground" />
            <p className="text-fs-sub font-medium text-on-surface">终版方案图</p>
            <span className="text-fs-label text-on-surface-variant">来自 S5 种植设计（只读）</span>
          </div>
          <div className="p-3">
            <PlantingDiagram
              base={base}
              zones={canvasZones}
              placements={flatPlacements}
              nameOf={nameOf}
              layerOf={layerOf}
              codes={codes}
              title={task.title ?? "社区花园"}
            />
          </div>
        </section>
      </div>

      {/* 右栏：AI 评估报告 */}
      <aside className="flex flex-col gap-3 lg:w-[var(--size-panel-ratio)] lg:min-w-[var(--size-stage-side)] lg:overflow-y-auto">
        {report ? (
          <section className="rounded-2xl bg-blossom-container/50 p-5 shadow-card">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-blossom" />
              <p className="text-fs-card font-medium text-on-surface">AI 评估报告</p>
              <span
                className={`ml-auto rounded-full px-3 py-1 text-fs-label font-medium ${
                  report.passed ? "bg-primary text-on-primary" : "bg-error-container text-error"
                }`}
              >
                {report.score} 分 · {report.passed ? "通过·定稿" : "未通过"}
              </span>
            </div>
            <p className="mt-1 text-fs-label text-on-surface-variant">及格线 {report.passScore ?? passScore} 分 · 本次为最终成绩</p>

            {report.selfEvalCheck && (
              <div className="mt-3 rounded-xl bg-surface-container/60 p-3">
                <p className="flex items-center gap-1.5 text-fs-label font-medium text-on-surface">
                  <Sparkles className="h-3.5 w-3.5 text-lavender" /> 核验自评
                </p>
                <p className="mt-1 text-fs-label text-on-surface-variant">{report.selfEvalCheck}</p>
              </div>
            )}

            {report.feedback && (
              <div className="mt-3 rounded-xl bg-surface-container/60 p-3">
                <p className="text-fs-label font-medium text-on-surface">综合评语</p>
                <p className="mt-1 text-fs-label text-on-surface-variant">{report.feedback}</p>
              </div>
            )}

            {report.strengths?.length > 0 && (
              <div className="mt-3 rounded-xl bg-surface-container/60 p-3">
                <p className="flex items-center gap-1.5 text-fs-label font-medium text-on-surface">
                  <CheckCircle2 className="h-3.5 w-3.5 text-foreground" /> 优点
                </p>
                <ul className="mt-1 space-y-1">
                  {report.strengths.map((s: string, i: number) => (
                    <li key={i} className="text-fs-label text-on-surface-variant">· {s}</li>
                  ))}
                </ul>
              </div>
            )}

            {report.issues?.length > 0 && (
              <div className="mt-3 rounded-xl bg-surface-container/60 p-3">
                <p className="flex items-center gap-1.5 text-fs-label font-medium text-on-surface">
                  <CircleAlert className="h-3.5 w-3.5 text-on-surface" /> 问题清单
                </p>
                <ul className="mt-1 space-y-1">
                  {report.issues.map((s: string, i: number) => (
                    <li key={i} className="text-fs-label text-on-surface-variant">· {s}</li>
                  ))}
                </ul>
              </div>
            )}

            {(report.suggestions?.length > 0 || report.keyPoints?.length > 0) && (
              <div className="mt-3 rounded-xl bg-surface-container/60 p-3">
                <p className="flex items-center gap-1.5 text-fs-label font-medium text-on-surface">
                  <Lightbulb className="h-3.5 w-3.5 text-on-surface" /> 改进建议
                </p>
                <ul className="mt-1 space-y-1">
                  {(report.suggestions?.length ? report.suggestions : report.keyPoints).map((s: string, i: number) => (
                    <li key={i} className="text-fs-label text-on-surface-variant">· {s}</li>
                  ))}
                </ul>
              </div>
            )}

            {report.passed && (
              <div className="mt-4 rounded-xl bg-primary/10 p-3 text-center">
                <p className="text-fs-body font-medium text-foreground">方案已定稿，最终成绩 {report.score} 分</p>
                <p className="mt-0.5 text-fs-label text-on-surface-variant">成绩单已同步到你的学习管理与教师学情。</p>
              </div>
            )}

            {!report.passed && (
              <button
                type="button"
                onClick={() => setReport(null)}
                className="mt-4 w-full rounded-xl border-neo border-ink bg-primary px-4 py-2.5 text-fs-label font-medium text-on-primary transition hover:opacity-90"
              >
                根据建议修改自评后重新提交
              </button>
            )}
          </section>
        ) : (
          <section className="rounded-2xl bg-blossom-container/50 p-5 shadow-card">
            <p className="text-fs-card font-medium text-on-surface">AI 评估报告</p>
            <p className="mt-1 text-fs-label text-on-surface-variant">完成五维自评后提交，AI 将核验自评并评估方案综合质量，给出最终成绩。</p>
            <ul className="mt-3 space-y-2">
              {(rubrics?.length ? rubrics : []).map((r: any) => (
                <li key={r.key} className="rounded-lg bg-surface-container/60 px-3 py-2">
                  <p className="text-fs-label font-medium text-on-surface">{r.label} · 权重 {r.weight}</p>
                  <p className="mt-0.5 text-fs-label text-on-surface-variant">{r.desc}</p>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg bg-surface-container/60 px-3 py-2 text-fs-label text-on-surface-variant">
              已自评 <span className="font-medium text-on-surface">{dimsScored}/{DIMS.length}</span> 维，依据共 <span className="font-medium text-on-surface">{basisTotalLen}</span> 字。
            </div>
            {submitError && <p className="mt-3 text-fs-label text-error">{submitError}</p>}
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-fs-label font-medium text-on-primary transition hover:brightness-105 disabled:opacity-40"
            >
              <Send className="h-4 w-4" /> {submitting ? "评估中…" : "提交方案评估"}
            </button>
            {!canSubmit && !submitting && (
              <p className="mt-2 text-center text-fs-label text-on-surface-variant/60">
                {dimsScored < DIMS.length ? "请为每一维打分并写依据" : "依据再写具体一些（至少 50 字）"}
              </p>
            )}
          </section>
        )}
      </aside>
    </div>
  );
}
