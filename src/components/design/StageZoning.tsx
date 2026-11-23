"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Palette, Send, Trash2, Undo2, Upload } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import type { StudentRun } from "@/lib/design";
import { ReviewCard } from "./ReviewCard";
import { ZoningCanvas, canvasGeom, type Zone } from "./ZoningCanvas";
import { ZONING_PALETTE } from "@/config/design-palette";

interface Props {
  user: SessionUser | null;
  task: Record<string, any>;
  nongyuan: Record<string, any>;
  run: StudentRun | null;
  onRun: (r: StudentRun) => void;
  onUnlocked: () => void;
}

const PALETTE = ZONING_PALETTE;

type Mode = "canvas" | "upload";

function polyArea(pts: [number, number][]) {
  if (!pts || pts.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

/** 取下一个未被占用的「分区 N」名（避免删除后重名） */
function nextZoneName(zs: Zone[]): string {
  const used = new Set<number>();
  for (const z of zs) {
    const m = /^分区\s*(\d+)$/.exec(z.name);
    if (m) used.add(Number(m[1]));
  }
  let n = 1;
  while (used.has(n)) n += 1;
  return `分区 ${n}`;
}

export function StageZoning({ user, task, nongyuan, run, onRun, onUnlocked }: Props) {
  const canvas = nongyuan.canvas ?? {};
  const asset: string = canvas.asset ?? "";
  const base = (canvas.viewBox ?? [0, 0, 1024, 2048]) as [number, number, number, number];
  const geom = useMemo(() => canvasGeom(base), [base.join(",")]);
  const siteArea = geom.bw * geom.bh;
  const passScore = nongyuan.scoring?.passScore ?? task.passScore ?? 60;
  const rubrics: any[] = task.rubricsByStage?.S3 ?? [];

  const s3rec = run?.stage_payloads?.S3 as any;
  const savedPayload = (s3rec?.payload ?? s3rec ?? {}) as { zones?: Zone[]; mode?: Mode; imageUrl?: string };
  const savedReview = run?.stage_reviews?.S3;
  const savedScore = run?.stage_scores?.S3;
  const storageKey = `zjxj:design:${task.id}:S3:${user?.id ?? "anon"}`;

  const [mode, setMode] = useState<Mode>(savedPayload.mode === "upload" ? "upload" : "canvas");
  const [zones, setZones] = useState<Zone[]>(savedPayload.zones ?? []);
  const [imageUrl, setImageUrl] = useState<string>(savedPayload.imageUrl ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<Zone[][]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [review, setReview] = useState<any>(
    savedReview
      ? { score: savedScore ?? 0, passed: (savedScore ?? 0) >= passScore, passScore, feedback: savedReview.feedback ?? "", cards: savedReview.cards ?? [] }
      : null
  );
  const [submitting, setSubmitting] = useState(false);

  // S2 产出回显
  const posOptions: any[] = nongyuan.positioningOptions ?? [];
  const prinOptions: any[] = nongyuan.principleOptions ?? [];
  const s2rec = run?.stage_payloads?.S2 as any;
  const s2 = s2rec?.payload ?? s2rec ?? {};
  const posLabel = posOptions.find((o) => o.id === s2.primary)?.label ?? s2.primary ?? "（未完成 S2）";
  const prinLabels: string[] = (s2.principles ?? []).map((id: string) => prinOptions.find((o) => o.id === id)?.label ?? id);

  // 刷新恢复：草稿存 localStorage
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw);
        if (zones.length === 0 && Array.isArray(saved.zones)) setZones(saved.zones);
        if (!imageUrl && typeof saved.imageUrl === "string" && saved.imageUrl) {
          setImageUrl(saved.imageUrl);
          if (saved.mode === "upload") setMode("upload");
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
      localStorage.setItem(storageKey, JSON.stringify({ zones, mode, imageUrl }));
    } catch {
      /* 存储满忽略 */
    }
  }, [ready, storageKey, zones, mode, imageUrl]);

  const selected = zones.find((z) => z.id === selectedId) ?? null;

  /* 分区结构变更历史（新增/删除），用于"撤回" */
  function commit(next: Zone[]) {
    setHistory((h) => [...h, zones].slice(-50));
    setZones(next);
  }
  function undo() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setZones(prev);
    setSelectedId((id) => (id && prev.some((z) => z.id === id) ? id : null));
  }

  function onDraftClose(points: [number, number][]) {
    const z: Zone = { id: `z${Date.now().toString(36)}`, name: nextZoneName(zones), color: PALETTE[zones.length % PALETTE.length], points };
    commit([...zones, z]);
    setSelectedId(z.id);
  }

  function addZoneManual() {
    const z: Zone = { id: `z${Date.now().toString(36)}`, name: nextZoneName(zones), color: PALETTE[zones.length % PALETTE.length], points: [] };
    commit([...zones, z]);
    setSelectedId(z.id);
  }

  function patchSelected(patch: Partial<Zone>) {
    if (!selectedId) return;
    setZones((zs) => zs.map((z) => (z.id === selectedId ? { ...z, ...patch } : z)));
  }

  function removeSelected() {
    if (!selectedId) return;
    commit(zones.filter((z) => z.id !== selectedId));
    setSelectedId(null);
  }

  async function uploadFile(file: File) {
    setUploadError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("taskId", String(task.id));
      const res = await fetch("/api/design/upload-sketch", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "上传失败");
      setImageUrl(data.url);
    } catch (e: any) {
      setUploadError(e?.message || "上传失败，请重试");
    } finally {
      setUploading(false);
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) uploadFile(f);
    e.target.value = "";
  }

  async function submit() {
    const isUpload = mode === "upload";
    if (isUpload ? !imageUrl : zones.length === 0) return;
    setSubmitting(true);
    setReview(null);
    setSubmitError("");
    try {
      const res = await fetch("/api/design/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          stageKey: "S3",
          payload: isUpload ? { mode: "upload", imageUrl } : { zones },
          meta: { site: { x: geom.imgX, y: geom.imgY, w: geom.bw, h: geom.bh }, siteArea },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "review failed");
      if (isUpload && Array.isArray(data.zones)) {
        setZones(data.zones);
        setSelectedId(null);
      }
      setReview(data);
      const pr = await fetch(`/api/design/progress?taskId=${task.id}`);
      if (pr.ok) {
        const pd = await pr.json();
        if (pd.run) onRun(pd.run);
      }
    } catch (e: any) {
      setSubmitError(e?.message || "提交失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  const modeBtn = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={`rounded-lg px-3 py-1.5 text-fs-label font-medium transition ${
        mode === m ? "border-neo bg-primary text-on-primary shadow-2xs" : "text-on-surface-variant hover:bg-surface-container"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex min-h-0 flex-col gap-3 lg:h-full lg:flex-row">
      {/* 中栏：S2 回显 + 画布/上传 + 分区管理 */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 lg:h-full">
        {/* S2 产出回显（只读） */}
        <section className="shrink-0 rounded-2xl bg-sun-container/60 px-5 py-3 shadow-card">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-fs-label text-on-surface-variant">设计定位</span>
              <span className="text-fs-sub font-medium text-on-surface">{posLabel}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-fs-label text-on-surface-variant">设计原则</span>
              {prinLabels.length === 0 ? (
                <span className="text-fs-label text-on-surface-variant/60">—</span>
              ) : (
                prinLabels.map((l, i) => (
                  <span key={i} className="rounded-full bg-primary-container/50 px-2.5 py-0.5 text-fs-label text-on-primary-container">
                    {l}
                  </span>
                ))
              )}
            </div>
          </div>
        </section>

        {/* 画布/上传 + 分区管理 */}
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-sun-container/40 shadow-card">
          {/* 模式切换 */}
          <div className="flex flex-wrap items-center gap-2 border-b-neo border-outline-variant/25 px-3 py-2">
            <div className="flex items-center gap-1 rounded-xl bg-surface-container/60 p-0.5">
              {modeBtn("canvas", "画布划分")}
              {modeBtn("upload", "上传手绘图")}
            </div>
            <span className="text-fs-label text-on-surface-variant">
              {mode === "canvas" ? "在底图上画出分区边界（铅笔可画曲线，轻点分区可选中）" : "上传手绘分区图照片，AI 直接评分并识别分区"}
            </span>
          </div>

          {mode === "canvas" ? (
            <ZoningCanvas
              asset={asset}
              base={base}
              zones={zones.filter((z) => z.points?.length)}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onDraftClose={onDraftClose}
              onUndo={undo}
              canUndo={history.length > 0}
              onDeleteSelected={removeSelected}
              hasSelection={!!selectedId}
            />
          ) : (
            <div
              className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f && f.type.startsWith("image/")) uploadFile(f);
              }}
            >
              {imageUrl ? (
                <>
                  <div className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-xl border-neo border-outline-variant/30 bg-surface">
                    <img src={imageUrl} alt="手绘功能分区图" className="h-full w-full object-contain" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-1.5 rounded-lg border-neo bg-surface-container px-3 py-1.5 text-fs-label text-on-surface transition hover:bg-surface-container/70 disabled:opacity-40">
                      <Upload className="h-3.5 w-3.5" /> {uploading ? "上传中…" : "换一张"}
                    </button>
                    <button type="button" onClick={() => setImageUrl("")} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-fs-label text-error transition hover:bg-error/10">
                      <Trash2 className="h-3.5 w-3.5" /> 移除
                    </button>
                    <span className="text-fs-label text-on-surface-variant">提交后以 AI 识别的分区清单为准，可在评阅后修改</span>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex w-full max-w-lg flex-col items-center gap-2 rounded-xl border-2 border-dashed border-outline-variant/60 bg-surface-container/40 px-6 py-10 text-center transition hover:bg-surface-container/70 disabled:opacity-50"
                >
                  <ImagePlus className="h-8 w-8 text-on-surface-variant" />
                  <span className="text-fs-sub font-medium text-on-surface">{uploading ? "上传中…" : "选择或拖入手绘分区图"}</span>
                  <span className="text-fs-label text-on-surface-variant">在纸上画出功能分区并标注名称，拍照上传（JPG/PNG 等，≤8MB）；AI 将直接评分并识别其中的分区</span>
                </button>
              )}
              {uploadError && <p className="text-fs-label text-error">{uploadError}</p>}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
            </div>
          )}

          <div className="shrink-0 border-t-neo border-outline-variant/25 px-4 py-3">
            {zones.length === 0 ? (
              <p className="text-fs-label text-on-surface-variant">
                {mode === "canvas" ? "尚未划分分区。用铅笔或落点工具在底图上画出第一个功能区。" : "尚未上传图片。上传后 AI 评阅时会自动识别分区清单。"}
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                {zones.map((z) => {
                  const hasGeom = !!z.points?.length;
                  const pct = hasGeom ? Math.round((polyArea(z.points) / siteArea) * 100) : null;
                  return (
                    <button
                      key={z.id}
                      type="button"
                      onClick={() => setSelectedId(z.id === selectedId ? null : z.id)}
                      className={`flex items-center gap-1.5 rounded-full border-neo px-2.5 py-1 text-fs-label transition-colors ${
                        z.id === selectedId ? "border-primary bg-primary-container/60 font-medium text-on-primary-container" : "border-outline-variant/30 text-on-surface-variant hover:bg-surface-container"
                      }`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: z.color }} />
                      {z.name}
                      {pct != null && <span className="text-on-surface-variant/60">{pct}%</span>}
                    </button>
                  );
                })}
                {mode === "upload" && (
                  <button type="button" onClick={addZoneManual} className="rounded-full border-neo border-dashed border-outline-variant/50 px-2.5 py-1 text-fs-label text-on-surface-variant transition-colors hover:bg-surface-container">
                    + 补充分区
                  </button>
                )}
              </div>
            )}

            {selected && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-xl bg-surface-container/60 px-3 py-2">
                <input
                  value={selected.name}
                  onChange={(e) => patchSelected({ name: e.target.value })}
                  className="w-40 rounded-lg border-neo border-outline-variant/30 bg-surface px-2.5 py-1.5 text-fs-label text-on-surface focus:outline-none focus:ring-2 focus:ring-ink"
                  placeholder="分区名称"
                />
                <div className="flex items-center gap-1">
                  <Palette className="h-4 w-4 text-on-surface-variant" />
                  {PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => patchSelected({ color: c })}
                      className={`h-5 w-5 rounded-full transition-transform ${selected.color === c ? "scale-110 ring-2 ring-on-surface/40" : "hover:scale-105"}`}
                      style={{ background: c }}
                      aria-label={`改为 ${c}`}
                    />
                  ))}
                </div>
                {mode === "upload" && (
                  <span className="flex items-center gap-1">
                    <button type="button" onClick={undo} disabled={history.length === 0} title="撤回" className="rounded-full bg-surface p-1.5 text-on-surface-variant transition hover:bg-surface-container disabled:opacity-40">
                      <Undo2 className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={removeSelected} title={`删除「${selected.name}」`} className="rounded-full bg-surface p-1.5 text-error transition hover:bg-error/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                )}
                <span className="ml-auto text-fs-label text-on-surface-variant/60">
                  {mode === "canvas" ? "改名/换色在此 · 删除/撤回见画布工具条" : "改名/换色在此"}
                </span>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 右栏：AI 评阅 */}
      <aside className="flex min-h-0 min-w-0 flex-col gap-3 lg:h-full lg:w-[var(--size-panel-ratio)] lg:overflow-y-auto">
        {review ? (
          <ReviewCard review={review} onRetry={() => setReview(null)} onNext={review.passed ? onUnlocked : undefined} nextLabel="进入 S4" />
        ) : (
          <section className="rounded-2xl bg-sun-container/60 p-5 shadow-card">
            <p className="text-fs-sub font-medium text-on-surface">AI 评阅 · 功能分区与空间骨架</p>
            <p className="mt-0.5 text-fs-label text-on-surface-variant">
              {mode === "canvas"
                ? "结合你的设计定位与原则、案例背景，对分区方案评分（结构分与 AI 分各占一半）。"
                : "AI 将直接阅读你的手绘图评分，并识别其中的分区名称（识别结果可在下方修改）。"}
            </p>
            <ul className="mt-3 space-y-2">
              {rubrics.map((r: any, i: number) => (
                <li key={i} className="rounded-xl bg-surface-container/60 px-3 py-2">
                  <p className="text-fs-label font-medium text-on-surface">
                    {r.label}
                    {r.weight != null && <span className="ml-1.5 text-on-surface-variant/60">权重 {r.weight}</span>}
                  </p>
                  {r.desc && <p className="mt-0.5 text-fs-label leading-relaxed text-on-surface-variant">{r.desc}</p>}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={submit}
              disabled={submitting || (mode === "upload" ? !imageUrl : zones.length === 0)}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-fs-sub font-medium text-on-primary transition-opacity disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
              {submitting ? "评阅中…" : mode === "upload" ? "提交手绘图 AI 评阅" : `提交分区方案（${zones.length} 个）`}
            </button>
            {submitError && <p className="mt-2 text-center text-fs-label text-error">{submitError}</p>}
            {mode === "canvas" && zones.length === 0 && <p className="mt-2 text-center text-fs-label text-on-surface-variant/60">至少划分 1 个分区后可提交</p>}
            {mode === "upload" && !imageUrl && <p className="mt-2 text-center text-fs-label text-on-surface-variant/60">上传手绘图后可提交</p>}
          </section>
        )}
      </aside>
    </div>
  );
}
