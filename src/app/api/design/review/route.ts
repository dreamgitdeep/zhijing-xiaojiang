import { NextResponse } from "next/server";
import { LLMClient, Config } from "coze-coding-dev-sdk";
import { getAuthContext } from "@/lib/auth";
import { getTaskFull, ensureRun, saveStageRecord, patchRun } from "@/lib/design";
import { loadPlantsForServer } from "@/lib/data";
import {
  toPlantPick,
  zoneHints,
  LIGHT_COND_LABEL,
  WATER_COND_LABEL,
  USAGE_COND_LABEL,
  EMPTY_CONDITIONS,
  type PlantPick,
  type ZoneWithPlants,
  type ZoneConditions,
} from "@/lib/plant-compliance";
import type { Plant } from "@/lib/types";
import { ZONING_PALETTE } from "@/config/design-palette";

export const dynamic = "force-dynamic";

// S1 结构分（宽口径）：关键词命中 40% + 提问覆盖度 30% + 填写完整度 30%。
// 正确性主要由 AI 语义分把关，这里只做努力度/行为度的保底信号，避免死抠关键词。
function ruleScoreS1(payload: Record<string, string>, nongyuan: any, meta: any) {
  const fields = nongyuan.diagnosisForm ?? [];
  let keywordHit = 0;
  let filled = 0;
  const missedKeys: string[] = [];
  for (const f of fields) {
    const ans = String(payload[f.key] ?? "").trim();
    if (ans.length >= 6) filled++;
    if ((f.mustMention ?? []).some((k: string) => ans.includes(k))) keywordHit++;
    else missedKeys.push(f.key);
  }
  const n = Math.max(fields.length, 1);
  const keywordAccuracy = Math.round((keywordHit / n) * 100);
  const completeness = Math.round((filled / n) * 100);
  const critical: string[] = nongyuan.inquiry?.criticalEntryIds ?? [];
  const hitIds = (meta?.hitEntryIds ?? []).filter((id: string) => critical.includes(id));
  const coverage = Math.round((hitIds.length / Math.max(critical.length, 1)) * 100);
  const unasked = critical.filter((id) => !hitIds.includes(id));
  const score = Math.round(keywordAccuracy * 0.4 + coverage * 0.3 + completeness * 0.3);
  return { score, keywordAccuracy, coverage, completeness, missedKeys, unasked };
}

// S2 结构分（宽口径 + 修复原则计分缺陷）：主定位 45 + 设计原则 40 + 理由 15。
// 原则按「选对条数 / 4」计分（界面最多选 4 条），修复旧版除以 7 导致天然拿不满的缺陷；
// 主定位次优也给部分分，不再一票否决。
function ruleScoreS2(payload: any, nongyuan: any) {
  const GOOD = ["edible", "science", "eco"];
  const prinOptions: any[] = nongyuan?.principleOptions ?? [];
  const primary = payload.primary;
  let pos = 0;
  if (GOOD.includes(primary)) pos = 45;
  else if (primary) pos = 20;
  const chosen: string[] = payload.principles ?? [];
  const correctIds = prinOptions.filter((o) => o.correct).map((o) => o.id);
  const correctPicks = chosen.filter((c) => correctIds.includes(c));
  const wrongPicks = chosen.filter((c) => prinOptions.find((o) => o.id === c)?.correct === false);
  const prin = Math.max(0, Math.round((correctPicks.length / 4) * 40) - wrongPicks.length * 8);
  const reasons = payload.reasons ?? {};
  const reasonCount = Object.values(reasons).filter((r: any) => String(r ?? "").trim().length >= 8).length;
  const reasonScore = Math.min(reasonCount, 3) * 5;
  const score = Math.min(100, pos + prin + reasonScore);
  return { score, pos, prin, reasonScore, reasonCount, correctPicks, wrongPicks, missingCorrect: correctIds.filter((id) => !chosen.includes(id)) };
}

