"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Box, ImagePlus, Loader2, Mic, Plus, Save, Send, Sparkles, Trash2, Video, Wand2 } from "lucide-react";
import Link from "next/link";
import { PublishClassModal } from "./PublishClassModal";
import InquiryAiModal, { type ParsedEntry } from "./InquiryAiModal";
import { useVoiceInput } from "./use-voice-input";
import { normalizeMediaList, type CaseMediaData } from "./CaseMedia";

interface DBTask {
  id: string;
  title: string;
  subtitle: string | null;
  cover_url: string | null;
  tags: string[];
  difficulty: string | null;
  est_minutes: number | null;
  intro: string | null;
  status: string;
  published_classes?: string[];
  task_def: any;
  nongyuan: any;
}

interface EntryEdit {
  id: string;
  topic: string;
  keywords: string;
  importance: "critical" | "normal";
  answer: string;
}

interface FieldEdit {
  key: string;
  label: string;
  hint: string;
  mustMention: string;
}

interface RubricEdit {
  key: string;
  label: string;
  weight: number;
  desc: string;
}

const STAGE_NAMES: Record<string, string> = {
  S1: "场地调研与现状诊断",
  S2: "设计定位与设计原则",
  S3: "功能分区与空间骨架",
  S4: "植物筛选与合规审查",
  S5: "平面布局与种植设计",
  S6: "方案评估",
};

const MEDIA_LIMITS: Record<CaseMediaData["type"], number> = { image: 5, video: 50, model: 20 };
const MEDIA_ACCEPT: Record<CaseMediaData["type"], string> = { image: "image/*", video: "video/mp4,video/webm", model: ".glb,.gltf" };
const MEDIA_LABEL: Record<CaseMediaData["type"], string> = { image: "图片", video: "视频", model: "3D 模型" };

const SECTIONS = [
  { id: "sec-basic", label: "基本信息" },
  { id: "sec-publish", label: "发布信息" },
  { id: "sec-intro", label: "任务简介" },
  { id: "sec-inquiry", label: "学生可问问题与 AI 回答" },
  { id: "sec-diagnosis", label: "场地诊断表" },
  { id: "sec-rubrics", label: "各阶段评分标准" },
];

