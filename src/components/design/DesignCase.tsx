"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Clock3, DoorOpen, Flower, Flower2, Gauge, Layers, Library, Presentation } from "lucide-react";
import { startSplitDrag } from "./split";
import { AppShell } from "@/components/AppShell";
import { PAGE_COPY } from "@/config/pages";
import type { SessionUser } from "@/lib/auth";
import type { StudentRun } from "@/lib/design";

// 与 src/lib/design-demo-answers.ts 的 DEMO_STUDENT_NO 保持一致；
// 不从该模块 import，避免把整套演示答案打包进客户端 JS 泄漏给所有学生。
const DEMO_STUDENT_NO = "20232001027";
import { StageDiagnosis } from "./StageDiagnosis";
import { StagePositioning } from "./StagePositioning";
import { StageZoning } from "./StageZoning";
import { StagePlanting } from "./StagePlanting";
import { StageLayout } from "./StageLayout";
import { StageEvaluation } from "./StageEvaluation";
import { CaseIntro } from "./CaseIntro";
import { CaseMediaGallery, mediaThumb } from "./CaseMedia";
import type { PlantPick } from "@/lib/plant-compliance";

interface Props {
  user: SessionUser | null;
  task: Record<string, any>;
  nongyuan: Record<string, any>;
  run: StudentRun | null;
  plants: PlantPick[];
}

const STAGES = ["S1", "S2", "S3", "S4", "S5", "S6"];