function polyArea(pts: [number, number][]) {
  if (!Array.isArray(pts) || pts.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

// S3 结构分：分区数量 25 + 命名 25 + 覆盖率 30 + 顶点在场地内 20
function ruleScoreS3(payload: any, meta: any) {
  const zones: any[] = Array.isArray(payload?.zones) ? payload.zones : [];
  const site = meta?.site;
  const n = zones.length;

  const countScore = n >= 5 ? 25 : n >= 4 ? 22 : n >= 3 ? 18 : n >= 1 ? 8 : 0;

  const names = zones.map((z) => String(z?.name ?? "").trim()).filter(Boolean);
  const allNamed = n > 0 && names.length === n;
  const noDup = names.length > 0 && new Set(names).size === names.length;
  const nameScore = (allNamed ? 15 : 0) + (noDup ? 10 : 0);

  let coverage = 0;
  let covScore = 0;
  if (site && site.w > 0 && site.h > 0) {
    const total = zones.reduce((s, z) => s + polyArea(z?.points), 0);
    coverage = total / (site.w * site.h);
    if (coverage >= 0.3 && coverage <= 0.95) covScore = 30;
    else if (coverage >= 0.15 && coverage <= 1.1) covScore = 20;
    else if (coverage > 0.05) covScore = 10;
  }

  let insideRatio = 1;
  if (site) {
    let inCount = 0;
    let total = 0;
    for (const z of zones) {
      for (const p of z?.points ?? []) {
        total++;
        if (p[0] >= site.x && p[0] <= site.x + site.w && p[1] >= site.y && p[1] <= site.y + site.h) inCount++;
      }
    }
    insideRatio = total > 0 ? inCount / total : 1;
  }
  const insideScore = Math.round(insideRatio * 20);

  return {
    score: Math.min(100, countScore + nameScore + covScore + insideScore),
    count: n,
    countScore,
    nameScore,
    allNamed,
    noDup,
    coverage: Math.round(coverage * 100),
    covScore,
    insideRatio: Math.round(insideRatio * 100),
    insideScore,
  };
}

// S3 LLM 评分：返回 0-100 分 + 反馈 + 知识卡片；失败返回 score=null
async function llmScoreS3(detail: string, zoneSummary: string, s2Text: string, caseBg: string, rubric: string): Promise<{ score: number | null; feedback: string; cards: any[] }> {
  try {
    const llm = new LLMClient();
    const events = llm.stream(
      [
        {
          role: "system",
          content: `你是植物造景课程教师助教，正在评阅「功能分区与空间骨架」(S3)。请结合学生的设计定位与设计原则、案例背景，判断分区是否合理、是否呼应定位、空间骨架是否清晰。输出严格 JSON：{"score": 0-100整数, "feedback": string(≤160字, 指出优点与整改方向, 不直接给标准答案), "cards": [{"title": string, "body": string(≤80字), "ref": string} 0-2张]}。只输出 JSON。`,
        },
        {
          role: "user",
          content: `【评分标准】${rubric}\n【结构评分明细】${detail}\n【学生 S2 定位与原则】${s2Text}\n【案例背景】${caseBg}\n【学生分区方案】${zoneSummary}`,
        },
      ],
      { model: "doubao-seed-2-0-lite-260215" }
    );
    let text = "";
    for await (const event of events) text += typeof event?.content === "string" ? event.content : event?.content?.toString() ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      const j = JSON.parse(m[0]);
      const sc = Number(j.score);
      return {
        score: Number.isFinite(sc) ? Math.max(0, Math.min(100, Math.round(sc))) : null,
        feedback: String(j.feedback ?? ""),
        cards: Array.isArray(j.cards) ? j.cards.slice(0, 2) : [],
      };
    }
  } catch {
    /* fallback below */
  }
  return { score: null, feedback: "", cards: [] };
}

// S3 手绘图多模态评阅：直接读图评分，并识别图中的分区名称供后续阶段使用
async function llmScoreS3Vision(imageUrl: string, s2Text: string, caseBg: string, rubric: string): Promise<{ score: number | null; feedback: string; cards: any[]; zones: string[] }> {
  try {
    const llm = new LLMClient();
    const events = llm.stream(
      [
        {
          role: "system",
          content: `你是植物造景课程教师助教，正在评阅学生上传的手绘「功能分区图」(S3)。请仔细观察图片：识别图中划分出的功能分区及其标注名称，并结合学生的设计定位与设计原则、案例背景，判断分区是否合理、是否呼应定位、空间骨架是否清晰。若图片与功能分区无关或无法辨认，评分不超过 40 并在 feedback 中说明。输出严格 JSON：{"score": 0-100整数, "feedback": string(≤160字, 指出优点与整改方向, 不直接给标准答案), "cards": [{"title": string, "body": string(≤80字), "ref": string} 0-2张], "zones": [string 2-8个, 按图中分区给出名称, 图中标注优先, 无标注时按分区功能合理命名]}。只输出 JSON。`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: `【评分标准】${rubric}\n【学生 S2 定位与原则】${s2Text}\n【案例背景】${caseBg}\n【学生提交】手绘功能分区图如下，请评阅并识别其中的分区。` },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      { model: "doubao-seed-2-0-lite-260215" }
    );
    let text = "";
    for await (const event of events) text += typeof event?.content === "string" ? event.content : event?.content?.toString() ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      const j = JSON.parse(m[0]);
      const sc = Number(j.score);
      return {
        score: Number.isFinite(sc) ? Math.max(0, Math.min(100, Math.round(sc))) : null,
        feedback: String(j.feedback ?? ""),
        cards: Array.isArray(j.cards) ? j.cards.slice(0, 2) : [],
        zones: Array.isArray(j.zones) ? j.zones.map((z: any) => String(z ?? "").trim()).filter(Boolean).slice(0, 8) : [],
      };
    }
  } catch {
    /* fallback below */
  }
  return { score: null, feedback: "", cards: [], zones: [] };
}

// S1 AI 语义判分：按"理解是否到位"逐项评判，不死抠关键词；返回薄弱字段 key 供问题清单使用
async function llmJudgeS1(fields: { key: string; label: string; hint: string; points: string[]; answer: string }[]): Promise<{ score: number | null; weak: string[]; feedback: string; cards: any[] }> {
  try {
    const ref = fields.map((f) => `- ${f.label}（${f.key}）：要点 ${f.points.join("、")}${f.hint ? `（${f.hint}）` : ""}`).join("\n");
    const stu = fields.map((f) => `- ${f.label}（${f.key}）：${f.answer || "（未填写）"}`).join("\n");
    const llm = new LLMClient();
    const events = llm.stream(
      [
        {
          role: "system",
          content: `你是植物造景课程助教，评阅「现状诊断」(S1)。逐项判断学生理解是否到位：理解正确但表述不同也应判对，不死抠关键词；空答或明显错误才判为薄弱。输出严格 JSON：{"score": 0-100整数(整体正确性), "weak": [未答到点或答错的字段key数组], "feedback": string(≤160字, 先肯定优点再具体指出问题与整改方向, 语气温和鼓励), "cards": [{"title": string, "body": string(≤80字), "ref": string} 0-2张]}。只输出 JSON。`,
        },
        { role: "user", content: `【诊断项与参考要点】\n${ref}\n【学生答案】\n${stu}` },
      ],
      { model: "doubao-seed-2-0-lite-260215" }
    );
    let text = "";
    for await (const event of events) text += typeof event?.content === "string" ? event.content : event?.content?.toString() ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      const j = JSON.parse(m[0]);
      const sc = Number(j.score);
      return {
        score: Number.isFinite(sc) ? Math.max(0, Math.min(100, Math.round(sc))) : null,
        weak: Array.isArray(j.weak) ? j.weak.map(String) : [],
        feedback: String(j.feedback ?? ""),
        cards: Array.isArray(j.cards) ? j.cards.slice(0, 2) : [],
      };
    }
  } catch {
    /* fallback below */
  }
  return { score: null, weak: [], feedback: "", cards: [] };
}