export default function DesignTaskEdit({ taskId }: { taskId: string }) {
  const [task, setTask] = useState<DBTask | null>(null);
  const [tags, setTags] = useState("");
  const [entries, setEntries] = useState<EntryEdit[]>([]);
  const [fields, setFields] = useState<FieldEdit[]>([]);
  const [rubrics, setRubrics] = useState<Record<string, RubricEdit[]>>({});
  const [passScore, setPassScore] = useState(60);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"ok" | "err">("ok");
  const [publishOpen, setPublishOpen] = useState(false);
  const [pendingBody, setPendingBody] = useState<Record<string, unknown> | null>(null);
  const [activeSec, setActiveSec] = useState(SECTIONS[0].id);
  const scrollBoxRef = useRef<HTMLDivElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [rubricsLoading, setRubricsLoading] = useState(false);
  const [inquiryAiOpen, setInquiryAiOpen] = useState(false);
  const imgInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const modelInputRef = useRef<HTMLInputElement | null>(null);
  const posterInputRef = useRef<HTMLInputElement | null>(null);
  const posterTargetRef = useRef<number | null>(null);
  const [mediaList, setMediaList] = useState<CaseMediaData[]>([]);
  const introVoiceBase = useRef("");

  const introVoice = useVoiceInput((t) => {
    setTask((task) => (task ? { ...task, intro: introVoiceBase.current + (introVoiceBase.current ? "\n" : "") + t } : task));
  });
  function startIntroVoice() {
    if (!introVoice.listening) introVoiceBase.current = task?.intro ?? "";
    introVoice.toggle();
  }

  useEffect(() => {
    fetch(`/api/admin/design-tasks/${taskId}`)
      .then((r) => r.json())
      .then((d) => {
        const t = d.task as DBTask;
        setTask(t);
        setTags((t.tags ?? []).join("、"));
        const ny = t.nongyuan ?? {};
        setEntries(
          ((ny.inquiry?.entries ?? []) as any[]).map((e) => ({
            id: e.id,
            topic: e.topic ?? "",
            keywords: (e.keywords ?? []).join("、"),
            importance: e.importance === "critical" ? "critical" : "normal",
            answer: e.answer ?? "",
          })),
        );
        setFields(
          ((ny.diagnosisForm ?? []) as any[]).map((f) => ({
            key: f.key,
            label: f.label ?? "",
            hint: f.hint ?? "",
            mustMention: (f.mustMention ?? []).join("、"),
          })),
        );
        const td = t.task_def ?? {};
        const rb: Record<string, RubricEdit[]> = {};
        for (const k of Object.keys(STAGE_NAMES)) {
          rb[k] = ((td.rubricsByStage?.[k] ?? (k === "S1" ? td.rubrics : [])) ?? []).map((r: any) => ({
            key: r.key ?? "",
            label: r.label ?? "",
            weight: Number(r.weight ?? 0),
            desc: r.desc ?? "",
          }));
        }
        setRubrics(rb);
        setPassScore(Number(ny.scoring?.passScore ?? td.passScore ?? 60));
        setMediaList(normalizeMediaList(td.media));
      });
  }, [taskId]);

  // 滚动联动：高亮当前模块（不改变路由、不产生 history）
  useEffect(() => {
    function onScroll() {
      let current = SECTIONS[0].id;
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= 140) current = s.id;
      }
      setActiveSec(current);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [task]);

  function jumpTo(id: string) {
    setActiveSec(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function buildBody(): Record<string, unknown> | null {
    if (!task) return null;
    const ny = task.nongyuan ?? {};
    const td = task.task_def ?? {};
    const nongyuan = {
      ...ny,
      inquiry: {
        ...(ny.inquiry ?? {}),
        entries: entries.map((e) => ({
          id: e.id,
          topic: e.topic,
          zone: (ny.inquiry?.entries ?? []).find((x: any) => x.id === e.id)?.zone ?? "*",
          importance: e.importance,
          keywords: e.keywords.split(/[、,，\s]+/).filter(Boolean),
          answer: e.answer,
        })),
        criticalEntryIds: entries.filter((e) => e.importance === "critical").map((e) => e.id),
      },
      diagnosisForm: fields.map((f) => ({
        key: f.key,
        label: f.label,
        hint: f.hint,
        mustMention: f.mustMention.split(/[、,，]+/).filter(Boolean),
      })),
      scoring: { ...(ny.scoring ?? {}), passScore },
    };
    const taskDef = { ...td, name: task.title, passScore, rubricsByStage: rubrics };
    if (mediaList.length) taskDef.media = mediaList;
    else delete taskDef.media;
    const firstMedia = mediaList[0];
    const coverUrl = firstMedia
      ? firstMedia.type === "image"
        ? firstMedia.url
        : firstMedia.poster ?? task.cover_url
      : task.cover_url;
    return {
      title: task.title,
      subtitle: task.subtitle,
      coverUrl,
      tags: tags.split(/[、,，\s]+/).filter(Boolean),
      difficulty: task.difficulty,
      estMinutes: task.est_minutes,
      intro: task.intro,
      taskDef,
      nongyuan,
    };
  }

  function notify(text: string, tone: "ok" | "err" = "ok") {
    setMsg(text);
    setMsgTone(tone);
  }

  async function uploadOne(file: File, type: CaseMediaData["type"]): Promise<string | null> {
    if (file.size > MEDIA_LIMITS[type] * 1024 * 1024) {
      notify(`「${file.name}」超过 ${MEDIA_LIMITS[type]}MB，未上传`, "err");
      return null;
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("taskId", taskId);
    fd.append("kind", type);
    try {
      const res = await fetch("/api/admin/design-tasks/upload-media", { method: "POST", body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(d.error ?? "上传失败", "err");
        return null;
      }
      return d.url as string;
    } catch {
      notify("上传失败", "err");
      return null;
    }
  }

  async function addFiles(list: FileList | null, type: CaseMediaData["type"]) {
    if (!list || list.length === 0) return;
    setUploading(true);
    const added: CaseMediaData[] = [];
    for (const f of Array.from(list)) {
      const url = await uploadOne(f, type);
      if (url) added.push({ type, url });
    }
    setUploading(false);
    if (added.length) {
      setMediaList((prev) => [...prev, ...added]);
      notify(`已添加 ${added.length} 个${MEDIA_LABEL[type]}`);
    }
  }

  function removeMediaAt(i: number) {
    setMediaList((prev) => prev.filter((_, idx) => idx !== i));
  }

  function pickPoster(i: number) {
    posterTargetRef.current = i;
    posterInputRef.current?.click();
  }

  async function onPosterFile(f: File | null) {
    const i = posterTargetRef.current;
    posterTargetRef.current = null;
    if (!f || i == null) return;
    setUploading(true);
    const url = await uploadOne(f, "image");
    setUploading(false);
    if (url) {
      setMediaList((prev) => prev.map((m, idx) => (idx === i ? { ...m, poster: url } : m)));
      notify("封面帧已设置");
    }
  }

  async function polishIntro() {
    if (!task) return;
    if (!task.intro?.trim()) return notify("请先填写任务简介再润色", "err");
    setPolishing(true);
    try {
      const res = await fetch("/api/admin/design-tasks/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "polish", text: task.intro }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return notify(d.message ?? "润色失败", "err");
      setTask((t) => (t ? { ...t, intro: d.intro } : t));
      notify("已润色");
    } catch {
      notify("润色失败", "err");
    } finally {
      setPolishing(false);
    }
  }

  async function genRubrics() {
    if (!task) return;
    if (!task.title.trim()) return notify("请先填写任务名称", "err");
    const hasExisting = Object.values(rubrics).some((l) => l.length > 0);
    if (hasExisting && !window.confirm("AI 将重新生成并覆盖现有评分标准，是否继续？")) return;
    setRubricsLoading(true);
    try {
      const res = await fetch("/api/admin/design-tasks/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "genRubrics",
          title: task.title,
          subtitle: task.subtitle ?? "",
          intro: task.intro ?? "",
          entries: entries.map((e) => ({ topic: e.topic, importance: e.importance, answer: e.answer })),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return notify(d.message ?? "生成失败", "err");
      setRubrics(d.rubricsByStage);
      notify("已生成评分标准，可继续编辑");
    } catch {
      notify("生成失败", "err");
    } finally {
      setRubricsLoading(false);
    }
  }

  function applyInquiry(parsed: ParsedEntry[], mode: "replace" | "append") {
    const startN =
      mode === "replace"
        ? 0
        : entries.reduce((m, e) => {
            const n = parseInt(e.id.replace(/\D/g, ""), 10);
            return Number.isFinite(n) ? Math.max(m, n) : m;
          }, 0);
    const newEntries: EntryEdit[] = parsed.map((p, i) => ({
      id: `Q${String(startN + i + 1).padStart(2, "0")}`,
      topic: p.topic,
      keywords: p.keywords.join("、"),
      importance: p.importance,
      answer: p.answer,
    }));
    setEntries(mode === "replace" ? newEntries : [...entries, ...newEntries]);
    setInquiryAiOpen(false);
    notify(mode === "replace" ? `已填入 ${newEntries.length} 条` : `已追加 ${newEntries.length} 条`);
  }

  async function save() {
    if (!task) return;
    if (!task.title.trim()) return notify("请先填写任务名称", "err");
    if (!task.intro?.trim()) return notify("请先填写任务简介（需包含任务背景与学生任务）", "err");
    const body = buildBody();
    if (!body) return;
    setSaving(true);
    setMsg("");
    const res = await fetch(`/api/admin/design-tasks/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) notify("已保存");
    else notify("保存失败", "err");
    setSaving(false);
  }

  // 「保存并发布」：先校验，再弹班级选择，确认后一并提交
  function saveAndPublish() {
    if (!task) return;
    if (!task.title.trim()) return notify("请先填写任务名称", "err");
    if (!task.intro?.trim()) return notify("请先填写任务简介（需包含任务背景与学生任务）", "err");
    const body = buildBody();
    if (!body) return;
    setPendingBody(body);
    setPublishOpen(true);
  }

  async function confirmPublish(codes: string[]) {
    if (!pendingBody) return;
    setSaving(true);
    const res = await fetch(`/api/admin/design-tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...pendingBody, status: "published", publishedClasses: codes }),
    });
    setSaving(false);
    setPublishOpen(false);
    setPendingBody(null);
    if (res.ok) {
      notify(task?.status === "published" ? "已保存并更新发布班级" : "已保存并发布");
      setTask((t) => (t ? { ...t, status: "published", published_classes: codes } : t));
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      notify(data.error ?? "发布失败", "err");
    }
  }

  if (!task) return <p className="py-12 text-center text-on-surface-variant">加载中…</p>;

  const field = "w-full rounded-lg border-neo border-outline-variant/30 bg-surface px-3 py-2 text-fs-body text-on-surface focus:outline-none focus:ring-2 focus:ring-ink";
  const label = "mb-1 block text-fs-label font-medium text-on-surface-variant";
  const sectionTitle = "text-fs-sub font-medium text-on-surface";
  const card = "scroll-mt-28 rounded-xl bg-surface p-6 shadow-card";

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/admin/design-tasks" className="inline-flex items-center gap-1 text-fs-label text-on-surface-variant transition hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> 返回任务列表
      </Link>

      <div ref={scrollBoxRef} className="mt-4 flex items-start gap-6">
        {/* A7 左侧简易导航（锚点滚动，不改变路由） */}
        <nav className="sticky top-28 hidden w-44 shrink-0 lg:block">
          <p className="mb-2 text-fs-label font-medium text-on-surface-variant">页面导航</p>
          <ul className="space-y-1 border-l-neo border-outline-variant/25">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => jumpTo(s.id)}
                  className={`-ml-px block w-full border-l-neo px-3 py-1.5 text-left text-fs-label transition ${
                    activeSec === s.id ? "border-primary font-medium text-foreground" : "border-transparent text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 flex-1 space-y-4">
          {/* 基本信息 */}
          <section id="sec-basic" className={card}>
            <h2 className={sectionTitle}>基本信息</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label}>任务名称（必填）</label>
                <input className={field} value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} />
              </div>
              <div>
                <label className={label}>通过分数线</label>
                <input type="number" className={field} value={passScore} onChange={(e) => setPassScore(Number(e.target.value))} />
              </div>
            </div>
          </section>

          {/* 发布信息（A6：移至基本信息正下方） */}
          <section id="sec-publish" className={card}>
            <h2 className={sectionTitle}>发布信息</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label}>副标题</label>
                <input className={field} value={task.subtitle ?? ""} onChange={(e) => setTask({ ...task, subtitle: e.target.value })} />
              </div>
              <div>
                <label className={label}>标签（顿号分隔）</label>
                <input className={field} value={tags} onChange={(e) => setTags(e.target.value)} />
              </div>
              <div>
                <label className={label}>难度</label>
                <input className={field} value={task.difficulty ?? ""} onChange={(e) => setTask({ ...task, difficulty: e.target.value })} />
              </div>
              <div>
                <label className={label}>预计课时（分钟）</label>
                <input type="number" className={field} value={task.est_minutes ?? 0} onChange={(e) => setTask({ ...task, est_minutes: Number(e.target.value) })} />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>案例资源（学生端案例顶部与工作台资源展示区展示，可添加多个图片 / 视频 / 3D 模型）</label>
                <input
                  ref={imgInputRef}
                  type="file"
                  accept={MEDIA_ACCEPT.image}
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void addFiles(e.target.files, "image");
                    e.target.value = "";
                  }}
                />
                <input
                  ref={videoInputRef}
                  type="file"
                  accept={MEDIA_ACCEPT.video}
                  className="hidden"
                  onChange={(e) => {
                    void addFiles(e.target.files, "video");
                    e.target.value = "";
                  }}
                />
                <input
                  ref={modelInputRef}
                  type="file"
                  accept={MEDIA_ACCEPT.model}
                  className="hidden"
                  onChange={(e) => {
                    void addFiles(e.target.files, "model");
                    e.target.value = "";
                  }}
                />
                <input
                  ref={posterInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    void onPosterFile(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => imgInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg bg-surface-container px-3 py-2 text-fs-label font-medium text-on-surface transition hover:bg-surface-container-high disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    添加图片（可多选）
                  </button>
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => videoInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg bg-surface-container px-3 py-2 text-fs-label font-medium text-on-surface transition hover:bg-surface-container-high disabled:opacity-50"
                  >
                    <Video className="h-4 w-4" /> 添加视频
                  </button>
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => modelInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg bg-surface-container px-3 py-2 text-fs-label font-medium text-on-surface transition hover:bg-surface-container-high disabled:opacity-50"
                  >
                    <Box className="h-4 w-4" /> 添加 3D 模型
                  </button>
                  <span className="text-fs-label text-on-surface-variant">{mediaList.length ? `已添加 ${mediaList.length} 个资源` : "未添加，沿用默认封面"}</span>
                </div>
                <p className="mt-1 text-fs-label text-on-surface-variant">图片 ≤5MB（JPG/PNG/WebP）；视频 ≤50MB（MP4/WebM）；3D 模型 ≤20MB（GLB/GLTF）。第一个资源作为列表封面。</p>

                {mediaList.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {mediaList.map((m, i) => (
                      <li key={`${m.url}-${i}`} className="flex items-center gap-3 rounded-lg border-neo border-outline-variant/25 bg-surface-container/40 p-2">
                        <div className="h-14 w-20 shrink-0 overflow-hidden rounded-md bg-surface-container">
                          {m.type === "image" || m.poster ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.type === "image" ? m.url : m.poster} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-on-surface-variant">
                              {m.type === "video" ? <Video className="h-5 w-5" /> : <Box className="h-5 w-5" />}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-fs-label font-medium text-on-surface">
                            {MEDIA_LABEL[m.type]} {i + 1}
                            {i === 0 ? "（列表封面）" : ""}
                          </p>
                          <p className="truncate text-fs-label text-on-surface-variant">{m.url.split("/").pop()}</p>
                        </div>
                        {m.type !== "image" && (
                          <button
                            type="button"
                            disabled={uploading}
                            onClick={() => pickPoster(i)}
                            className="shrink-0 rounded-lg bg-surface-container px-2.5 py-1.5 text-fs-label font-medium text-on-surface transition hover:bg-surface-container-high disabled:opacity-50"
                          >
                            {m.poster ? "换封面帧" : "设封面帧"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeMediaAt(i)}
                          className="shrink-0 rounded-lg p-2 text-on-surface-variant transition hover:bg-error/10 hover:text-error"
                          title="移除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          {/* 任务简介（A5：放大 + 示例要求 + 必填） */}
          <section id="sec-intro" className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={sectionTitle}>任务简介（必填）</h2>
              <div className="flex items-center gap-2">
                {introVoice.supported && (
                  <button
                    type="button"
                    onClick={startIntroVoice}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-fs-label font-medium transition ${
                      introVoice.listening ? "animate-pulse bg-error text-on-error" : "bg-surface-container text-on-surface hover:bg-surface-container-high"
                    }`}
                  >
                    <Mic className="h-3.5 w-3.5" /> {introVoice.listening ? "停止语音" : "语音输入"}
                  </button>
                )}
                <button
                  type="button"
                  disabled={polishing}
                  onClick={() => void polishIntro()}
                  className="flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-1.5 text-fs-label font-medium text-on-surface transition hover:bg-surface-container-high disabled:opacity-50"
                >
                  {polishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                  {polishing ? "AI 润色中…" : "AI 润色"}
                </button>
              </div>
            </div>
            <p className="mt-0.5 text-fs-label text-on-surface-variant">
              请写明：① 任务背景——场地现状、为什么做这件事；② 学生任务——学生要完成什么、提交什么。可直接输入，或语音口述后点「AI 润色」。
            </p>
            <textarea
              className={`${field} mt-3 min-h-[var(--size-chart-sm)] resize-y`}
              placeholder={"示例：\n① 任务背景：某社区入口绿地现状为单一草坪，缺乏遮荫与季相变化，居民希望改造为可停留的林下空间……\n② 学生任务：完成场地诊断与设计定位，提交乔灌草种植方案与平面图，并进行方案讲解。"}
              value={task.intro ?? ""}
              onChange={(e) => setTask({ ...task, intro: e.target.value })}
            />
            <p className="mt-1.5 text-fs-label text-on-surface-variant">
              已输入 {task.intro?.length ?? 0} 字（建议 100–500 字，不强制格式）
            </p>
          </section>

          {/* 学生可问问题与 AI 回答 */}
          <section id="sec-inquiry" className={card}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className={sectionTitle}>学生可问问题与 AI 回答</h2>
                <p className="mt-0.5 text-fs-label text-on-surface-variant">学生提问命中关键词后，AI 按"回答"内容作答；标记为关键的条目计入覆盖度评分。</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInquiryAiOpen(true)}
                  className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-fs-label font-medium text-on-primary transition hover:opacity-90"
                >
                  <Sparkles className="h-3.5 w-3.5" /> AI 智能填写
                </button>
                <button
                  type="button"
                  onClick={() => setEntries([...entries, { id: `Q${String(entries.length + 1).padStart(2, "0")}`, topic: "", keywords: "", importance: "normal", answer: "" }])}
                  className="flex items-center gap-1 rounded-full bg-surface-container px-3 py-1.5 text-fs-label font-medium text-on-surface transition hover:bg-surface-container-high"
                >
                  <Plus className="h-3.5 w-3.5" /> 添加条目
                </button>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {entries.map((e, i) => (
                <div key={e.id} className="rounded-lg border-neo border-outline-variant/25 bg-surface-container-lowest/40 p-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
                    <input className={field} placeholder="主题（如：光照格局）" value={e.topic} onChange={(ev) => setEntries(entries.map((x, j) => (j === i ? { ...x, topic: ev.target.value } : x)))} />
                    <input className={field} placeholder="触发关键词，顿号分隔" value={e.keywords} onChange={(ev) => setEntries(entries.map((x, j) => (j === i ? { ...x, keywords: ev.target.value } : x)))} />
                    <select className={field} value={e.importance} onChange={(ev) => setEntries(entries.map((x, j) => (j === i ? { ...x, importance: ev.target.value as any } : x)))}>
                      <option value="normal">普通</option>
                      <option value="critical">关键</option>
                    </select>
                    <button type="button" onClick={() => setEntries(entries.filter((_, j) => j !== i))} className="rounded-lg p-2 text-on-surface-variant transition hover:bg-error-container/40 hover:text-error">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea rows={2} className={`${field} mt-2`} placeholder="AI 回答内容" value={e.answer} onChange={(ev) => setEntries(entries.map((x, j) => (j === i ? { ...x, answer: ev.target.value } : x)))} />
                </div>
              ))}
              {entries.length === 0 && <p className="text-fs-label text-on-surface-variant">暂无条目，点击"添加条目"。</p>}
            </div>
          </section>

          {/* 场地诊断表 */}
          <section id="sec-diagnosis" className={card}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className={sectionTitle}>场地诊断表（S1 评分要点）</h2>
                <p className="mt-0.5 text-fs-label text-on-surface-variant">学生按项填写诊断结论；"应提及关键词"命中即该项得分。</p>
              </div>
              <button
                type="button"
                onClick={() => setFields([...fields, { key: `f${fields.length + 1}`, label: "", hint: "", mustMention: "" }])}
                className="flex items-center gap-1 rounded-full bg-surface-container px-3 py-1.5 text-fs-label font-medium text-on-surface transition hover:bg-surface-container-high"
              >
                <Plus className="h-3.5 w-3.5" /> 添加诊断项
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {fields.map((f, i) => (
                <div key={f.key} className="grid gap-2 rounded-lg border-neo border-outline-variant/25 bg-surface-container-lowest/40 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                  <input className={field} placeholder="名称（如：光照格局）" value={f.label} onChange={(ev) => setFields(fields.map((x, j) => (j === i ? { ...x, label: ev.target.value } : x)))} />
                  <input className={field} placeholder="填写提示" value={f.hint} onChange={(ev) => setFields(fields.map((x, j) => (j === i ? { ...x, hint: ev.target.value } : x)))} />
                  <input className={field} placeholder="应提及关键词，顿号分隔" value={f.mustMention} onChange={(ev) => setFields(fields.map((x, j) => (j === i ? { ...x, mustMention: ev.target.value } : x)))} />
                  <button type="button" onClick={() => setFields(fields.filter((_, j) => j !== i))} className="rounded-lg p-2 text-on-surface-variant transition hover:bg-error-container/40 hover:text-error">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {fields.length === 0 && <p className="text-fs-label text-on-surface-variant">暂无诊断项。</p>}
            </div>
          </section>

          {/* 各阶段评分标准 */}
          <section id="sec-rubrics" className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={sectionTitle}>各阶段评分标准</h2>
              <button
                type="button"
                disabled={rubricsLoading}
                onClick={() => void genRubrics()}
                className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-fs-label font-medium text-on-primary transition hover:opacity-90 disabled:opacity-50"
              >
                {rubricsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {rubricsLoading ? "AI 生成中…" : "AI 生成评分标准"}
              </button>
            </div>
            <p className="mt-0.5 text-fs-label text-on-surface-variant">每个流程对应一组评分维度（名称/权重/说明），AI 评阅反馈会结合此处填写的标准生成。可点「AI 生成评分标准」依据上方已填内容自动生成，再手动微调；权重范围 0–100，0 表示不计分。</p>
            <div className="mt-4 space-y-4">
              {Object.entries(STAGE_NAMES).map(([sk, sn]) => (
                <details key={sk} className="rounded-lg border-neo border-outline-variant/25 bg-surface-container-lowest/40 p-3" open={sk === "S1"}>
                  <summary className="cursor-pointer text-fs-label font-medium text-on-surface">
                    {sk} · {sn}（{rubrics[sk]?.length ?? 0} 项）
                  </summary>
                  <div className="mt-3 space-y-2">
                    {(rubrics[sk] ?? []).map((r, i) => (
                      <div key={i} className="grid gap-2 sm:grid-cols-[1fr_90px_2fr_auto]">
                        <input className={field} placeholder="维度名称" value={r.label} onChange={(ev) => setRubrics({ ...rubrics, [sk]: (rubrics[sk] ?? []).map((x, j) => (j === i ? { ...x, label: ev.target.value } : x)) })} />
                        <input type="number" className={field} placeholder="权重" value={r.weight} onChange={(ev) => setRubrics({ ...rubrics, [sk]: (rubrics[sk] ?? []).map((x, j) => (j === i ? { ...x, weight: Number(ev.target.value) } : x)) })} />
                        <input className={field} placeholder="评分说明" value={r.desc} onChange={(ev) => setRubrics({ ...rubrics, [sk]: (rubrics[sk] ?? []).map((x, j) => (j === i ? { ...x, desc: ev.target.value } : x)) })} />
                        <button type="button" onClick={() => setRubrics({ ...rubrics, [sk]: (rubrics[sk] ?? []).filter((_, j) => j !== i) })} className="rounded-lg p-2 text-on-surface-variant transition hover:bg-error-container/40 hover:text-error">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setRubrics({ ...rubrics, [sk]: [...(rubrics[sk] ?? []), { key: `r${(rubrics[sk] ?? []).length + 1}`, label: "", weight: 10, desc: "" }] })}
                      className="flex items-center gap-1 rounded-full bg-surface-container px-3 py-1.5 text-fs-label font-medium text-on-surface transition hover:bg-surface-container-high"
                    >
                      <Plus className="h-3.5 w-3.5" /> 添加维度
                    </button>
                  </div>
                </details>
              ))}
            </div>
          </section>

          <div className="flex items-center gap-3">
            <button type="button" disabled={saving} onClick={() => void save()} className="flex items-center gap-1.5 rounded-full bg-surface-container px-4 py-2 text-fs-body font-medium text-on-surface transition hover:bg-surface-container-high disabled:opacity-50">
              <Save className="h-4 w-4" /> 保存
            </button>
            <button type="button" disabled={saving} onClick={saveAndPublish} className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-fs-body font-medium text-on-primary transition hover:opacity-90 disabled:opacity-50">
              <Send className="h-4 w-4" /> {task.status === "published" ? "保存并更新发布班级" : "保存并发布"}
            </button>
            {msg && <span className={`text-fs-label ${msgTone === "ok" ? "text-success" : "text-error"}`}>{msg}</span>}
          </div>
        </div>
      </div>

      <PublishClassModal
        open={publishOpen}
        taskTitle={task.title}
        initialCodes={task.published_classes ?? []}
        busy={saving}
        onConfirm={(codes) => void confirmPublish(codes)}
        onClose={() => {
          setPublishOpen(false);
          setPendingBody(null);
        }}
      />

      <InquiryAiModal
        open={inquiryAiOpen}
        existingCount={entries.length}
        onApply={applyInquiry}
        onClose={() => setInquiryAiOpen(false)}
      />
    </div>
  );
}
