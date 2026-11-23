"use client";

import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import type { StudentRun } from "@/lib/design";
import { ReviewCard } from "./ReviewCard";
import { useVoiceInput } from "./use-voice-input";

interface Props {
  user: SessionUser | null;
  task: Record<string, any>;
  nongyuan: Record<string, any>;
  run: StudentRun | null;
  onRun: (r: StudentRun) => void;
  onUnlocked: () => void;
}

export function StagePositioning({ user, task, nongyuan, run, onRun, onUnlocked }: Props) {
  const posOptions: any[] = nongyuan.positioningOptions ?? [];
  const prinOptions: any[] = nongyuan.principleOptions ?? [];
  const diagFields: any[] = nongyuan.diagnosisForm ?? [];
  const s1Answers = ((run?.stage_payloads?.S1 as any)?.payload ?? {}) as Record<string, string>;
  const passScore = nongyuan.scoring?.passScore ?? task.passScore ?? 60;
  const savedPayload = ((run?.stage_payloads?.S2 as any)?.payload ?? run?.stage_payloads?.S2 ?? {}) as {
    primary?: string;
    principles?: string[];
    reasons?: Record<string, string>;
  };
  const savedReview = run?.stage_reviews?.S2;
  const savedScore = run?.stage_scores?.S2;
  const storageKey = `zjxj:design:${task.id}:S2:${user?.id ?? "anon"}`;

  const [mainPos, setMainPos] = useState(savedPayload?.primary ?? "");
  const [principles, setPrinciples] = useState<string[]>(savedPayload?.principles ?? []);
  const [reasons, setReasons] = useState(savedPayload?.reasons ? Object.values(savedPayload.reasons).join("\n") : "");
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
  const [submitting, setSubmitting] = useState(false);

  // 刷新恢复：提交前的草稿存 localStorage
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw);
        if (!mainPos && typeof saved.mainPos === "string") setMainPos(saved.mainPos);
        if (!principles.length && Array.isArray(saved.principles)) setPrinciples(saved.principles);
        if (!reasons && typeof saved.reasons === "string") setReasons(saved.reasons);
      }
    } catch {
      /* 本地草稿损坏时忽略 */
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ mainPos, principles, reasons }));
    } catch {
      /* 存储满时忽略 */
    }
  }, [ready, storageKey, mainPos, principles, reasons]);

  const reasonCount = reasons.split(/\n|;/).filter((s) => s.trim().length >= 4).length;

  // 选择理由语音输入（追加模式：以点击麦克风时的文本为基底，识别结果追加为新行）
  const reasonBaseRef = useRef("");
  const { supported: micSupported, listening, toggle: toggleReasonMic } = useVoiceInput((t) => {
    const base = reasonBaseRef.current.replace(/\s+$/, "");
    setReasons(base ? base + "\n" + t : t);
  });
  function onReasonMic() {
    if (!listening) reasonBaseRef.current = reasons;
    toggleReasonMic();
  }

  function togglePrinciple(id: string) {
    setPrinciples((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 4 ? p : [...p, id]));
  }

  async function submit() {
    setSubmitting(true);
    setReview(null);
    try {
      const reasonMap = Object.fromEntries(
        reasons
          .split(/\n|;/)
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s, i) => [`r${i + 1}`, s])
      );
      const res = await fetch("/api/design/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          stageKey: "S2",
          payload: { primary: mainPos, secondary: [], principles, reasons: reasonMap },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "review failed");
      setReview(data);
      const pr = await fetch(`/api/design/progress?taskId=${task.id}`);
      if (pr.ok) {
        const pd = await pr.json();
        if (pd.run) onRun(pd.run);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-col gap-3 lg:h-full lg:flex-row">
      {/* 中栏：设计定位表单 + AI 评阅 */}
      <div className="min-w-0 flex-1 space-y-3 lg:h-full lg:overflow-y-auto">
        <section className="rounded-2xl bg-lavender-container/60 p-5 shadow-card">
          <p className="text-fs-sub font-medium text-on-surface">设计定位（S2）</p>
          <p className="mt-0.5 text-fs-label text-on-surface-variant">基于 S1 诊断结论，确定主定位与设计原则</p>

          <p className="mt-3 text-fs-label font-medium text-on-surface">主定位（单选）</p>
          <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
            {posOptions.map((o: any) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setMainPos(o.id)}
                className={`rounded-xl border-neo px-3 py-2 text-left text-fs-label transition-all ${
                  mainPos === o.id
                    ? "border-primary bg-primary-container/60 font-medium text-on-primary-container shadow-card"
                    : "border-lavender/50 bg-white text-on-surface shadow-card hover:-translate-y-0.5 hover:border-lavender hover:shadow-float"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          <p className="mt-3 text-fs-label font-medium text-on-surface">设计原则（多选，最多 4 项）</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {prinOptions.map((o: any) => (
              <button
                key={o.id}
                type="button"
                onClick={() => togglePrinciple(o.id)}
                className={`rounded-full border-neo px-2.5 py-1 text-fs-label transition-all ${
                  principles.includes(o.id)
                    ? "border-primary bg-primary text-on-primary shadow-card"
                    : "border-lavender/50 bg-white text-on-surface-variant shadow-card hover:-translate-y-0.5 hover:border-lavender hover:shadow-float"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          <p className="mt-3 text-fs-label font-medium text-on-surface">
            选择理由（至少 3 条，每行一条）
            <span className={`ml-2 ${reasonCount >= 3 ? "text-success" : "text-on-surface-variant/60"}`}>{reasonCount}/3</span>
          </p>
          <div className="relative mt-1.5">
            <textarea
              value={reasons}
              onChange={(e) => setReasons(e.target.value)}
              rows={3}
              className="w-full rounded-xl border-neo border-outline-variant/30 bg-surface px-3 py-2 pr-14 text-fs-sub text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-ink"
              placeholder={"1. 场地盐碱土壤适合可食植物展示…\n2. 儿童活动区需要科普互动…\n3. …"}
            />
            {micSupported && (
              <button
                type="button"
                onClick={onReasonMic}
                aria-label={listening ? "停止语音输入" : "语音输入选择理由"}
                title={listening ? "停止语音输入" : "语音输入（追加）"}
                className={`absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                  listening ? "animate-pulse bg-error text-on-error" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                <Mic className="h-4 w-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={submitting || !mainPos || principles.length === 0}
            className="mt-3 w-full rounded-xl bg-primary px-4 py-2.5 text-fs-sub font-medium text-on-primary transition-opacity disabled:opacity-40"
          >
            {submitting ? "评阅中…" : "提交定位，AI 评阅"}
          </button>
        </section>

        {review && (
          <ReviewCard review={review} onRetry={() => setReview(null)} onNext={review.passed ? onUnlocked : undefined} nextLabel="进入 S3 方案生成" />
        )}
      </div>

      {/* 右栏：S1 场地诊断表参考 */}
      <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl bg-water-container/50 shadow-card lg:h-full lg:w-[var(--size-panel-ratio-wide)]">
        <header className="shrink-0 border-b-neo border-outline-variant/20 px-4 py-3">
          <p className="text-fs-sub font-medium text-on-surface">场地诊断表 · S1 参考</p>
          <p className="mt-0.5 text-fs-label text-on-surface-variant">你在现状诊断中填写的结论，供设计定位参考</p>
        </header>
        <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
          {diagFields.length === 0 && (
            <p className="rounded-xl bg-surface-container px-3 py-2 text-fs-label text-on-surface-variant">暂无 S1 诊断数据</p>
          )}
          {diagFields.map((f: any) => (
            <div key={f.key} className="rounded-xl bg-surface-container px-3 py-2.5">
              <p className="text-fs-label font-medium text-on-surface">{f.label}</p>
              <p className="mt-1 whitespace-pre-line text-fs-label leading-relaxed text-on-surface-variant">{s1Answers[f.key] || "（未填写）"}</p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