// S2 AI 语义判分：判断定位与原则是否契合场地、理由是否成立
async function llmJudgeS2(posLabel: string, prinLabels: string[], reasonsText: string, rubric: string): Promise<{ score: number | null; feedback: string; cards: any[] }> {
  try {
    const llm = new LLMClient();
    const events = llm.stream(
      [
        {
          role: "system",
          content: `你是植物造景课程助教，评阅「设计定位」(S2)。判断主定位与设计原则是否契合场地条件、理由是否成立：方向正确但表述不同应给分。输出严格 JSON：{"score": 0-100整数, "feedback": string(≤160字, 先肯定优点再具体指出问题与整改方向, 语气温和鼓励), "cards": [{"title": string, "body": string(≤80字), "ref": string} 0-2张]}。只输出 JSON。`,
        },
        { role: "user", content: `【评分标准】${rubric}\n【学生主定位】${posLabel}\n【学生设计原则】${prinLabels.join("、") || "（无）"}\n【选择理由】${reasonsText || "（无）"}` },
      ],
      { model: "doubao-seed-2-0-lite-260215" }
    );
    let text = "";
    for await (const event of events) text += typeof event?.content === "string" ? event.content : event?.content?.toString() ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      const j = JSON.parse(m[0]);
      const sc = Number(j.score);
      return {
        score: Number.isFinite(sc) ? Math.max(0, Math.min(100, Math.round(sc))) : null,
        feedback: String(j.feedback ?? ""),
        cards: Array.isArray(j.cards) ? j.cards.slice(0, 2) : [],
      };
    }
  } catch {
    /* fallback below */
  }
  return { score: null, feedback: "", cards: [] };
}

/* ============ S4 植物筛选与合规审查：规则结构分 + AI 语义分 各半加权 ============ */
function ruleScoreS4(zwp: ZoneWithPlants[]) {
  const total = zwp.length;
  const withPlants = zwp.filter((z) => z.plants.length > 0).length;
  const coverage = total ? Math.round((withPlants / total) * 100) : 0;
  const marked = zwp.filter((z) => z.conditions.light !== "unknown" || z.conditions.water !== "unknown" || z.conditions.usage !== "unknown").length;
  const conditionsMarked = total ? Math.round((marked / total) * 100) : 0;
  const layers = new Set(zwp.flatMap((z) => z.plants.map((p) => p.layer)));
  const diversity = layers.size >= 4 ? 100 : layers.size === 3 ? 80 : layers.size === 2 ? 55 : layers.size === 1 ? 30 : 0;
  const hints = zwp.flatMap((z) => zoneHints(z));
  const errors = hints.filter((h) => h.level === "error").length;
  const warns = hints.filter((h) => h.level === "warn").length;
  const safety = Math.max(0, 100 - errors * 30 - warns * 12);
  const score = Math.round(coverage * 0.3 + conditionsMarked * 0.15 + diversity * 0.2 + safety * 0.35);
  return {
    score, coverage, conditionsMarked, diversity, safety, errors, warns,
    layerCount: layers.size,
    totalPlants: zwp.reduce((s, z) => s + z.plants.length, 0),
  };
}

function buildS4Issues(zwp: ZoneWithPlants[], rule: ReturnType<typeof ruleScoreS4>) {
  const issues: string[] = [];
  if (rule.coverage < 100) {
    const empty = zwp.filter((z) => z.plants.length === 0).map((z) => z.name);
    if (empty.length) issues.push(`还有分区未选植物：${empty.join("、")}`);
  }
  if (rule.conditionsMarked < 100) {
    const unmarked = zwp
      .filter((z) => z.conditions.light === "unknown" && z.conditions.water === "unknown" && z.conditions.usage === "unknown")
      .map((z) => z.name);
    if (unmarked.length) issues.push(`以下分区未标注场地条件，无法做安全与生态适配判断：${unmarked.join("、")}`);
  }
  for (const z of zwp) {
    for (const h of zoneHints(z)) {
      if (h.level === "error" || h.level === "warn") issues.push(`【${z.name}】${h.text}`);
    }
  }
  return issues;
}

function buildS4KeyPoints() {
  return [
    "儿童活动/休憩停留区避免有毒、有刺、易致敏植物；资料未提及毒性的先核实再种。",
    "低洼易积水分区选耐湿/水生植物，避免不耐积水的种类；荫蔽分区选耐阴植物，强光分区选喜光植物。",
    "兼顾乔—灌—草层次与季相变化，并让植物选择呼应你的设计定位与原则（可食/科普/生态等）。",
  ];
}

async function llmScoreS4(selectionSummary: string, s2Text: string, caseBg: string, rubric: string): Promise<{ score: number | null; feedback: string; cards: any[] }> {
  try {
    const llm = new LLMClient();
    const events = llm.stream(
      [
        {
          role: "system",
          content:
            "你是植物造景课程助教，正在评阅学生社区花园方案的「植物筛选与合规审查」。请综合设计定位与原则、功能分区、案例背景，评判植物选择是否安全合规、生态适配、有层次。评分公平且鼓励性，合理作答应能达到通过线。输出严格 JSON：{\"score\": 0-100整数, \"feedback\": string(≤160字, 先肯定亮点再具体指出问题与整改方向), \"cards\": [{\"title\": string, \"body\": string(≤80字), \"ref\": string} 0-2张]}。只输出 JSON。",
        },
        {
          role: "user",
          content: `【评分标准】${rubric}\n【案例背景摘要】${caseBg}\n【学生的设计定位与原则】${s2Text}\n【学生的分区植物清单】${selectionSummary}`,
        },
      ],
      { model: "doubao-seed-2-0-lite-260215" }
    );
    let text = "";
    for await (const event of events) text += typeof event?.content === "string" ? event.content : event?.content?.toString() ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]);
      const score = Number.isFinite(parsed.score) ? Math.max(0, Math.min(100, Math.round(parsed.score))) : null;
      const cards = Array.isArray(parsed.cards) ? parsed.cards.filter((c: any) => c && c.title && c.body).slice(0, 2) : [];
      return { score, feedback: typeof parsed.feedback === "string" ? parsed.feedback : "", cards };
    }
  } catch {
    /* fallback below */
  }
  return { score: null, feedback: "", cards: [] };
}

/* ============ S5 平面布局与种植设计：规则结构分 + AI 语义分 各半加权 ============ */
interface S5ZoneParsed {
  zoneId: string;
  name: string;
  conditions: ZoneConditions;
  plan: string;
  picks: PlantPick[];
  plants: Plant[];
  counts: Map<string, number>;
  placementCount: number;
}