export function DesignCase({ user, task, nongyuan, run: initialRun, plants }: Props) {
  const [phase, setPhase] = useState<"background" | "workbench">("background");
  const [stage, setStage] = useState<string>(initialRun?.current_stage ?? "S1");
  const [anim, setAnim] = useState<"next" | "prev" | "">("");
  const [leaving, setLeaving] = useState(false);
  const [run, setRun] = useState<StudentRun | null>(initialRun);
  const [leftPct, setLeftPct] = useState(22);
  const [fullOpen, setFullOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoMsg, setDemoMsg] = useState("");
  const [demoNonce, setDemoNonce] = useState(0);
  const rowRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const flipRect = useRef<DOMRect | null>(null);

  const stages: any[] = task.stages ?? [];
  const unlocked: string[] = run?.unlocked_stages ?? ["S1"];

  useLayoutEffect(() => {
    if (phase !== "workbench" || !shellRef.current || !flipRect.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const from = flipRect.current;
    const to = shellRef.current.getBoundingClientRect();
    const el = shellRef.current;
    el.style.transformOrigin = "top left";
    el.style.transform = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;
    el.style.transition = "none";
    requestAnimationFrame(() => {
      el.style.transition = "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)";
      el.style.transform = "translate(0, 0) scale(1, 1)";
      setTimeout(() => {
        el.style.transform = "";
        el.style.transition = "";
        el.style.transformOrigin = "";
      }, 460);
    });
  }, [phase]);

  const enterWorkbench = () => {
    if (cardRef.current) flipRect.current = cardRef.current.getBoundingClientRect();
    setPhase("workbench");
  };

  const exitWorkbench = () => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("background");
      return;
    }
    setLeaving(true);
    setTimeout(() => {
      setLeaving(false);
      setPhase("background");
    }, 240);
  };

  const changeStage = (key: string) => {
    if (key === stage) return;
    setAnim(STAGES.indexOf(key) > STAGES.indexOf(stage) ? "next" : "prev");
    setStage(key);
  };

  // 「演示答案」（仅教师）：一键写入当前阶段的标准作答并解锁下一阶段
  const applyDemoAnswer = async () => {
    if (demoBusy) return;
    setDemoBusy(true);
    setDemoMsg("");
    try {
      const res = await fetch("/api/design/stage/apply-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, stageKey: stage }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "apply failed");
      const pr = await fetch(`/api/design/progress?taskId=${encodeURIComponent(task.id)}`);
      if (pr.ok) {
        const pd = await pr.json();
        if (pd.run) setRun(pd.run);
      }
      setDemoNonce((n) => n + 1);
      setAnim("");
      setDemoMsg(`已应用「${stageName(stage)}」演示答案`);
    } catch (e: any) {
      setDemoMsg(e?.message === "DEMO_ANSWER_NOT_FOUND" ? "该阶段暂无演示答案" : "演示答案应用失败，请重试");
    } finally {
      setDemoBusy(false);
      setTimeout(() => setDemoMsg(""), 2600);
    }
  };

  const stageName = (key: string) => stages.find((s) => s.key === key)?.name ?? key;
  const stageDone = (key: string) => Boolean(run?.stage_scores?.[key] != null);

  // 「结束设计」：终止（保留）——进度不动，直接回案例列表，下次接着做
  const keepAndExit = () => {
    window.location.href = "/design";
  };
  // 「结束设计」：直接退出——清库 + 清各阶段草稿，下次从头开始
  const discardAndExit = async () => {
    if (discarding) return;
    setDiscarding(true);
    try {
      await fetch(`/api/design/progress?taskId=${encodeURIComponent(task.id)}`, { method: "DELETE" });
    } catch {
      // 网络失败也继续清本地并退出，避免卡住
    }
    if (user?.id) {
      for (const s of ["S1", "S2", "S3", "S4", "S5", "S6"]) {
        try {
          localStorage.removeItem(`zjxj:design:${task.id}:${s}:${user.id}`);
        } catch {}
      }
    }
    window.location.href = "/design";
  };

  if (phase === "background") {
    const copy = PAGE_COPY.designCase;
    return (
      <AppShell user={user}>
        <div className="student-vivid animate-bg-in -my-3 w-full">
          <div ref={cardRef} className="flex w-full flex-col gap-4 lg:h-[var(--size-panel-vh)] lg:flex-row lg:overflow-hidden">
            {/* 左栏：案例素材（图片/视频/3D 模型） */}
            <div className="overflow-hidden rounded-xl bg-surface shadow-card lg:h-full lg:w-[var(--size-case-media-w)] lg:shrink-0">
              <CaseMediaGallery
                media={task.media}
                alt={task.name}
                variant="fill"
                fallback={
                  <div className="relative h-64 bg-surface-container md:h-80 lg:h-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={task.cover} alt={task.name} className="absolute inset-0 h-full w-full object-cover" />
                  </div>
                }
              />
            </div>
            {/* 右栏：案例信息（内部滚动 + 吸底操作条） */}
            <div className="flex flex-col overflow-hidden rounded-xl bg-primary-container/50 shadow-card lg:h-full lg:min-w-0 lg:flex-1">
              <div className="overflow-y-auto p-6 md:p-8 lg:min-h-0 lg:flex-1">
                <Link href="/design" className="inline-flex items-center gap-1.5 text-fs-sub text-on-surface-variant hover:text-foreground">
                  <ArrowLeft className="h-4 w-4" /> {copy.backToList}
                </Link>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-fs-label text-on-surface-variant">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-container/60 px-2.5 py-1 text-on-primary-container">
                    <Gauge className="h-3.5 w-3.5" /> {task.difficulty}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2.5 py-1">
                    <Clock3 className="h-3.5 w-3.5" /> {copy.hoursPrefix} {task.hours} {copy.hoursSuffix}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2.5 py-1">
                    <Layers className="h-3.5 w-3.5" /> {stages.length} {copy.stagesSuffix}
                  </span>
                  {(task.tags ?? []).map((t: string) => (
                    <span key={t} className="rounded-full bg-surface-container px-2.5 py-1">{t}</span>
                  ))}
                </div>
                <h1 className="mt-4 text-fs-title font-medium text-on-surface">{task.name}</h1>
                <p className="mt-1 text-fs-sub text-on-surface-variant">{nongyuan.subtitle}</p>
                <CaseIntro text={task.intro || task.case?.background || task.case?.summary || ""} />
              </div>
              <div className="shrink-0 border-t-neo border-outline-variant/30 px-6 py-4 md:px-8">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={enterWorkbench}
                    className="rounded-xl bg-primary px-6 py-3 text-fs-sub font-medium text-on-primary shadow-card transition-all hover:-translate-y-0.5 hover:shadow-float"
                  >
                    {run ? copy.continueDesign : copy.startDesign}
                  </button>
                  {run && (
                    <span className="text-fs-label text-on-surface-variant">
                      {copy.progressPrefix}{stageName(run.current_stage)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <div ref={shellRef} className={`student-vivid fixed inset-0 z-50 flex flex-col bg-surface-container-lowest ${leaving ? "animate-shell-out" : ""}`}>
      {/* 胶囊导航栏 */}
      <header className="relative flex justify-center px-4 pt-4">
        {/* 淡雅花瓣装饰（仅点缀，不拦截交互） */}
        <div aria-hidden className="pointer-events-none absolute inset-0 select-none">
          <Flower2 className="absolute left-5 top-3 h-6 w-6 rotate-12 text-blossom/40" />
          <Flower className="absolute left-16 top-6 h-4 w-4 -rotate-12 text-foreground/20" />
          <Flower2 className="absolute right-7 top-5 h-5 w-5 -rotate-12 text-lavender/40" />
          <Flower className="absolute right-20 top-2 h-4 w-4 rotate-6 text-blossom/30" />
        </div>
        <div className="flex max-w-full items-center gap-3 rounded-full border-neo border-outline-variant/20 bg-surface py-2 pl-2 pr-6 shadow-card">
          <button
            type="button"
            onClick={exitWorkbench}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-container px-3.5 py-1.5 text-fs-sub font-medium text-on-surface-variant hover:bg-surface-container-high"
          >
            <ArrowLeft className="h-4 w-4" /> 案例背景
          </button>
          <h1 className="truncate text-fs-body font-medium text-on-surface md:text-fs-card">{task.name}</h1>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mediaThumb(task.media, task.cover)} alt="" className="hidden h-9 w-12 shrink-0 rounded-md object-cover md:block" />
          {(task.case?.backgroundSections ?? []).length > 0 && (
            <button
              type="button"
              onClick={() => setFullOpen(true)}
              className="inline-flex shrink-0 items-center rounded-full border-neo border-outline-variant/40 px-3.5 py-1.5 text-fs-sub font-medium text-foreground hover:bg-primary/5"
            >
              展开全文
            </button>
          )}
          {user?.role === "student" && user.studentNo === DEMO_STUDENT_NO && (
            <button
              type="button"
              onClick={applyDemoAnswer}
              disabled={demoBusy}
              title="一键填充当前阶段的标准作答（仅演示用）"
              className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border-neo border-outline-variant/40 bg-primary px-3.5 py-1.5 text-fs-sub font-medium text-on-primary shadow-card transition hover:brightness-105 disabled:opacity-50"
            >
              <Presentation className="h-4 w-4" /> {demoBusy ? "应用中…" : "演示答案"}
            </button>
          )}
          {demoMsg && <span className="shrink-0 whitespace-nowrap text-fs-label text-on-surface-variant">{demoMsg}</span>}
          <button
            type="button"
            onClick={() => setEndOpen(true)}
            className={`${user?.role === "teacher" ? "" : "ml-auto "}inline-flex shrink-0 items-center gap-1.5 rounded-full border-neo border-outline-variant/40 px-3.5 py-1.5 text-fs-sub font-medium text-on-surface-variant hover:bg-surface-container`}
          >
            <DoorOpen className="h-4 w-4" /> 结束设计
          </button>
        </div>
      </header>

      {/* 阶段进度条 */}
      <div className="flex justify-center overflow-x-auto px-4 py-3">
        <ol className="flex items-center">
          {STAGES.map((key, i) => {
            const isUnlocked = unlocked.includes(key);
            const active = stage === key;
            const done = stageDone(key);
            return (
              <li key={key} className="flex items-center">
                {i > 0 && (
                  <span className={`mx-1 h-px w-3 md:mx-1.5 md:w-5 ${isUnlocked ? "bg-primary/50" : "bg-outline-variant/30"}`} />
                )}
                <button
                  type="button"
                  disabled={!isUnlocked}
                  onClick={() => changeStage(key)}
                  className={[
                    "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-fs-sub transition-colors",
                    active
                      ? "bg-primary font-medium text-on-primary shadow-card"
                      : isUnlocked
                        ? done
                          ? "font-medium text-success hover:bg-success/10"
                          : "font-medium text-on-surface-variant hover:bg-surface-container"
                        : "cursor-not-allowed text-on-surface-variant/40",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-fs-label font-medium",
                      active
                        ? "bg-on-primary/20 text-on-primary"
                        : done
                          ? "bg-success/15 text-success"
                          : isUnlocked
                            ? "bg-surface-container text-on-surface-variant"
                            : "bg-surface-container/60 text-on-surface-variant/40",
                    ].join(" ")}
                  >
                    {done && !active ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  {stageName(key)}
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* 主区：案例资料 + 阶段内容，分隔条可拖拽调宽 */}
      <main className="min-h-0 flex-1 overflow-y-auto lg:overflow-hidden">
        <div ref={rowRef} className="flex flex-col gap-3 p-5 lg:h-full lg:flex-row lg:gap-0 lg:p-6">
          <div className="w-full min-w-0 lg:h-full lg:w-[var(--w)]" style={{ "--w": `${leftPct}%` } as CSSProperties}>
            <CasePanel task={task} nongyuan={nongyuan} />
          </div>
          <div
            title="拖拽调整宽度"
            onMouseDown={(e) =>
              startSplitDrag(e, {
                start: leftPct,
                min: 16,
                max: 40,
                total: rowRef.current?.clientWidth ?? 1200,
                onMove: setLeftPct,
              })
            }
            className="mx-1.5 hidden w-1.5 shrink-0 cursor-col-resize rounded-full bg-outline-variant/20 transition-colors hover:bg-primary/50 lg:block"
          />
          <div className="min-h-0 min-w-0 flex-1 lg:overflow-y-auto">
            <div key={`${stage}:${demoNonce}`} className={`lg:h-full ${anim === "next" ? "animate-stage-next" : anim === "prev" ? "animate-stage-prev" : ""}`}>
            {stage === "S1" && (
              <StageDiagnosis user={user} task={task} nongyuan={nongyuan} run={run} onRun={setRun} onUnlocked={() => changeStage("S2")} />
            )}
            {stage === "S2" && (
              <StagePositioning user={user} task={task} nongyuan={nongyuan} run={run} onRun={setRun} onUnlocked={() => changeStage("S3")} />
            )}
            {stage === "S3" && (
              <StageZoning user={user} task={task} nongyuan={nongyuan} run={run} onRun={setRun} onUnlocked={() => changeStage("S4")} />
            )}
            {stage === "S4" && (
              <StagePlanting user={user} task={task} nongyuan={nongyuan} run={run} plants={plants} onRun={setRun} onUnlocked={() => changeStage("S5")} />
            )}
            {stage === "S5" && (
              <StageLayout user={user} task={task} nongyuan={nongyuan} run={run} plants={plants} onRun={setRun} onUnlocked={() => changeStage("S6")} />
            )}
            {stage === "S6" && (
              <StageEvaluation user={user} task={task} nongyuan={nongyuan} run={run} plants={plants} onRun={setRun} />
            )}
            {!["S1", "S2", "S3", "S4", "S5", "S6"].includes(stage) && (
              <div className="flex h-full items-center justify-center p-5">
                <div className="max-w-xl rounded-2xl bg-surface p-8 text-center shadow-card">
                  <Library className="mx-auto h-8 w-8 text-on-surface-variant/50" />
                  <p className="mt-3 text-fs-sub font-medium text-on-surface">{stageName(stage)} · 方案与表达阶段</p>
                  <p className="mt-2 text-fs-label leading-relaxed text-on-surface-variant">
                    该阶段将在后续迭代开放。当前迭代聚焦 S1 场地诊断与 S2 设计定位。
                  </p>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      </main>

      {fullOpen && (
        <FullTextDrawer sections={task.case?.backgroundSections ?? []} onClose={() => setFullOpen(false)} />
      )}

      {endOpen && (
        <EndDesignDialog
          discarding={discarding}
          onClose={() => !discarding && setEndOpen(false)}
          onKeep={keepAndExit}
          onDiscard={discardAndExit}
        />
      )}
    </div>
  );
}

function FullTextDrawer({ sections, onClose }: { sections: { title?: string; text?: string; body?: string }[]; onClose: () => void }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  const close = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onClose();
      return;
    }
    setShown(false);
    setTimeout(onClose, 220);
  };
  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="案例全文">
      <div
        className={`absolute inset-0 bg-black/30 transition-opacity duration-200 motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"}`}
        onClick={close}
      />
      <aside
        className={`absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col bg-surface shadow-float transition-transform duration-200 motion-reduce:transition-none ${shown ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between border-b-neo border-outline-variant/30 px-6 py-4">
          <h2 className="text-fs-card font-medium text-on-surface">案例全文</h2>
          <button
            type="button"
            onClick={close}
            className="rounded-full bg-surface-container px-4 py-1.5 text-fs-sub font-medium text-on-surface-variant hover:bg-surface-container-high"
          >
            关闭
          </button>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          {sections.map((s, i) => (
            <section key={i}>
              <h3 className="text-fs-card font-medium text-on-surface">{s.title}</h3>
              <p className="mt-2 whitespace-pre-line text-fs-body text-on-surface">{s.text ?? s.body}</p>
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
}

function EndDesignDialog({ discarding, onClose, onKeep, onDiscard }: { discarding: boolean; onClose: () => void; onKeep: () => void; onDiscard: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="结束设计">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-surface p-6 shadow-float">
        <h2 className="text-fs-card font-medium text-on-surface">结束设计</h2>
        <p className="mt-1.5 text-fs-label leading-relaxed text-on-surface-variant">选择退出方式，决定下次进入案例时从哪里开始。</p>
        <div className="mt-5 space-y-3">
          <button
            type="button"
            onClick={onKeep}
            disabled={discarding}
            className="w-full rounded-xl border-neo border-outline-variant/40 bg-surface px-4 py-3.5 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-60"
          >
            <span className="block text-fs-sub font-medium text-on-surface">终止（保留进度）</span>
            <span className="mt-0.5 block text-fs-label text-on-surface-variant">下次进入案例时，接着上次的设计继续做。</span>
          </button>
          <button
            type="button"
            onClick={onDiscard}
            disabled={discarding}
            className="w-full rounded-xl border-neo border-error/30 bg-surface px-4 py-3.5 text-left transition-colors hover:border-error/60 hover:bg-error/5 disabled:opacity-60"
          >
            <span className="block text-fs-sub font-medium text-error">{discarding ? "正在清空…" : "直接退出（不保留）"}</span>
            <span className="mt-0.5 block text-fs-label text-on-surface-variant">清空全部进度，下次进入时从头开始。</span>
          </button>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={discarding}
            className="rounded-full bg-surface-container px-4 py-1.5 text-fs-sub font-medium text-on-surface-variant hover:bg-surface-container-high disabled:opacity-60"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

function CasePanel({ task, nongyuan }: { task: Record<string, any>; nongyuan: Record<string, any> }) {
  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-primary-container/40 shadow-card lg:h-full">
      {/* 资源展示区（顶部）：图片/视频/3D 画廊，图片可点击放大 */}
      <div className="shrink-0 p-3 pb-0">
        <CaseMediaGallery
          media={task.media}
          alt={task.name}
          variant="panel"
          fallback={
            <div className="relative h-40 overflow-hidden rounded-xl bg-surface-container">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={task.cover} alt={task.name} className="absolute inset-0 h-full w-full object-cover" />
            </div>
          }
        />
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-5 text-fs-sub">
        <section>
          <h3 className="text-fs-label font-medium text-on-surface-variant">案例背景</h3>
          <p className="mt-1.5 leading-relaxed text-on-surface-variant">{nongyuan.designBrief?.background}</p>
        </section>
        <section>
          <h3 className="text-fs-label font-medium text-on-surface-variant">顾问提示（向 AI 提问可解锁线索）</h3>
          <ul className="mt-1.5 space-y-1.5">
            {(nongyuan.inquiry?.entries ?? []).map((e: any) => (
              <li key={e.id} className="rounded-lg bg-surface-container px-3 py-2 text-fs-label text-on-surface-variant">
                {e.id} · {e.topic}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </aside>
  );
}
