"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { layerLabel, type QuizQuestion, type Restriction } from "@/lib/types";
import type { Plant } from "@/lib/types";
import {
  Ban,
  CircleCheck,
  FileDown,
  FileUp,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { FIELD_DEFS } from "@/lib/plant-parse";

export interface PlantRow {
  id: string;
  name: string;
  latin: string;
  category: string;
  layer: string;
  isWarning: boolean;
  restriction: string | null;
  quizCount: number;
  updatedAt: string;
  thumbUrl: string;
  data: Plant;
}

const LAYERS = ["tree", "shrub", "herb", "vine", "bamboo"] as const;
const FALLBACK_DIMENSIONS = ["光照习性", "水分习性", "土壤要求", "观赏与季相", "配置方式", "安全应用"];

// ---- 智能识别结果类型 ----
interface ParseApiResult {
  fields: Record<string, unknown>;
  invalid: { field: string; reason: string }[];
  unparsed: string[];
  needsCheck: { field: string; label: string; note: string }[];
  questions: QuizQuestion[];
  droppedQuestions: { index: number; reason: string }[];
}

interface Conflict {
  key: string;
  label: string;
  current: string;
  suggested: unknown;
  suggestedDisplay: string;
}

interface ParseSummary {
  filled: number;
  conflicts: Conflict[];
  unparsed: string[];
  invalid: { field: string; reason: string }[];
  needsCheck: { field: string; label: string; note: string }[];
}

/** 字段 key → 表单元素 name（不在表内的字段走 editing 状态） */
const FORM_NAMES: Record<string, string> = {
  name: "name",
  latin: "latin",
  alias: "alias",
  category: "category",
  layer: "layer",
  "light.text": "lightText",
  "light.need": "lightNeed",
  "water.text": "waterText",
  "water.need": "waterNeed",
  "soil.text": "soilText",
  "hardiness.text": "hardinessText",
  "height.text": "heightText",
  ornamentalPart: "ornamentalPart",
  color: "color",
  usage: "usage",
  region: "region",
  "phenology.flowerMonths": "flowerMonths",
  "phenology.fruitMonths": "fruitMonths",
  isWarning: "isWarning",
  "warning.restriction": "restriction",
  "warning.riskType": "riskType",
  "warning.riskPart": "riskPart",
  "warning.symptom": "symptom",
  "warning.consequence": "consequence",
};

const EXTRA_LABELS: Record<string, string> = { "height.min": "高度下限", "height.max": "高度上限" };
const SEASON_LABELS: Record<string, string> = { spring: "春", summer: "夏", autumn: "秋", winter: "冬" };

function parseFieldLabel(key: string): string {
  return FIELD_DEFS.find((d) => d.key === key)?.label ?? EXTRA_LABELS[key] ?? key;
}

function displayValue(v: unknown): string {
  if (Array.isArray(v)) return v.join("、");
  if (typeof v === "boolean") return v ? "是" : "否";
  if (v && typeof v === "object") {
    return Object.entries(v as Record<string, number>)
      .map(([k, n]) => `${SEASON_LABELS[k] ?? k} ${n}`)
      .join(" / ");
  }
  return String(v ?? "");
}

function toFormValue(key: string, v: unknown): string {
  if (key === "isWarning") return v === true ? "yes" : "no";
  if (Array.isArray(v)) return v.join("、");
  return String(v ?? "");
}

function getEditingPath(p: Plant, key: string): unknown {
  switch (key) {
    case "soil.ph": return p.soil.ph;
    case "soil.drainage": return p.soil.drainage;
    case "soil.tolerant": return p.soil.tolerant;
    case "hardiness.minTempC": return p.hardiness.minTempC;
    case "hardiness.zoneMin": return p.hardiness.zoneMin;
    case "hardiness.zoneMax": return p.hardiness.zoneMax;
    case "height.min": return p.height?.min;
    case "height.max": return p.height?.max;
    case "phenology.peakSeason": return p.phenology.peakSeason;
    case "phenology.seasonInterest": return p.phenology.seasonInterest;
    case "phenology.evergreen": return p.phenology.evergreen;
    case "phenology.deciduous": return p.phenology.deciduous;
    case "phenology.autumnColor": return p.phenology.autumnColor;
    case "light.shadeTolerant": return p.light.shadeTolerant;
    case "water.avoidWaterlog": return p.water.avoidWaterlog;
    case "tagGroups": return p.tagGroups;
    case "functionTags": return p.functionTags;
    case "regionTags": return p.regionTags;
    case "lifeForm": return p.lifeForm;
    default: return undefined;
  }
}

function applyEditingPath(p: Plant, key: string, v: unknown): Plant {
  switch (key) {
    case "soil.ph": return { ...p, soil: { ...p.soil, ph: v as Plant["soil"]["ph"] } };
    case "soil.drainage": return { ...p, soil: { ...p.soil, drainage: v as Plant["soil"]["drainage"] } };
    case "soil.tolerant": return { ...p, soil: { ...p.soil, tolerant: v as boolean } };
    case "hardiness.minTempC": return { ...p, hardiness: { ...p.hardiness, minTempC: v as number } };
    case "hardiness.zoneMin": return { ...p, hardiness: { ...p.hardiness, zoneMin: v as number } };
    case "hardiness.zoneMax": return { ...p, hardiness: { ...p.hardiness, zoneMax: v as number } };
    case "height.min": return { ...p, height: { ...(p.height ?? { text: "" }), min: v as number } };
    case "height.max": return { ...p, height: { ...(p.height ?? { text: "" }), max: v as number } };
    case "phenology.peakSeason": return { ...p, phenology: { ...p.phenology, peakSeason: v as Plant["phenology"]["peakSeason"] } };
    case "phenology.seasonInterest": return { ...p, phenology: { ...p.phenology, seasonInterest: v as Plant["phenology"]["seasonInterest"] } };
    case "phenology.evergreen": return { ...p, phenology: { ...p.phenology, evergreen: v as boolean } };
    case "phenology.deciduous": return { ...p, phenology: { ...p.phenology, deciduous: v as boolean } };
    case "phenology.autumnColor": return { ...p, phenology: { ...p.phenology, autumnColor: v as boolean } };
    case "light.shadeTolerant": return { ...p, light: { ...p.light, shadeTolerant: v as boolean } };
    case "water.avoidWaterlog": return { ...p, water: { ...p.water, avoidWaterlog: v as boolean } };
    case "tagGroups": return { ...p, tagGroups: v as string[] };
    case "functionTags": return { ...p, functionTags: v as string[] };
    case "regionTags": return { ...p, regionTags: v as string[] };
    case "lifeForm": return { ...p, lifeForm: v as string };
    default: return p;
  }
}

function emptyPlant(): Plant {
  return {
    id: "",
    name: "",
    latin: "",
    alias: [],
    category: "",
    layer: "tree",
    functionTags: [],
    tagGroups: [],
    regionTags: [],
    light: { text: "", need: "" },
    water: { text: "", need: "" },
    soil: { text: "", ph: "", drainage: "" },
    hardiness: { text: "" },
    phenology: {
      text: "",
      flowerMonths: [],
      fruitMonths: [],
      seasonInterest: { spring: 0, summer: 0, autumn: 0, winter: 0 },
      peakSeason: "",
    },
    usage: [],
    images: { full: "", close: "", thumb: "" },
    isWarning: false,
    warning: null,
    safeForChildren: true,
    quiz: [],
  };
}

function toList(text: string): string[] {
  return text.split(/[,，、\s]+/).filter(Boolean);
}

function monthsOf(text: string): number[] {
  return toList(text)
    .map((t) => parseInt(t, 10))
    .filter((n) => !Number.isNaN(n) && n >= 1 && n <= 12);
}

function cloneQuiz(quiz: QuizQuestion[] | undefined | null): QuizQuestion[] {
  return JSON.parse(JSON.stringify(quiz ?? [])) as QuizQuestion[];
}

function genQid(): string {
  return `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function newQuestion(dimensions: string[]): QuizQuestion {
  return {
    qid: genQid(),
    q: "",
    dimension: dimensions[0] ?? "",
    options: ["", "", "", ""],
    answerIndex: 0,
    explain: "",
  };
}

/** 保存前清洗：补 qid、裁 4 选项、收敛 answerIndex；空题干题由校验拦截 */
function cleanQuiz(quiz: QuizQuestion[]): QuizQuestion[] {
  return quiz.map((qq) => {
    const options = [...(qq.options ?? [])].map((o) => (o ?? "").trim());
    while (options.length < 4) options.push("");
    return {
      ...qq,
      qid: typeof qq.qid === "string" && qq.qid ? qq.qid : genQid(),
      q: (qq.q ?? "").trim(),
      dimension: (qq.dimension ?? "").trim(),
      options: options.slice(0, 4),
      answerIndex: Math.min(3, Math.max(0, Number(qq.answerIndex) || 0)),
      explain: (qq.explain ?? "").trim(),
    };
  });
}

function validateQuiz(quiz: QuizQuestion[]): string | null {
  if (!quiz.length) return "该植物至少需保留 1 道练习题";
  for (let i = 0; i < quiz.length; i += 1) {
    const qq = quiz[i];
    const no = i + 1;
    if (!(qq.dimension ?? "").trim()) return `第 ${no} 题：请选择维度`;
    if (!(qq.q ?? "").trim()) return `第 ${no} 题：题干不能为空`;
    const options = [...(qq.options ?? [])].map((o) => (o ?? "").trim());
    for (let oi = 0; oi < 4; oi += 1) {
      if (!options[oi]) return `第 ${no} 题：选项 ${"ABCD"[oi]} 不能为空`;
    }
    const answerIndex = Number(qq.answerIndex);
    if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) {
      return `第 ${no} 题：请标记正确答案`;
    }
  }
  return null;
}

export default function PlantsAdminClient({
  rows,
  categories,
  quizDimensions,
  passRatio,
}: {
  rows: PlantRow[];
  categories: string[];
  quizDimensions?: string[];
  passRatio: number;
}) {
  const router = useRouter();
  const dimensions = quizDimensions?.length ? quizDimensions : FALLBACK_DIMENSIONS;

  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [layer, setLayer] = useState("");
  const [safety, setSafety] = useState("");
  const [editing, setEditing] = useState<Plant | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // ---- 智能识别 ----
  const [parseText, setParseText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseSummary, setParseSummary] = useState<ParseSummary | null>(null);
  const [pendingQs, setPendingQs] = useState<QuizQuestion[]>([]);
  const [droppedQs, setDroppedQs] = useState<{ index: number; reason: string }[]>([]);
  const [adoptMsg, setAdoptMsg] = useState<string | null>(null);
  const pendingAdoptRef = useRef<QuizQuestion[] | null>(null);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (category && r.category !== category) return false;
      if (layer && r.layer !== layer) return false;
      if (safety === "safe" && r.isWarning) return false;
      if (safety && safety !== "safe" && (!r.isWarning || r.restriction !== safety)) return false;
      if (!kw) return true;
      return (
        r.name.toLowerCase().includes(kw) ||
        r.latin.toLowerCase().includes(kw) ||
        r.id.toLowerCase().includes(kw)
      );
    });
  }, [rows, q, category, layer, safety]);

  // ---- 选中植物与题目草稿（右栏）----
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const resolvedId =
    selectedId && rows.some((r) => r.id === selectedId)
      ? selectedId
      : filtered[0]?.id ?? null;
  const selectedRow = useMemo(() => rows.find((r) => r.id === resolvedId) ?? null, [rows, resolvedId]);

  const [quiz, setQuiz] = useState<QuizQuestion[]>(() => cloneQuiz(selectedRow?.data.quiz));
  const [quizError, setQuizError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingQuiz, setSavingQuiz] = useState(false);
  // 卡片分页：只切索引，草稿统一由 quiz 数组持有
  const [currentIdx, setCurrentIdx] = useState(0);
  const [slideDir, setSlideDir] = useState<"next" | "prev" | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const savedQuizJson = useMemo(() => JSON.stringify(selectedRow?.data.quiz ?? []), [selectedRow]);
  const dirty = selectedRow !== null && JSON.stringify(quiz) !== savedQuizJson;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    setQuiz(cloneQuiz(selectedRow?.data.quiz));
    setQuizError(null);
    setSaveMsg(null);
    setCurrentIdx(0);
    setSlideDir(null);
    // 从弹层「采用」切回目标植物时，把待追加题目并入草稿
    if (pendingAdoptRef.current) {
      const extra = pendingAdoptRef.current;
      pendingAdoptRef.current = null;
      setQuiz((prev) => [...prev, ...extra]);
    }
    // 仅在切换植物时重载题目；保存后的 rows 刷新不覆盖草稿
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedId]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // 弹层开关/目标变化时重置智能识别状态
  const editingKey = editing === null ? "closed" : editing.id;
  useEffect(() => {
    setParseText("");
    setParseError(null);
    setParseSummary(null);
    setPendingQs([]);
    setDroppedQs([]);
    setAdoptMsg(null);
  }, [editingKey]);

  // ---- 卡片分页导航 ----
  const savedQuiz = useMemo(() => cloneQuiz(selectedRow?.data.quiz ?? []), [selectedRow]);
  const safeIdx = quiz.length ? Math.min(currentIdx, quiz.length - 1) : 0;
  const isQuestionDirty = (i: number) =>
    JSON.stringify(quiz[i] ?? null) !== JSON.stringify(savedQuiz[i] ?? null);

  function goTo(i: number) {
    if (!quiz.length) return;
    const next = Math.max(0, Math.min(quiz.length - 1, i));
    if (next === safeIdx) return;
    setSlideDir(next > safeIdx ? "next" : "prev");
    setCurrentIdx(next);
  }

  function step(delta: number) {
    goTo(safeIdx + delta);
  }

  function finishPaging() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }

  function selectRow(id: string) {
    if (id === resolvedId) return;
    if (dirtyRef.current && !window.confirm("当前植物的题目修改尚未保存，切换将丢失修改。仍要切换吗？")) return;
    setSelectedId(id);
  }

  function updateQuestion(i: number, patch: Partial<QuizQuestion>) {
    setQuizError(null);
    setQuiz((prev) => prev.map((qq, idx) => (idx === i ? { ...qq, ...patch } : qq)));
  }

  function updateOption(i: number, oi: number, val: string) {
    setQuizError(null);
    setQuiz((prev) =>
      prev.map((qq, idx) => {
        if (idx !== i) return qq;
        const options = [...(qq.options ?? [])];
        while (options.length < 4) options.push("");
        options[oi] = val;
        return { ...qq, options };
      }),
    );
  }

  function addQuestion() {
    setQuizError(null);
    setQuiz((prev) => [...prev, newQuestion(dimensions)]);
    // 新增后跳到末尾新题
    setSlideDir("next");
    setCurrentIdx(quiz.length);
  }

  function removeQuestion(i: number) {
    if (quiz.length <= 1) {
      setQuizError("该植物至少需保留 1 道练习题");
      return;
    }
    if (!window.confirm(`删除第 ${i + 1} 题？学生该题的历史答题记录将不再计入掌握判定。`)) return;
    setQuizError(null);
    setQuiz((prev) => prev.filter((_, idx) => idx !== i));
    const len = quiz.length - 1;
    const next = currentIdx > i ? currentIdx - 1 : currentIdx;
    setSlideDir(null);
    setCurrentIdx(Math.max(0, Math.min(len - 1, next)));
  }

  async function saveQuiz() {
    if (!selectedRow) return;
    const err = validateQuiz(quiz);
    if (err) {
      setQuizError(err);
      setSaveMsg(null);
      return;
    }
    const cleaned = cleanQuiz(quiz);
    setSavingQuiz(true);
    setQuizError(null);
    setSaveMsg(null);
    try {
      const plant: Plant = { ...selectedRow.data, quiz: cleaned };
      const res = await fetch("/api/admin/plants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plant }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "保存失败");
      }
      setQuiz(cleaned);
      setSaveMsg({ ok: true, text: `已保存 ${cleaned.length} 道题目` });
      router.refresh();
    } catch (e) {
      setSaveMsg({ ok: false, text: e instanceof Error ? e.message : "保存失败" });
    } finally {
      setSavingQuiz(false);
    }
  }

  // ---- 植物档案编辑（原弹层，题目改到右栏）----
  function nextSeq(): number {
    return rows.reduce((m, r) => Math.max(m, r.data.seq ?? 0), 0) + 1;
  }

  function openNew() {
    const seq = nextSeq();
    setEditing({ ...emptyPlant(), id: `p${String(seq).padStart(3, "0")}`, seq });
  }

  function openEdit(row: PlantRow) {
    setEditing(JSON.parse(JSON.stringify(row.data)) as Plant);
  }

  async function save() {
    if (!editing || !formRef.current) return;
    const f = formRef.current!.elements as unknown as Record<
      string,
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >;
    const plant: Plant = {
      ...editing,
      id: f.plantId.value.trim(),
      seq: rows.some((r) => r.id === editing.id) ? editing.seq : nextSeq(),
      name: f.name.value.trim(),
      latin: f.latin.value.trim(),
      alias: toList(f.alias.value),
      category: f.category.value.trim(),
      layer: f.layer.value as Plant["layer"],
      light: { ...editing.light, text: f.lightText.value.trim(), need: f.lightNeed.value.trim() },
      water: { ...editing.water, text: f.waterText.value.trim(), need: f.waterNeed.value.trim() },
      soil: { ...editing.soil, text: f.soilText.value.trim() },
      hardiness: { ...editing.hardiness, text: f.hardinessText.value.trim() },
      height: { ...editing.height, text: f.heightText.value.trim() },
      ornamentalPart: f.ornamentalPart.value.trim(),
      color: f.color.value.trim(),
      usage: toList(f.usage.value),
      region: f.region.value.trim(),
      phenology: {
        ...editing.phenology,
        flowerMonths: monthsOf(f.flowerMonths.value),
        fruitMonths: monthsOf(f.fruitMonths.value),
      },
      isWarning: f.isWarning.value === "yes",
      warning:
        f.isWarning.value === "yes"
          ? {
              restriction: f.restriction.value as Restriction,
              riskLevel: f.restriction.value === "forbid" ? "禁止" : "慎用",
              riskType: String(f.riskType.value).trim(),
              riskPart: f.riskPart.value.trim(),
              symptom: f.symptom.value.trim(),
              consequence: f.consequence.value.trim(),
              identify: f.identify.value.trim(),
              teachUse: f.teachUse.value.trim(),
            }
          : null,
      safeForChildren: f.safeForChildren.value === "yes",
      // 编辑对象即当前选中植物时，以右栏题目草稿为准，避免弹层保存回退已采用/已编辑的题目
      quiz: editing.id === resolvedId ? quiz : editing.quiz,
    };
    if (!plant.id || !plant.name) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/plants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plant }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "保存失败");
      }
      setEditing(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: PlantRow) {
    if (!window.confirm(`确认删除「${row.name}」？该操作不可恢复。`)) return;
    const res = await fetch(`/api/admin/plants/${row.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      window.alert(body.error ?? "删除失败");
      return;
    }
    if (row.id === resolvedId) setSelectedId(null);
    router.refresh();
  }

  async function uploadImage(file: File, kind: "full" | "close") {
    if (!editing) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("plantId", editing.id || "draft");
    fd.append("kind", kind);
    const res = await fetch("/api/admin/upload-image", { method: "POST", body: fd });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      window.alert(body.error ?? "上传失败");
      return;
    }
    const body = (await res.json()) as { path: string; thumbPath?: string };
    setEditing((prev) =>
      prev
        ? {
            ...prev,
            images: {
              ...prev.images,
              [kind]: body.path,
              ...(kind === "full" && body.thumbPath ? { thumb: body.thumbPath } : {}),
            },
          }
        : prev,
    );
  }

  // ---- 智能识别：读取/写入当前字段值 ----
  function readCurrent(key: string): { empty: boolean; display: string } {
    const formName = FORM_NAMES[key];
    if (formName) {
      const el = formRef.current?.elements.namedItem(formName) as
        | HTMLInputElement
        | HTMLSelectElement
        | null;
      const raw = el?.value ?? "";
      // 下拉默认值视为未填
      if (key === "isWarning" && raw === "no") return { empty: true, display: "" };
      if (key === "warning.restriction" && raw === "caution") return { empty: true, display: "" };
      return { empty: raw.trim() === "", display: raw };
    }
    if (!editing) return { empty: true, display: "" };
    const v = getEditingPath(editing, key);
    const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
    return { empty, display: empty ? "" : displayValue(v) };
  }

  function applyField(key: string, value: unknown) {
    const formName = FORM_NAMES[key];
    if (formName) {
      const el = formRef.current?.elements.namedItem(formName) as
        | HTMLInputElement
        | HTMLSelectElement
        | null;
      if (el) el.value = toFormValue(key, value);
      return;
    }
    setEditing((prev) => (prev ? applyEditingPath(prev, key, value) : prev));
  }

  function applyParseResult(data: ParseApiResult) {
    if (!editing) return;
    let filled = 0;
    const conflicts: Conflict[] = [];
    for (const [key, value] of Object.entries(data.fields)) {
      if (key === "safeForChildren") continue; // 安全字段永不自动填充
      const label = parseFieldLabel(key);
      const cur = readCurrent(key);
      const formName = FORM_NAMES[key];
      const suggestedDisplay = formName ? toFormValue(key, value) : displayValue(value);
      if (cur.empty) {
        applyField(key, value);
        filled += 1;
      } else if (cur.display !== suggestedDisplay) {
        conflicts.push({ key, label, current: cur.display, suggested: value, suggestedDisplay });
      }
    }
    setParseSummary({
      filled,
      conflicts,
      unparsed: data.unparsed,
      invalid: data.invalid,
      needsCheck: data.needsCheck,
    });
    setPendingQs(data.questions.map((qq) => ({ ...qq, qid: genQid() })));
    setDroppedQs(data.droppedQuestions);
    setAdoptMsg(null);
  }

  async function runParse() {
    const text = parseText.trim();
    if (!text) {
      setParseError("请先填写要识别的植物资料");
      return;
    }
    setParsing(true);
    setParseError(null);
    setParseSummary(null);
    setPendingQs([]);
    setDroppedQs([]);
    setAdoptMsg(null);
    try {
      const res = await fetch("/api/admin/plants/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json().catch(() => ({}))) as ParseApiResult & { message?: string };
      if (!res.ok) throw new Error(data.message ?? `识别失败（${res.status}）`);
      applyParseResult(data);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "识别失败，表单内容未改动");
    } finally {
      setParsing(false);
    }
  }

  function adoptConflict(c: Conflict) {
    applyField(c.key, c.suggested);
    setParseSummary((prev) =>
      prev ? { ...prev, conflicts: prev.conflicts.filter((x) => x.key !== c.key) } : prev,
    );
  }

  function updatePendingQ(idx: number, patch: Partial<QuizQuestion>) {
    setPendingQs((prev) => prev.map((qq, i) => (i === idx ? { ...qq, ...patch } : qq)));
  }

  function adoptQuestions(qs: QuizQuestion[]) {
    if (!editing || qs.length === 0) return;
    if (!editing.id) {
      setEditing({ ...editing, quiz: [...(editing.quiz ?? []), ...qs] });
      setAdoptMsg(`已采用 ${qs.length} 道题，点「保存」随新植物一起入库`);
    } else if (editing.id === resolvedId) {
      setQuiz((prev) => [...prev, ...qs]);
      setAdoptMsg(`已加入右栏题目草稿 ${qs.length} 道题，点右栏「保存」后入库`);
    } else {
      if (dirtyRef.current && !window.confirm("右栏当前植物的题目有未保存修改，切换将丢失。仍要切换吗？")) return;
      pendingAdoptRef.current = qs;
      setSelectedId(editing.id);
      setAdoptMsg(`已为「${editing.name}」加入题目草稿 ${qs.length} 道题`);
    }
    const ids = new Set(qs.map((x) => x.qid));
    setPendingQs((prev) => prev.filter((x) => !ids.has(x.qid)));
  }

  async function onImportFile(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text) as { plants?: unknown } | unknown[];
      const plants = Array.isArray(json) ? json : json.plants;
      if (!Array.isArray(plants)) throw new Error("文件缺少 plants 数组");
      const res = await fetch("/api/admin/plants/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plants }),
      });
      const body = (await res.json()) as { imported?: number; skipped?: number; error?: string };
      if (!res.ok) throw new Error(body.error ?? "导入失败");
      window.alert(`导入完成：新增 ${body.imported ?? 0} 条，跳过已存在 ${body.skipped ?? 0} 条`);
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "导入失败");
    } finally {
      setImporting(false);
    }
  }

  // ---- 掌握判定阈值设置 ----
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ratioInput, setRatioInput] = useState(String(Math.round(passRatio * 100)));
  const [ratioMsg, setRatioMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [ratioSaving, setRatioSaving] = useState(false);
  const [ratioNow, setRatioNow] = useState(passRatio);

  // 键盘 ←/→ 切题：焦点在输入控件内或弹层打开时不触发
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (editing !== null || settingsOpen) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)
      ) {
        return;
      }
      if (!quiz.length) return;
      e.preventDefault();
      step(e.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz.length, safeIdx, editing, settingsOpen]);

  async function saveRatio() {
    const value = Number(ratioInput);
    if (!Number.isFinite(value)) {
      setRatioMsg({ ok: false, text: "请输入数字（50–100）" });
      return;
    }
    setRatioSaving(true);
    setRatioMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ masteryPassRatio: value / 100 }),
      });
      const body = (await res.json().catch(() => ({}))) as { masteryPassRatio?: number; error?: string };
      if (!res.ok) throw new Error(body.error ?? "保存失败");
      setRatioNow(body.masteryPassRatio ?? value / 100);
      setRatioMsg({ ok: true, text: "已保存，学生端判定即时生效" });
    } catch (e) {
      setRatioMsg({ ok: false, text: e instanceof Error ? e.message : "保存失败" });
    } finally {
      setRatioSaving(false);
    }
  }

  const field =
    "w-full rounded-md border-neo border-outline-variant/30 bg-surface px-3 py-2 text-fs-body text-on-surface focus:border-primary focus:outline-none";
  const selectCls = `${field} h-10 w-auto`;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border-neo border-primary/20 bg-primary-container/25 shadow-leaf">
        <div className="h-1.5 bg-primary" />
        <div className="flex flex-wrap items-center gap-3 p-5">
        <div className="relative min-w-[var(--size-col-filter)] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索名称 / 拉丁名 / 编号"
            className="h-10 w-full rounded-md border-neo border-outline-variant/30 bg-surface pl-9 pr-3 text-fs-sub text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none"
          />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls}>
          <option value="">全部分类</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={layer} onChange={(e) => setLayer(e.target.value)} className={selectCls}>
          <option value="">全部层级</option>
          {LAYERS.map((l) => (
            <option key={l} value={l}>
              {layerLabel(l as Plant["layer"])}
            </option>
          ))}
        </select>
        <select value={safety} onChange={(e) => setSafety(e.target.value)} className={selectCls}>
          <option value="">全部安全状态</option>
          <option value="safe">安全</option>
          <option value="caution">慎用</option>
          <option value="forbid">禁植</option>
        </select>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setRatioInput(String(Math.round(ratioNow * 100)));
              setRatioMsg(null);
              setSettingsOpen(true);
            }}
            className="flex h-10 items-center gap-2 rounded-md border-neo border-outline-variant/30 px-4 text-fs-sub font-medium text-on-surface transition-colors hover:bg-surface-container"
          >
            <Settings2 className="h-4 w-4" />
            掌握判定
          </button>
          <button
            type="button"
            disabled={importing}
            onClick={() => importRef.current?.click()}
            className="flex h-10 items-center gap-2 rounded-md border-neo border-outline-variant/30 px-4 text-fs-sub font-medium text-on-surface transition-colors hover:bg-surface-container disabled:opacity-50"
          >
            {importing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            批量导入
          </button>
          <button
            type="button"
            onClick={() => window.open("/api/admin/plants", "_blank")}
            className="flex h-10 items-center gap-2 rounded-md border-neo border-outline-variant/30 px-4 text-fs-sub font-medium text-on-surface transition-colors hover:bg-surface-container"
          >
            <FileDown className="h-4 w-4" />
            导出 JSON
          </button>
          <button
            type="button"
            onClick={openNew}
            className="flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-fs-sub font-medium text-on-primary shadow-card transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            新增植物
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onImportFile(file);
              e.target.value = "";
            }}
          />
        </div>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(320px,5fr)_minmax(0,7fr)]">
        {/* 左栏：植物列表 */}
        <div className="min-w-0 overflow-hidden rounded-xl border-neo border-water/25 bg-water-container/35 shadow-leaf">
          <div className="h-1.5 bg-water" />
          <div className="h-[var(--size-pane-md)] overflow-y-auto lg:h-[var(--size-panel-vh-admin)]">
            <ul className="divide-y divide-outline-variant/20">
              {filtered.map((row) => {
                const active = row.id === resolvedId;
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => selectRow(row.id)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                        active ? "bg-primary-container/40" : "hover:bg-surface-container/40"
                      }`}
                    >
                      {row.thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={row.thumbUrl}
                          alt={row.name}
                          className="h-10 w-10 shrink-0 rounded-lg bg-surface-container object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 shrink-0 rounded-lg bg-surface-container" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className={`truncate text-fs-body font-medium ${active ? "text-foreground" : "text-on-surface"}`}>
                            {row.name}
                          </p>
                          {row.isWarning ? (
                            row.restriction === "forbid" ? (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-error/10 px-2 py-0.5 text-fs-label font-medium text-error">
                                <Ban className="h-3 w-3" />
                                禁植
                              </span>
                            ) : (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-fs-label font-medium text-warning">
                                <TriangleAlert className="h-3 w-3" />
                                慎用
                              </span>
                            )
                          ) : (
                            <span className="inline-flex shrink-0 items-center gap-1 text-fs-label text-success">
                              <CircleCheck className="h-3.5 w-3.5" />
                              安全
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-fs-label text-on-surface-variant">
                          {row.category} · {layerLabel(row.layer as Plant["layer"])} · 更新于 {row.updatedAt || "—"}
                        </p>
                      </div>
                      <span className="flex shrink-0 items-center">
                        <span
                          role="button"
                          aria-label="编辑植物档案"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(row);
                          }}
                          className="rounded-md p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                        </span>
                        <span
                          role="button"
                          aria-label="删除植物"
                          onClick={(e) => {
                            e.stopPropagation();
                            void remove(row);
                          }}
                          className="rounded-md p-1.5 text-on-surface-variant transition-colors hover:bg-error/10 hover:text-error"
                        >
                          <Trash2 className="h-4 w-4" />
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {!filtered.length && (
                <li className="px-4 py-10 text-center text-fs-sub text-on-surface-variant">没有符合条件的植物</li>
              )}
            </ul>
          </div>
        </div>

        {/* 右栏：所选植物的练习题（卡片分页，一屏一题） */}
        <div className="min-w-0 overflow-hidden rounded-xl border-neo border-sun/25 bg-sun-container/35 shadow-leaf">
          <div className="h-1.5 bg-sun" />
          <div className="flex h-[var(--size-pane-lg)] flex-col p-5 lg:h-[var(--size-panel-vh-admin)] lg:p-6">
          {!selectedRow ? (
            <div className="py-16 text-center text-fs-sub text-on-surface-variant">从左侧选择植物，查看并编辑它的练习题</div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="flex shrink-0 flex-wrap items-center gap-3 border-b-neo border-outline-variant/20 pb-3">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-fs-section font-medium text-on-surface">
                    {selectedRow.name} · 练习题
                    {dirty && <span className="ml-2 align-middle text-fs-label text-warning">● 未保存</span>}
                  </h2>
                  <p className="mt-0.5 text-fs-label text-on-surface-variant">
                    共 {quiz.length} 题 · 掌握判定：错题订正率达到 {Math.round(ratioNow * 100)}% 即判为已掌握
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addQuestion}
                  className="flex h-9 items-center gap-1.5 rounded-md border-neo border-outline-variant/30 px-3 text-fs-sub font-medium text-on-surface transition-colors hover:bg-surface-container"
                >
                  <Plus className="h-4 w-4" />
                  新增题目
                </button>
                <button
                  type="button"
                  disabled={!dirty || savingQuiz}
                  onClick={() => void saveQuiz()}
                  className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-fs-sub font-medium text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {savingQuiz ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  保存题目
                </button>
              </div>

              {quiz.length > 0 && (
                <div className="shrink-0 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="shrink-0 text-fs-label font-medium text-on-surface-variant">
                      第 {safeIdx + 1} / {quiz.length} 题
                    </span>
                    <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto pb-1">
                      {quiz.length <= 15
                        ? quiz.map((qq, i) => (
                            <button
                              key={qq.qid ?? i}
                              type="button"
                              onClick={() => goTo(i)}
                              aria-label={`跳到第 ${i + 1} 题`}
                              className={`h-7 w-7 shrink-0 rounded-md text-fs-label font-medium transition-colors ${
                                i === safeIdx
                                  ? "bg-primary text-on-primary"
                                  : isQuestionDirty(i)
                                    ? "border-neo border-warning/50 bg-warning/10 text-warning hover:bg-warning/20"
                                    : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                              }`}
                            >
                              {i + 1}
                            </button>
                          ))
                        : quiz.map((qq, i) => (
                            <button
                              key={qq.qid ?? i}
                              type="button"
                              onClick={() => goTo(i)}
                              aria-label={`跳到第 ${i + 1} 题`}
                              className={`h-2.5 shrink-0 rounded-full transition-all ${
                                i === safeIdx
                                  ? "w-5 bg-primary"
                                  : isQuestionDirty(i)
                                    ? "w-2.5 bg-warning"
                                    : "w-2.5 bg-outline-variant/50 hover:bg-on-surface-variant/40"
                              }`}
                            />
                          ))}
                    </div>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-surface-container">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${((safeIdx + 1) / quiz.length) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {quizError && (
                <p className="rounded-md bg-error/10 px-3 py-2 text-fs-label font-medium text-error">{quizError}</p>
              )}
              {saveMsg && (
                <p
                  className={`rounded-md px-3 py-2 text-fs-label font-medium ${
                    saveMsg.ok ? "bg-success/10 text-success" : "bg-error/10 text-error"
                  }`}
                >
                  {saveMsg.text}
                </p>
              )}

              {quiz.length === 0 ? (
                <div className="rounded-md bg-surface-container/50 px-4 py-8 text-center">
                  <p className="text-fs-body text-on-surface">该植物还没有练习题</p>
                  <p className="mt-1 text-fs-label text-on-surface-variant">点击「新增题目」为学生出题，保存后立即在学生端生效</p>
                </div>
              ) : (
                (() => {
                  const i = safeIdx;
                  const qq = quiz[i];
                  return (
                    <>
                      <div
                        className="relative min-h-0 flex-1"
                        onTouchStart={(e) => {
                          const t = e.touches[0];
                          touchStart.current = { x: t.clientX, y: t.clientY };
                        }}
                        onTouchEnd={(e) => {
                          const s = touchStart.current;
                          touchStart.current = null;
                          if (!s) return;
                          const t = e.changedTouches[0];
                          const dx = t.clientX - s.x;
                          const dy = t.clientY - s.y;
                          if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.2) step(dx < 0 ? 1 : -1);
                        }}
                      >
                        <div
                          key={safeIdx}
                          className={`h-full space-y-2 overflow-y-auto rounded-lg border-neo border-sun/25 bg-surface p-5 shadow-card ${
                            slideDir === "next" ? "animate-qcard-next" : slideDir === "prev" ? "animate-qcard-prev" : ""
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={qq.dimension ?? ""}
                              onChange={(e) => updateQuestion(i, { dimension: e.target.value })}
                              className="h-9 rounded-md border-neo border-outline-variant/30 bg-surface px-2 text-fs-label text-on-surface focus:border-primary focus:outline-none"
                            >
                              <option value="" disabled>
                                选择维度
                              </option>
                              {dimensions.map((d) => (
                                <option key={d} value={d}>
                                  {d}
                                </option>
                              ))}
                            </select>
                            {isQuestionDirty(i) && (
                              <span className="text-fs-label font-medium text-warning">● 本题已修改未保存</span>
                            )}
                            <button
                              type="button"
                              onClick={() => removeQuestion(i)}
                              className="ml-auto flex h-8 items-center gap-1 rounded-md px-2 text-fs-label font-medium text-on-surface-variant transition-colors hover:bg-error/10 hover:text-error"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              删除
                            </button>
                          </div>
                          <textarea
                            value={qq.q ?? ""}
                            onChange={(e) => updateQuestion(i, { q: e.target.value })}
                            placeholder="题干"
                            rows={2}
                            className={field}
                          />
                          <div className="grid gap-2 sm:grid-cols-2">
                            {[0, 1, 2, 3].map((oi) => (
                              <div key={oi} className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`answer-${qq.qid ?? i}`}
                                  checked={Number(qq.answerIndex) === oi}
                                  onChange={() => updateQuestion(i, { answerIndex: oi })}
                                  aria-label={`正确答案 ${"ABCD"[oi]}`}
                                  className="h-4 w-4 shrink-0 accent-primary"
                                />
                                <input
                                  value={qq.options?.[oi] ?? ""}
                                  onChange={(e) => updateOption(i, oi, e.target.value)}
                                  placeholder={`选项 ${"ABCD"[oi]}`}
                                  className={field}
                                />
                              </div>
                            ))}
                          </div>
                          <input
                            value={qq.explain ?? ""}
                            onChange={(e) => updateQuestion(i, { explain: e.target.value })}
                            placeholder="解析（答题后展示）"
                            className={field}
                          />
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center justify-between gap-2 border-t-neo border-outline-variant/20 pt-3">
                        <button
                          type="button"
                          disabled={safeIdx === 0}
                          onClick={() => step(-1)}
                          className="flex h-9 items-center gap-1 rounded-md border-neo border-outline-variant/30 px-3 text-fs-sub font-medium text-on-surface transition-colors hover:bg-surface-container disabled:opacity-40"
                        >
                          上一题
                        </button>
                        <span className="hidden text-fs-label text-on-surface-variant sm:block">
                          可用 ← → 键或左右滑动切题
                        </span>
                        {safeIdx === quiz.length - 1 ? (
                          <button
                            type="button"
                            onClick={finishPaging}
                            className="flex h-9 items-center gap-1 rounded-md bg-primary px-4 text-fs-sub font-medium text-on-primary transition-colors hover:bg-primary/90"
                          >
                            完成
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => step(1)}
                            className="flex h-9 items-center gap-1 rounded-md border-neo border-outline-variant/30 px-3 text-fs-sub font-medium text-on-surface transition-colors hover:bg-surface-container"
                          >
                            下一题
                          </button>
                        )}
                      </div>
                    </>
                  );
                })()
              )}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* 掌握判定设置 */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>掌握判定 · 错题订正率</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-fs-sub text-on-surface-variant">
              学生把某植物的错题订正到该比例，即判为「已掌握」。默认 100%（错题必须全部订正）；已答对的题不会因后续答错被撤销。
            </p>
            <div className="flex items-center gap-2">
              <input
                value={ratioInput}
                onChange={(e) => setRatioInput(e.target.value)}
                inputMode="numeric"
                placeholder="100"
                className={`${field} h-10 w-28`}
              />
              <span className="text-fs-body text-on-surface-variant">%</span>
              <button
                type="button"
                disabled={ratioSaving}
                onClick={() => void saveRatio()}
                className="ml-auto flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-fs-sub font-medium text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {ratioSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                保存
              </button>
            </div>
            <p className="text-fs-label text-on-surface-variant">允许范围 50%–100%；当前生效值 {Math.round(ratioNow * 100)}%</p>
            {ratioMsg && (
              <p className={`text-fs-label font-medium ${ratioMsg.ok ? "text-success" : "text-error"}`}>{ratioMsg.text}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 植物档案编辑弹层 */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[var(--size-modal-vh-lg)] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id && rows.some((r) => r.id === editing.id) ? "编辑植物" : "新增植物"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <form
              ref={formRef}
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              {/* 智能识别区 */}
              <section className="rounded-xl border-neo border-primary/25 bg-primary-container/15 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="flex items-center gap-2 text-fs-sub font-medium text-on-surface">
                    <Sparkles className="h-4 w-4 text-foreground" />
                    智能识别
                  </p>
                  <p className="text-fs-label text-on-surface-variant">
                    粘贴植物资料后点识别；只填空项，已有内容不会被覆盖
                  </p>
                </div>
                <textarea
                  value={parseText}
                  onChange={(e) => setParseText(e.target.value)}
                  placeholder={"粘贴或撰写植物资料（名称、拉丁名、习性、观赏特性、花果期、安全提示等），点「智能识别」自动填充下方字段，并可一并生成练习题"}
                  className="mt-2 min-h-[var(--size-min-sm)] w-full resize-y rounded-md border-neo border-outline-variant/40 bg-surface px-3 py-2 text-fs-sub leading-relaxed text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary/40 focus:outline-none"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void runParse()}
                    disabled={parsing}
                    className="flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-fs-sub font-medium text-on-primary shadow-card transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {parsing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {parsing ? "识别中…" : "智能识别"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setParseText("");
                      setParseError(null);
                    }}
                    disabled={parsing}
                    className="h-9 rounded-md border-neo border-outline-variant/40 px-3 text-fs-sub text-on-surface-variant transition-colors hover:bg-surface-container disabled:opacity-60"
                  >
                    清空
                  </button>
                  {parseText.length > 8000 && (
                    <p className="text-fs-label text-error">资料超过 8000 字，请精简后再识别</p>
                  )}
                </div>
                {parseError && <p className="mt-2 text-fs-sub text-error">{parseError}</p>}

                {parseSummary && (
                  <div className="mt-3 space-y-3 rounded-lg bg-surface p-3 shadow-card">
                    <p className="text-fs-sub text-on-surface">
                      已填入 <span className="font-medium text-foreground">{parseSummary.filled}</span> 项 ·
                      与现有内容不同 <span className="font-medium text-foreground">{parseSummary.conflicts.length}</span> 项
                      {parseSummary.conflicts.length > 0 ? "（见下方清单）" : ""} ·
                      未能识别 <span className="font-medium">{parseSummary.unparsed.length + parseSummary.invalid.length}</span> 项
                    </p>

                    {parseSummary.conflicts.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-fs-label font-medium text-on-surface-variant">差异清单（已保留现有内容，可逐条采用）</p>
                        <ul className="space-y-1.5">
                          {parseSummary.conflicts.map((c) => (
                            <li
                              key={c.key}
                              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-surface-container/50 px-3 py-2 text-fs-label"
                            >
                              <span className="font-medium text-on-surface">{c.label}</span>
                              <span className="text-on-surface-variant">当前：{c.current}</span>
                              <span className="text-foreground">建议：{c.suggestedDisplay}</span>
                              <button
                                type="button"
                                onClick={() => adoptConflict(c)}
                                className="ml-auto rounded border-neo border-primary/40 px-2 py-0.5 text-fs-label font-medium text-foreground transition-colors hover:bg-primary-container/40"
                              >
                                采用
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {(parseSummary.unparsed.length > 0 || parseSummary.invalid.length > 0) && (
                      <div className="space-y-1">
                        <p className="text-fs-label font-medium text-on-surface-variant">未能识别（请手动填写）</p>
                        <p className="text-fs-label text-on-surface-variant">
                          {[...parseSummary.unparsed, ...parseSummary.invalid.map((i) => i.field)].join("、")}
                        </p>
                        {parseSummary.invalid.length > 0 && (
                          <p className="text-fs-label text-on-surface-variant/80">
                            {parseSummary.invalid.map((i) => `${i.field}：${i.reason}`).join("；")}
                          </p>
                        )}
                      </div>
                    )}

                    {parseSummary.needsCheck.length > 0 && (
                      <div className="space-y-1">
                        <p className="flex items-center gap-1 text-fs-label font-medium text-warning">
                          <TriangleAlert className="h-3.5 w-3.5" />
                          需教师确认
                        </p>
                        {parseSummary.needsCheck.map((n) => (
                          <p key={n.field} className="text-fs-label text-on-surface-variant">
                            {n.label}：{n.note}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {pendingQs.length > 0 && (
                  <div className="mt-3 space-y-2 rounded-lg bg-surface p-3 shadow-card">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-fs-sub font-medium text-on-surface">待确认题目（{pendingQs.length}）</p>
                      <button
                        type="button"
                        onClick={() => adoptQuestions(pendingQs)}
                        className="rounded-md bg-primary px-3 py-1.5 text-fs-label font-medium text-on-primary transition-colors hover:bg-primary/90"
                      >
                        全部采用
                      </button>
                    </div>
                    <p className="text-fs-label text-on-surface-variant">
                      题目不会自动入库，可就地编辑后逐题采用；采用后进入题目草稿，仍需点「保存」才落库
                    </p>
                    <ul className="space-y-2">
                      {pendingQs.map((pq, qi) => (
                        <li key={pq.qid} className="space-y-2 rounded-md border-neo border-outline-variant/30 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={pq.dimension}
                              onChange={(e) => updatePendingQ(qi, { dimension: e.target.value })}
                              className="rounded border-neo border-outline-variant/40 bg-surface px-2 py-1 text-fs-label text-on-surface focus:border-primary/40 focus:outline-none"
                            >
                              {dimensions.map((d) => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                            <span className="text-fs-label text-on-surface-variant">第 {qi + 1} 题</span>
                            <div className="ml-auto flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => adoptQuestions([pq])}
                                className="rounded bg-primary px-2.5 py-1 text-fs-label font-medium text-on-primary transition-colors hover:bg-primary/90"
                              >
                                采用
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingQs((prev) => prev.filter((x) => x.qid !== pq.qid))}
                                className="rounded border-neo border-outline-variant/40 px-2.5 py-1 text-fs-label text-on-surface-variant transition-colors hover:bg-surface-container"
                              >
                                删除
                              </button>
                            </div>
                          </div>
                          <input
                            value={pq.q}
                            onChange={(e) => updatePendingQ(qi, { q: e.target.value })}
                            placeholder="题干"
                            className={field}
                          />
                          <div className="grid gap-1.5 sm:grid-cols-2">
                            {pq.options.map((opt, oi) => (
                              <div
                                key={oi}
                                className={`flex items-center gap-2 rounded-md border-neo px-2 py-1.5 text-fs-label ${
                                  pq.answerIndex === oi
                                    ? "border-primary/50 bg-primary-container/30"
                                    : "border-outline-variant/30"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`pq-${pq.qid}`}
                                  checked={pq.answerIndex === oi}
                                  onChange={() => updatePendingQ(qi, { answerIndex: oi })}
                                  className="accent-primary"
                                  title="设为正确答案"
                                />
                                <input
                                  value={opt}
                                  onChange={(e) => {
                                    const options = [...pq.options];
                                    while (options.length < 4) options.push("");
                                    options[oi] = e.target.value;
                                    updatePendingQ(qi, { options });
                                  }}
                                  placeholder={`选项 ${"ABCD"[oi]}`}
                                  className="w-full bg-transparent text-on-surface focus:outline-none"
                                />
                              </div>
                            ))}
                          </div>
                          <input
                            value={pq.explain}
                            onChange={(e) => updatePendingQ(qi, { explain: e.target.value })}
                            placeholder="解析"
                            className={field}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {droppedQs.length > 0 && (
                  <p className="mt-2 text-fs-label text-on-surface-variant">
                    已丢弃 {droppedQs.length} 道不合规题目：
                    {droppedQs.map((d) => `第 ${d.index} 题（${d.reason}）`).join("；")}
                  </p>
                )}
                {adoptMsg && <p className="mt-2 text-fs-label font-medium text-foreground">{adoptMsg}</p>}
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-fs-label font-medium text-on-surface-variant">编号（id）</p>
                  <input name="plantId" defaultValue={editing.id} placeholder="如 p001" className={field} />
                </div>
                <div className="space-y-1">
                  <p className="text-fs-label font-medium text-on-surface-variant">名称</p>
                  <input name="name" defaultValue={editing.name} className={field} />
                </div>
                <div className="space-y-1">
                  <p className="text-fs-label font-medium text-on-surface-variant">拉丁名</p>
                  <input name="latin" defaultValue={editing.latin} className={field} />
                </div>
                <div className="space-y-1">
                  <p className="text-fs-label font-medium text-on-surface-variant">别名（逗号分隔）</p>
                  <input name="alias" defaultValue={editing.alias.join("、")} className={field} />
                </div>
                <div className="space-y-1">
                  <p className="text-fs-label font-medium text-on-surface-variant">分类</p>
                  <input name="category" defaultValue={editing.category} list="plant-category-options" className={field} />
                  <datalist id="plant-category-options">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-1">
                  <p className="text-fs-label font-medium text-on-surface-variant">层级</p>
                  <select name="layer" defaultValue={editing.layer} className={field}>
                    {LAYERS.map((l) => (
                      <option key={l} value={l}>
                        {layerLabel(l as Plant["layer"])}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <p className="text-fs-label font-medium text-on-surface-variant">光照（描述）</p>
                  <input name="lightText" defaultValue={editing.light.text} className={field} />
                </div>
                <div className="space-y-1">
                  <p className="text-fs-label font-medium text-on-surface-variant">光照（需求）</p>
                  <input name="lightNeed" defaultValue={editing.light.need} className={field} />
                </div>
                <div className="space-y-1">
                  <p className="text-fs-label font-medium text-on-surface-variant">水分（描述）</p>
                  <input name="waterText" defaultValue={editing.water.text} className={field} />
                </div>
                <div className="space-y-1">
                  <p className="text-fs-label font-medium text-on-surface-variant">水分（需求）</p>
                  <input name="waterNeed" defaultValue={editing.water.need} className={field} />
                </div>
                <div className="space-y-1">
                  <p className="text-fs-label font-medium text-on-surface-variant">土壤</p>
                  <input name="soilText" defaultValue={editing.soil.text} className={field} />
                </div>
                <div className="space-y-1">
                  <p className="text-fs-label font-medium text-on-surface-variant">耐寒性</p>
                  <input name="hardinessText" defaultValue={editing.hardiness.text} className={field} />
                </div>
                <div className="space-y-1">
                  <p className="text-fs-label font-medium text-on-surface-variant">高度</p>
                  <input name="heightText" defaultValue={editing.height?.text ?? ""} className={field} />
                </div>
                <div className="space-y-1">
                  <p className="text-fs-label font-medium text-on-surface-variant">观赏部位</p>
                  <input name="ornamentalPart" defaultValue={editing.ornamentalPart ?? ""} className={field} />
                </div>
                <div className="space-y-1">
                  <p className="text-fs-label font-medium text-on-surface-variant">观赏色</p>
                  <input name="color" defaultValue={editing.color ?? ""} className={field} />
                </div>
                <div className="space-y-1">
                  <p className="text-fs-label font-medium text-on-surface-variant">用途（逗号分隔）</p>
                  <input name="usage" defaultValue={editing.usage.join("、")} className={field} />
                </div>
                <div className="space-y-1">
                  <p className="text-fs-label font-medium text-on-surface-variant">花期月份（如 3、4、5）</p>
                  <input name="flowerMonths" defaultValue={editing.phenology.flowerMonths.join("、")} className={field} />
                </div>
                <div className="space-y-1">
                  <p className="text-fs-label font-medium text-on-surface-variant">果期月份</p>
                  <input name="fruitMonths" defaultValue={editing.phenology.fruitMonths.join("、")} className={field} />
                </div>
                <div className="space-y-1">
                  <p className="text-fs-label font-medium text-on-surface-variant">地区</p>
                  <input name="region" defaultValue={editing.region ?? ""} className={field} />
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-fs-label font-medium text-on-surface-variant">安全警示</p>
                  <select name="isWarning" defaultValue={editing.isWarning ? "yes" : "no"} className={field}>
                    <option value="no">无</option>
                    <option value="yes">有</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <p className="text-fs-label font-medium text-on-surface-variant">限制等级</p>
                  <select name="restriction" defaultValue={editing.warning?.restriction ?? "caution"} className={field}>
                    <option value="caution">慎用</option>
                    <option value="forbid">禁植</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <p className="text-fs-label font-medium text-on-surface-variant">儿童友好</p>
                  <select name="safeForChildren" defaultValue={editing.safeForChildren ? "yes" : "no"} className={field}>
                    <option value="yes">是</option>
                    <option value="no">否</option>
                  </select>
                </div>
                <div className="space-y-1 sm:col-span-3">
                  <p className="text-fs-label font-medium text-on-surface-variant">风险类型</p>
                  <input name="riskType" defaultValue={editing.warning?.riskType ?? ""} className={field} />
                </div>
                <div className="space-y-1 sm:col-span-3">
                  <p className="text-fs-label font-medium text-on-surface-variant">风险部位 / 症状 / 后果 / 识别 / 教学用途</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input name="riskPart" defaultValue={editing.warning?.riskPart ?? ""} placeholder="风险部位" className={field} />
                    <input name="symptom" defaultValue={editing.warning?.symptom ?? ""} placeholder="症状" className={field} />
                    <input name="consequence" defaultValue={editing.warning?.consequence ?? ""} placeholder="后果" className={field} />
                    <input name="identify" defaultValue={editing.warning?.identify ?? ""} placeholder="识别" className={field} />
                    <input name="teachUse" defaultValue={editing.warning?.teachUse ?? ""} placeholder="教学用途" className={field} />
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <p className="text-fs-sub font-medium text-on-surface">图片</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["full", "close"] as const).map((kind) => (
                    <label
                      key={kind}
                      className="flex cursor-pointer items-center justify-center gap-2 rounded-md border-neo border-dashed border-outline-variant/40 bg-surface-container/50 px-3 py-4 text-fs-sub text-on-surface-variant hover:bg-surface-container"
                    >
                      <FileUp className="h-4 w-4" />
                      {kind === "full" ? "上传主图" : "上传特写图"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void uploadImage(file, kind);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  ))}
                </div>
                {editing.images.full && (
                  <p className="truncate text-fs-label text-on-surface-variant">主图：{editing.images.full}</p>
                )}
              </section>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  取消
                </Button>
                <Button type="submit" disabled={saving} className="bg-primary text-on-primary hover:bg-primary/90">
                  {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  保存
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