function ruleScoreS5(zones: S5ZoneParsed[]) {
  const totalZones = zones.length;
  // 适地适树：复用合规引擎（安全 + 生态适配）
  const zwp: ZoneWithPlants[] = zones.map((z) => ({ zoneId: z.zoneId, name: z.name, conditions: z.conditions, plants: z.picks }));
  const hints = zwp.flatMap((z) => zoneHints(z));
  const errors = hints.filter((h) => h.level === "error").length;
  const warns = hints.filter((h) => h.level === "warn").length;
  const fit = Math.max(0, 100 - errors * 25 - warns * 8);

  // 空间层次：乔灌草藤竹的不同层次数
  const layers = new Set(zones.flatMap((z) => z.picks.map((p) => p.layer)));
  const structure = layers.size >= 4 ? 100 : layers.size === 3 ? 80 : layers.size === 2 ? 55 : layers.size === 1 ? 30 : 0;

  // 季相完整度：四季各有 ≥2 种主要观赏植物（seasonInterest≥2）
  const seasonSets: Record<string, Set<string>> = { spring: new Set(), summer: new Set(), autumn: new Set(), winter: new Set() };
  for (const z of zones)
    for (const p of z.plants) {
      const si = p.phenology?.seasonInterest;
      if (!si) continue;
      for (const s of ["spring", "summer", "autumn", "winter"] as const) if ((si[s] ?? 0) >= 2) seasonSets[s].add(p.id);
    }
  const seasonCovered = (["spring", "summer", "autumn", "winter"] as const).filter((s) => seasonSets[s].size >= 2).length;
  const season = Math.round((seasonCovered / 4) * 100);

  // 功能匹配：分区使用场景与植物特性的契合度
  let funcTotal = 0;
  let funcN = 0;
  for (const z of zones) {
    if (z.picks.length === 0) continue;
    funcN++;
    const usage = z.conditions.usage;
    if (usage === "children") funcTotal += z.picks.filter((p) => p.safeForChildren && p.restriction !== "forbid").length / z.picks.length;
    else if (usage === "production") funcTotal += z.picks.filter((p) => p.edible).length / z.picks.length;
    else if (usage === "eco") funcTotal += z.picks.filter((p) => p.layer === "tree" || p.layer === "shrub").length / z.picks.length;
    else funcTotal += 1;
  }
  const func = funcN ? Math.round((funcTotal / funcN) * 100) : 50;

  const totalPlants = zones.reduce((s, z) => s + z.placementCount, 0);
  const plansWritten = zones.filter((z) => z.plan.trim().length >= 10).length;
  const score = Math.round(fit * 0.3 + structure * 0.25 + season * 0.2 + func * 0.25);
  return { score, fit, structure, season, function: func, errors, warns, layerCount: layers.size, seasonCovered, totalZones, totalPlants, plansWritten };
}

function buildS5Issues(zones: S5ZoneParsed[], rule: ReturnType<typeof ruleScoreS5>) {
  const issues: string[] = [];
  const empty = zones.filter((z) => z.placementCount === 0).map((z) => z.name);
  if (empty.length) issues.push(`以下分区尚未落位植物：${empty.join("、")}`);
  const noPlan = zones.filter((z) => z.plan.trim().length < 10).map((z) => z.name);
  if (noPlan.length) issues.push(`以下分区缺少建设计划（写清怎么种、意图与搭配考虑）：${noPlan.join("、")}`);
  if (rule.seasonCovered < 4) issues.push(`季相覆盖 ${rule.seasonCovered}/4 季，尝试补充缺失季节的主要观赏植物，避免景观空缺。`);
  if (rule.layerCount < 3) issues.push(`空间层次偏少（当前 ${rule.layerCount} 层），建议乔—灌—草搭配形成完整骨架。`);
  for (const z of zones) {
    const zwp: ZoneWithPlants = { zoneId: z.zoneId, name: z.name, conditions: z.conditions, plants: z.picks };
    for (const h of zoneHints(zwp)) if (h.level === "error" || h.level === "warn") issues.push(`【${z.name}】${h.text}`);
  }
  return issues;
}

function buildS5KeyPoints() {
  return [
    "适地适树：落位前先对照分区的光照/水分/使用场景，避开不安全的植物（儿童区禁种有毒有刺）。",
    "乔—灌—草搭配形成空间骨架，兼顾常绿与落叶、观花与观叶，让四季都有看点。",
    "建设计划写清每区「怎么种、为什么这样搭」，让植物配置呼应你的设计定位与原则。",
  ];
}

async function llmScoreS5(layoutSummary: string, s2Text: string, caseBg: string, rubric: string): Promise<{ score: number | null; feedback: string; cards: any[] }> {
  try {
    const llm = new LLMClient();
    const events = llm.stream(
      [
        {
          role: "system",
          content:
            "你是植物造景课程助教，正在评阅学生社区花园方案的「平面布局与种植设计」。请综合设计定位与原则、案例背景，依据学生的分区植物落位与建设计划，从适地适树、空间层次、季相完整度、功能匹配四方面评判。评分公平且鼓励性，合理作答应能达到通过线。输出严格 JSON：{\"score\": 0-100整数, \"feedback\": string(≤160字, 先肯定亮点再具体指出问题与整改方向), \"cards\": [{\"title\": string, \"body\": string(≤80字), \"ref\": string} 0-2张]}。只输出 JSON。",
        },
        {
          role: "user",
          content: `【评分标准】${rubric}\n【案例背景摘要】${caseBg}\n【学生的设计定位与原则】${s2Text}\n【学生的分区落位与建设计划】${layoutSummary}`,
        },
      ],
      { model: "doubao-seed-2-0-lite-260215" }
    );
    let text = "";
    for await (const event of events) text += typeof event?.content === "string" ? event.content : event?.content?.toString() ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]);
      const score = Number.isFinite(parsed.score) ? Math.max(0, Math.min(100, Math.round(parsed.score))) : null;
      const cards = Array.isArray(parsed.cards) ? parsed.cards.filter((c: any) => c && c.title && c.body).slice(0, 2) : [];
      return { score, feedback: typeof parsed.feedback === "string" ? parsed.feedback : "", cards };
    }
  } catch {
    /* fallback below */
  }
  return { score: null, feedback: "", cards: [] };
}

/* ============ S6 方案评估：五维自评质量(规则) + 方案综合质量(LLM)，按 rubric 40/60 加权 ============ */
export const S6_DIMS = [
  { key: "eco", label: "生态性" },
  { key: "safety", label: "安全性" },
  { key: "landscape", label: "景观性" },
  { key: "ops", label: "运维性" },
  { key: "fit", label: "适用性" },
];

// 汇总前序产出里的分区名与植物 id，用于判断自评依据是否"落到具体分区/植物"
function collectS6Context(run: any) {
  const zoneNames: string[] = [];
  const plantIds = new Set<string>();
  const pick = (k: string) => run?.stage_payloads?.[k]?.payload ?? run?.stage_payloads?.[k] ?? {};
  for (const z of pick("S3")?.zones ?? []) if (z?.name) zoneNames.push(String(z.name));
  for (const z of pick("S4")?.zones ?? []) {
    if (z?.name) zoneNames.push(String(z.name));
    for (const id of z?.plantIds ?? []) if (id) plantIds.add(String(id));
  }
  for (const z of pick("S5")?.zones ?? []) {
    if (z?.name) zoneNames.push(String(z.name));
    for (const p of z?.placements ?? []) if (p?.plantId) plantIds.add(String(p.plantId));
  }
  return { zoneNames: [...new Set(zoneNames)], plantIds: [...plantIds] };
}

function ruleScoreS6(payload: any, zoneNames: string[], plantNames: string[]) {
  const selfEval: any[] = Array.isArray(payload?.selfEval) ? payload.selfEval : [];
  const byKey = new Map(selfEval.map((d) => [String(d?.key), d]));
  const refs = [...zoneNames, ...plantNames].filter(Boolean);
  let filled = 0;
  let grounded = 0;
  let selfScoreTotal = 0;
  const weakDims: string[] = [];
  for (const dim of S6_DIMS) {
    const d = byKey.get(dim.key);
    const basis = String(d?.basis ?? "").trim();
    const sc = Number(d?.score);
    const okScore = Number.isFinite(sc) && sc >= 0 && sc <= 20;
    if (okScore) selfScoreTotal += Math.round(sc);
    const hasBasis = basis.length >= 15;
    const isGrounded = refs.some((r) => basis.includes(r));
    if (okScore && hasBasis) filled++;
    if (hasBasis && isGrounded) grounded++;
    else weakDims.push(dim.label);
  }
  const n = S6_DIMS.length;
  const completeness = Math.round((filled / n) * 100);
  const grounding = Math.round((grounded / n) * 100);
  const score = Math.round(completeness * 0.5 + grounding * 0.5);
  return { score, completeness, grounding, filled, grounded, selfScoreTotal, weakDims };
}

async function llmScoreS6(
  selfEvalText: string,
  schemeSummary: string,
  s2Text: string,
  caseBg: string,
  rubric: string
): Promise<{ score: number | null; selfEvalCheck: string; strengths: string[]; issues: string[]; suggestions: string[]; feedback: string; cards: any[] }> {
  try {
    const llm = new LLMClient();
    const events = llm.stream(
      [
        {
          role: "system",
          content:
            "你是植物造景课程助教，正在做「方案评估」(S6) 的收口评阅。请核验学生五维自评与其实际方案是否一致（自评夸大或不符要指出），并从整体评估方案综合质量（是否呼应设计定位、适地适树、空间层次与季相、功能落地）。评分公平且鼓励性，合理作答应能达到通过线。输出严格 JSON：{\"score\": 0-100整数(方案综合质量), \"selfEvalCheck\": string(≤120字, 核验自评是否属实), \"strengths\": [string 2-3条优点], \"issues\": [string 问题清单], \"suggestions\": [string 改进建议], \"feedback\": string(≤160字总评), \"cards\": [{\"title\": string,\"body\": string(≤80字),\"ref\": string} 0-2张]}。只输出 JSON。",
        },
        {
          role: "user",
          content: `【评分标准】${rubric}\n【案例背景摘要】${caseBg}\n【学生的设计定位与原则】${s2Text}\n【学生的方案概要】${schemeSummary}\n【学生的五维自评】${selfEvalText}`,
        },
      ],
      { model: "doubao-seed-2-0-lite-260215" }
    );
    let text = "";
    for await (const event of events) text += typeof event?.content === "string" ? event.content : event?.content?.toString() ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      const j = JSON.parse(m[0]);
      const sc = Number(j.score);
      return {
        score: Number.isFinite(sc) ? Math.max(0, Math.min(100, Math.round(sc))) : null,
        selfEvalCheck: String(j.selfEvalCheck ?? ""),
        strengths: Array.isArray(j.strengths) ? j.strengths.map(String).slice(0, 3) : [],
        issues: Array.isArray(j.issues) ? j.issues.map(String) : [],
        suggestions: Array.isArray(j.suggestions) ? j.suggestions.map(String) : [],
        feedback: String(j.feedback ?? ""),
        cards: Array.isArray(j.cards) ? j.cards.filter((c: any) => c && c.title && c.body).slice(0, 2) : [],
      };
    }
  } catch {
    /* fallback below */
  }
  return { score: null, selfEvalCheck: "", strengths: [], issues: [], suggestions: [], feedback: "", cards: [] };
}

export async function POST(req: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await req.json();
  const { taskId, stageKey, payload = {}, meta = {} } = body;
  const full = await getTaskFull(taskId);
  if (!full) return NextResponse.json({ error: "TASK_NOT_FOUND" }, { status: 404 });
  const { task, nongyuan } = full;

  const passScore = nongyuan.scoring?.passScore ?? task.passScore ?? 60;
  const rubricText = JSON.stringify((task as any).rubricsByStage?.[stageKey] ?? (task as any).rubrics ?? []);
  const run = await ensureRun(taskId, auth.userId);

  let rule: any;
  let score: number;
  let feedback: string;
  let cards: any[];
  let issues: string[] = [];
  let keyPoints: string[] = [];
  // S6 评估报告专用字段（其余阶段为 undefined）
  let strengths: string[] = [];
  let suggestions: string[] = [];
  let selfEvalCheck = "";
  let finalGrade: number | null = null;
  // 存档用的 payload/meta 默认取请求值；S3 上传模式会改写（补 AI 识别的分区）
  let savePayload: any = payload;
  let saveMeta: any = meta;
  let respZones: any[] | null = null;

  if (stageKey === "S1") {
    rule = ruleScoreS1(payload, nongyuan, meta);
    const fields = (nongyuan.diagnosisForm ?? []).map((f: any) => ({
      key: f.key,
      label: f.label,
      hint: f.hint ?? "",
      points: f.mustMention ?? [],
      answer: String(payload[f.key] ?? ""),
    }));
    const llm = await llmJudgeS1(fields);
    score = llm.score != null ? Math.round(rule.score * 0.5 + llm.score * 0.5) : rule.score;
    feedback = llm.feedback || "本次诊断已记录。请对照场地顾问的问询资料，补齐未答到点的维度后重新提交。";
    cards = llm.cards;
    rule = { ...rule, llmScore: llm.score };
    // 问题清单 + 参考要点：优先用 AI 判定的薄弱项，AI 失败时回退关键词未命中项
    const weakKeys = new Set<string>(llm.weak.length ? llm.weak : rule.missedKeys);
    for (const f of fields) {
      if (!weakKeys.has(f.key)) continue;
      issues.push(`「${f.label}」未答到要点`);
      keyPoints.push(`${f.label}：参考要点为「${f.points.join("、")}」${f.hint ? `（${f.hint}）` : ""}`);
    }
    if (rule.unasked.length) {
      const entries: any[] = nongyuan.inquiry?.entries ?? [];
      const topics = rule.unasked.map((id: string) => entries.find((e) => e.id === id)?.topic ?? id);
      issues.push(`还有 ${rule.unasked.length} 个关键问题未向场地顾问询问：${topics.join("、")}`);
    }
  } else if (stageKey === "S2") {
    rule = ruleScoreS2(payload, nongyuan);
    const posOptions: any[] = nongyuan.positioningOptions ?? [];
    const prinOptions: any[] = nongyuan.principleOptions ?? [];
    const posLabel = posOptions.find((o) => o.id === payload.primary)?.label ?? payload.primary ?? "（未选）";
    const prinLabels = (payload.principles ?? []).map((id: string) => prinOptions.find((o) => o.id === id)?.label ?? id);
    const reasonsText = Object.values(payload.reasons ?? {}).map((r: any) => String(r ?? "")).filter(Boolean).join("；");
    const llm = await llmJudgeS2(posLabel, prinLabels, reasonsText, rubricText);
    score = llm.score != null ? Math.round(rule.score * 0.5 + llm.score * 0.5) : rule.score;
    feedback = llm.feedback || "本次定位已记录。请结合场地条件复核主定位与设计原则的契合度后重新提交。";
    cards = llm.cards;
    rule = { ...rule, llmScore: llm.score };
    // 问题清单 + 参考要点
    const GOOD = ["edible", "science", "eco"];
    if (!GOOD.includes(payload.primary)) {
      issues.push(`主定位选了「${posLabel}」，与本案场地条件的契合度不高`);
    }
    for (const id of rule.wrongPicks) {
      const o = prinOptions.find((x) => x.id === id);
      if (o) issues.push(`设计原则「${o.label}」不适合本场地`);
    }
    if (rule.reasonCount < 3) issues.push(`选择理由不足 3 条（当前 ${rule.reasonCount} 条）`);
    keyPoints.push(`本案推荐定位：可食 + 科普 + 生态 的复合定位（建筑垃圾土壤适合可食展示，周边居民与白领适合科普互动，社区共建要求生态低维护）`);
    keyPoints.push(`推荐设计原则：${prinOptions.filter((o) => o.correct).map((o) => o.label).join("；")}`);
    if (rule.missingCorrect.length && rule.correctPicks.length < 4) {
      const missLabels = rule.missingCorrect.map((id: string) => prinOptions.find((o) => o.id === id)?.label).filter(Boolean);
      keyPoints.push(`还可补充的正确原则：${missLabels.join("；")}`);
    }
  } else if (stageKey === "S3") {
    // 组装 LLM 上下文：S2 定位与原则 + 案例背景
    const s2rec = run.stage_payloads?.S2 as any;
    const s2 = s2rec?.payload ?? s2rec ?? {};
    const posOptions: any[] = nongyuan.positioningOptions ?? [];
    const prinOptions: any[] = nongyuan.principleOptions ?? [];
    const posLabel = posOptions.find((o) => o.id === s2.primary)?.label ?? s2.primary ?? "（无）";
    const prinLabels = (s2.principles ?? []).map((id: string) => prinOptions.find((o) => o.id === id)?.label ?? id);
    const s2Text = `主定位：${posLabel}；设计原则：${prinLabels.join("、") || "（无）"}`;
    const caseBg = ((task as any).case?.backgroundSections ?? [])
      .map((s: any) => `${s.title ?? ""}：${s.text ?? ""}`)
      .join("\n")
      .slice(0, 1200);

    if (payload?.mode === "upload") {
      // 手绘图上传模式：无几何数据，跳过结构分，AI 多模态直接评分并识别分区清单
      const imageUrl = String(payload?.imageUrl ?? "");
      if (!imageUrl) return NextResponse.json({ error: "缺少图片地址" }, { status: 400 });
      const llm = await llmScoreS3Vision(imageUrl, s2Text, caseBg, rubricText);
      if (llm.score == null) return NextResponse.json({ error: "AI 评阅失败，请稍后重试" }, { status: 500 });
      const names = llm.zones.length ? llm.zones : ["分区 1", "分区 2", "分区 3"];
      const ts = Date.now().toString(36);
      const zones = names.map((name, i) => ({ id: `z${ts}${i}`, name, color: ZONING_PALETTE[i % ZONING_PALETTE.length], points: [] as [number, number][] }));
      savePayload = { mode: "upload", imageUrl, zones };
      saveMeta = { mode: "upload" };
      rule = { mode: "upload", llmScore: llm.score };
      score = llm.score;
      feedback = llm.feedback || "本次手绘图已记录。请对照设计定位与案例背景，检查分区是否呼应定位、空间骨架是否清晰，调整后重新提交。";
      cards = llm.cards;
      respZones = zones;
    } else {
      rule = ruleScoreS3(payload, meta);
      const siteArea = meta?.siteArea || (meta?.site ? meta.site.w * meta.site.h : 0);
      const zoneSummary = (payload.zones ?? [])
        .map((z: any, i: number) => {
          const pct = siteArea > 0 ? Math.round((polyArea(z?.points) / siteArea) * 100) : 0;
          return `${i + 1}. ${z?.name ?? "未命名"}（约 ${pct}% 面积，${(z?.points ?? []).length} 个顶点）`;
        })
        .join("\n");
      const llm = await llmScoreS3(JSON.stringify(rule), zoneSummary, s2Text, caseBg, rubricText);
      score = llm.score != null ? Math.round(rule.score * 0.5 + llm.score * 0.5) : rule.score;
      feedback = llm.feedback || "本次分区已记录。请对照设计定位与案例背景，检查分区是否呼应定位、空间骨架是否清晰，调整后重新提交。";
      cards = llm.cards;
      rule = { ...rule, llmScore: llm.score };
    }
  } else if (stageKey === "S4") {
    const dataset = await loadPlantsForServer().catch(() => null);
    const plantById = new Map<string, PlantPick>((dataset?.plants ?? []).map((p) => [p.id, toPlantPick(p)]));
    const rawZones: any[] = Array.isArray(payload?.zones) ? payload.zones : [];
    const zwp: ZoneWithPlants[] = rawZones.map((z) => ({
      zoneId: String(z?.zoneId ?? ""),
      name: String(z?.name ?? "未命名分区"),
      conditions: { ...EMPTY_CONDITIONS, ...(z?.conditions ?? {}) },
      plants: (Array.isArray(z?.plantIds) ? z.plantIds : []).map((id: string) => plantById.get(id)).filter(Boolean) as PlantPick[],
    }));
    rule = ruleScoreS4(zwp);
    // LLM 上下文：S2 定位与原则 + 案例背景
    const s2rec = run.stage_payloads?.S2 as any;
    const s2 = s2rec?.payload ?? s2rec ?? {};
    const posOptions: any[] = nongyuan.positioningOptions ?? [];
    const prinOptions: any[] = nongyuan.principleOptions ?? [];
    const posLabel = posOptions.find((o) => o.id === s2.primary)?.label ?? s2.primary ?? "（无）";
    const prinLabels = (s2.principles ?? []).map((id: string) => prinOptions.find((o) => o.id === id)?.label ?? id);
    const s2Text = `主定位：${posLabel}；设计原则：${prinLabels.join("、") || "（无）"}`;
    const caseBg = ((task as any).case?.backgroundSections ?? [])
      .map((s: any) => `${s.title ?? ""}：${s.text ?? ""}`)
      .join("\n")
      .slice(0, 1200);
    const selectionSummary = zwp
      .map((z) => {
        const cond = `光照${LIGHT_COND_LABEL[z.conditions.light]} / 水分${WATER_COND_LABEL[z.conditions.water]} / 场景${USAGE_COND_LABEL[z.conditions.usage]}`;
        const names = z.plants.map((p) => `${p.name}(${p.layer})`).join("、") || "（未选植物）";
        return `· ${z.name}（${cond}）：${names}`;
      })
      .join("\n");
    const llm = await llmScoreS4(selectionSummary, s2Text, caseBg, rubricText);
    score = llm.score != null ? Math.round(rule.score * 0.5 + llm.score * 0.5) : rule.score;
    feedback = llm.feedback || "本次植物清单已记录。请结合合规提示调整不安全或生态不适配的选择，补充未覆盖的分区后重新提交。";
    cards = llm.cards;
    rule = { ...rule, llmScore: llm.score };
    issues = buildS4Issues(zwp, rule);
    keyPoints = buildS4KeyPoints();
  } else if (stageKey === "S5") {
    const dataset = await loadPlantsForServer().catch(() => null);
    const plantFull = new Map<string, Plant>((dataset?.plants ?? []).map((p) => [p.id, p]));
    const plantPick = new Map<string, PlantPick>((dataset?.plants ?? []).map((p) => [p.id, toPlantPick(p)]));
    const rawZones: any[] = Array.isArray(payload?.zones) ? payload.zones : [];
    const zonesParsed: S5ZoneParsed[] = rawZones.map((z) => {
      const placements: any[] = Array.isArray(z?.placements) ? z.placements : [];
      const counts = new Map<string, number>();
      for (const pl of placements) {
        const id = String(pl?.plantId ?? "");
        if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      const distinctIds = [...counts.keys()];
      return {
        zoneId: String(z?.zoneId ?? ""),
        name: String(z?.name ?? "未命名分区"),
        conditions: { ...EMPTY_CONDITIONS, ...(z?.conditions ?? {}) },
        plan: String(z?.plan ?? ""),
        picks: distinctIds.map((id) => plantPick.get(id)).filter(Boolean) as PlantPick[],
        plants: distinctIds.map((id) => plantFull.get(id)).filter(Boolean) as Plant[],
        counts,
        placementCount: placements.length,
      };
    });
    rule = ruleScoreS5(zonesParsed);
    const s2rec = run.stage_payloads?.S2 as any;
    const s2 = s2rec?.payload ?? s2rec ?? {};
    const posOptions: any[] = nongyuan.positioningOptions ?? [];
    const prinOptions: any[] = nongyuan.principleOptions ?? [];
    const posLabel = posOptions.find((o) => o.id === s2.primary)?.label ?? s2.primary ?? "（无）";
    const prinLabels = (s2.principles ?? []).map((id: string) => prinOptions.find((o) => o.id === id)?.label ?? id);
    const s2Text = `主定位：${posLabel}；设计原则：${prinLabels.join("、") || "（无）"}`;
    const caseBg = ((task as any).case?.backgroundSections ?? [])
      .map((s: any) => `${s.title ?? ""}：${s.text ?? ""}`)
      .join("\n")
      .slice(0, 1200);
    const layoutSummary = zonesParsed
      .map((z) => {
        const cond = `光照${LIGHT_COND_LABEL[z.conditions.light]} / 水分${WATER_COND_LABEL[z.conditions.water]} / 场景${USAGE_COND_LABEL[z.conditions.usage]}`;
        const plantsText =
          z.picks.map((p) => `${p.name}(${p.layer})×${z.counts.get(p.id) ?? 1}`).join("、") || "（未落位植物）";
        return `· ${z.name}（${cond}）：${plantsText}\n  建设计划：${z.plan.trim() || "（未填写）"}`;
      })
      .join("\n");
    const llm = await llmScoreS5(layoutSummary, s2Text, caseBg, rubricText);
    score = llm.score != null ? Math.round(rule.score * 0.5 + llm.score * 0.5) : rule.score;
    feedback = llm.feedback || "本次种植布局已记录。请对照适地适树、空间层次、季相完整度与功能匹配调整落位与建设计划后重新提交。";
    cards = llm.cards;
    rule = { ...rule, llmScore: llm.score };
    issues = buildS5Issues(zonesParsed, rule);
    keyPoints = buildS5KeyPoints();
  } else if (stageKey === "S6") {
    const dataset = await loadPlantsForServer().catch(() => null);
    const plantNameById = new Map<string, string>((dataset?.plants ?? []).map((p) => [p.id, p.name]));
    const ctx = collectS6Context(run);
    const usedPlantNames = ctx.plantIds.map((id) => plantNameById.get(id)).filter(Boolean) as string[];
    rule = ruleScoreS6(payload, ctx.zoneNames, usedPlantNames);

    // 组装 LLM 上下文：S2 定位与原则 + 案例背景 + 方案概要 + 五维自评
    const s2rec = run.stage_payloads?.S2 as any;
    const s2 = s2rec?.payload ?? s2rec ?? {};
    const posOptions: any[] = nongyuan.positioningOptions ?? [];
    const prinOptions: any[] = nongyuan.principleOptions ?? [];
    const posLabel = posOptions.find((o) => o.id === s2.primary)?.label ?? s2.primary ?? "（无）";
    const prinLabels = (s2.principles ?? []).map((id: string) => prinOptions.find((o) => o.id === id)?.label ?? id);
    const s2Text = `主定位：${posLabel}；设计原则：${prinLabels.join("、") || "（无）"}`;
    const caseBg = ((task as any).case?.backgroundSections ?? [])
      .map((s: any) => `${s.title ?? ""}：${s.text ?? ""}`)
      .join("\n")
      .slice(0, 1200);

    const s5payload: any = (run.stage_payloads?.S5 as any)?.payload ?? run.stage_payloads?.S5 ?? {};
    const s5zones: any[] = Array.isArray(s5payload?.zones) ? s5payload.zones : [];
    let schemeSummary = s5zones
      .map((z: any) => {
        const counts = new Map<string, number>();
        for (const p of z?.placements ?? []) if (p?.plantId) counts.set(p.plantId, (counts.get(p.plantId) ?? 0) + 1);
        const plants = [...counts.entries()].map(([id, c]) => `${plantNameById.get(id) ?? id}×${c}`).join("、") || "（无植物）";
        const plan = String(z?.plan ?? "").trim();
        return `· ${z?.name ?? "未命名"}：${plants}${plan ? `\n  建设计划：${plan.slice(0, 80)}` : ""}`;
      })
      .join("\n");
    if (!schemeSummary) {
      const s4payload: any = (run.stage_payloads?.S4 as any)?.payload ?? run.stage_payloads?.S4 ?? {};
      schemeSummary = (Array.isArray(s4payload?.zones) ? s4payload.zones : [])
        .map((z: any) => `· ${z?.name ?? "未命名"}：${(z?.plantIds ?? []).map((id: string) => plantNameById.get(id) ?? id).join("、") || "（无植物）"}`)
        .join("\n");
    }

    const selfEvalArr: any[] = Array.isArray(payload?.selfEval) ? payload.selfEval : [];
    const selfEvalText = S6_DIMS.map((dim) => {
      const d = selfEvalArr.find((x: any) => x?.key === dim.key);
      return `- ${dim.label}：自评 ${d?.score ?? "未填"} 分，依据：${String(d?.basis ?? "").slice(0, 120) || "（未填）"}`;
    }).join("\n");

    const llm = await llmScoreS6(selfEvalText, schemeSummary || "（无前序方案数据）", s2Text, caseBg, rubricText);
    score = llm.score != null ? Math.round(rule.score * 0.4 + llm.score * 0.6) : rule.score;
    feedback = llm.feedback || "本次方案评估已记录。请让五维自评依据落到具体分区与植物，并结合方案实际完善后重新提交。";
    cards = llm.cards;
    rule = { ...rule, llmScore: llm.score };
    issues = [...(rule.weakDims as string[]).map((d: string) => `「${d}」自评依据未落到具体分区或植物`), ...llm.issues];
    keyPoints = llm.suggestions;
    strengths = llm.strengths;
    suggestions = llm.suggestions;
    selfEvalCheck = llm.selfEvalCheck;
  } else {
    return NextResponse.json({ error: "STAGE_NOT_SUPPORTED" }, { status: 400 });
  }

  const passed = score >= passScore;
  const attempt = await saveStageRecord(run.id, stageKey, { payload: savePayload, meta: saveMeta }, { rule, feedback, cards, issues, keyPoints, strengths, suggestions, selfEvalCheck }, score, passScore);

  // S6 为收口阶段：最终成绩 = S6 最佳分；通过后置 run 为完成（定稿）
  if (stageKey === "S6") {
    finalGrade = Math.max(score, attempt.bestScore ?? 0);
    await patchRun(run.id, { total_score: finalGrade, ...(passed ? { status: "completed" } : {}) });
  }

  return NextResponse.json({
    runId: run.id,
    attemptNo: attempt.attemptNo,
    bestScore: attempt.bestScore,
    score,
    passed,
    passScore,
    feedback,
    cards,
    issues,
    keyPoints,
    strengths,
    suggestions,
    selfEvalCheck,
    finalGrade,
    ...(respZones ? { zones: respZones } : {}),
    detail: rule,
    unlockedNext: passed,
  });
}
