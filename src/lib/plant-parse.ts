import type { QuizQuestion } from "./types";
import { LIGHT_NEED, WATER_NEED, SOIL_PH, SOIL_DRAINAGE } from "./plant-enums";

export { LIGHT_NEED, WATER_NEED, SOIL_PH, SOIL_DRAINAGE };

/**
 * 植物资料智能识别：枚举白名单 + 逐字段校验 + 派生推算（纯函数，客户端安全）。
 * 白名单全部提取自 plants.json 135 条数据的实际取值，不得凭想象扩充。
 */

export const LAYERS = ["tree", "shrub", "herb", "vine", "bamboo"] as const;
export const PEAK_SEASON = ["spring", "summer", "autumn", "winter"] as const;
export const RESTRICTIONS = ["caution", "forbid"] as const;
export const RISK_TYPES = ["全株剧毒", "有刺", "有小毒", "有毒", "物理伤害", "致敏"] as const;
export const QUIZ_DIMENSIONS = ["光照习性", "水分习性", "土壤要求", "观赏与季相", "配置方式", "安全应用"] as const;

export const CATEGORIES = [
  "一二年生花卉", "宿根/多年生草本", "小乔木/亚乔木", "水生/湿生", "球根", "竹类", "花灌木/绿篱",
  "草坪与地被", "药用植物", "蔬食作物", "藤本攀援", "观赏草", "食用灌木", "香草芳香",
] as const;

export const TAG_GROUPS = [
  "垂直绿化", "水生湿生", "生态防护", "科普互动", "耐阴地被", "芳香", "药用", "蜜源食源", "观赏", "食用",
] as const;

export const REGION_TAGS = [
  "上海", "东北", "全国", "华东", "华中", "华北", "华南", "西北", "西南", "长三角", "长江流域",
] as const;

export const FUNCTION_TAGS = [
  "乡土", "互动", "低维护", "净化空气", "切花", "固土低维护", "地被", "垂直绿化", "干花", "年宵花卉",
  "庭院", "庭院树", "抗污染", "果园菜圃", "染甲", "棚架", "水土保持", "水培观赏", "水生植物", "水边绿化",
  "湿地绿化", "球根花卉", "盆景", "盆栽", "科普", "绿篱", "耐阴", "耐阴地被", "花坛", "花境",
  "花境背景", "花篱", "芳香", "药用", "蜜源植物", "蜜源食源", "观叶", "观叶观果", "观果", "观花",
  "观花观果", "观赏", "观赏草", "观赏（草坪）", "造型", "野花", "食用", "食用浆果", "食用（干制后）", "食用（牧草）",
] as const;

type FieldKind = "text" | "enum" | "bool" | "number" | "months" | "array" | "enumArray" | "seasonInterest";

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  options?: readonly string[];
  min?: number;
  max?: number;
  /** 安全类字段：未识别时文案为「需教师确认」而非「未识别」 */
  safety?: boolean;
}

export const FIELD_DEFS: FieldDef[] = [
  { key: "name", label: "名称", kind: "text" },
  { key: "latin", label: "拉丁名", kind: "text" },
  { key: "alias", label: "别名", kind: "array" },
  { key: "category", label: "分类", kind: "enum", options: CATEGORIES },
  { key: "layer", label: "层级", kind: "enum", options: LAYERS },
  { key: "lifeForm", label: "生活型", kind: "text" },
  { key: "light.text", label: "光照（描述）", kind: "text" },
  { key: "light.need", label: "光照（需求）", kind: "enum", options: LIGHT_NEED },
  { key: "light.shadeTolerant", label: "耐阴", kind: "bool" },
  { key: "water.text", label: "水分（描述）", kind: "text" },
  { key: "water.need", label: "水分（需求）", kind: "enum", options: WATER_NEED },
  { key: "water.avoidWaterlog", label: "忌积水", kind: "bool" },
  { key: "soil.text", label: "土壤（描述）", kind: "text" },
  { key: "soil.ph", label: "土壤酸碱度", kind: "enum", options: SOIL_PH },
  { key: "soil.drainage", label: "土壤排水", kind: "enum", options: SOIL_DRAINAGE },
  { key: "soil.tolerant", label: "耐瘠薄", kind: "bool" },
  { key: "hardiness.text", label: "耐寒性（描述）", kind: "text" },
  { key: "hardiness.minTempC", label: "耐寒最低温（℃）", kind: "number", min: -40, max: 5 },
  { key: "hardiness.zoneMin", label: "耐寒区（下限）", kind: "number", min: 1, max: 12 },
  { key: "hardiness.zoneMax", label: "耐寒区（上限）", kind: "number", min: 1, max: 12 },
  { key: "height.text", label: "高度（描述）", kind: "text" },
  { key: "ornamentalPart", label: "观赏部位", kind: "text" },
  { key: "color", label: "观赏色", kind: "text" },
  { key: "usage", label: "园林用途", kind: "array" },
  { key: "region", label: "产地分布", kind: "text" },
  { key: "phenology.text", label: "物候（描述）", kind: "text" },
  { key: "phenology.flowerMonths", label: "花期月份", kind: "months" },
  { key: "phenology.fruitMonths", label: "果期月份", kind: "months" },
  { key: "phenology.peakSeason", label: "观赏旺季", kind: "enum", options: PEAK_SEASON },
  { key: "phenology.seasonInterest", label: "季相兴趣值", kind: "seasonInterest" },
  { key: "phenology.evergreen", label: "常绿", kind: "bool" },
  { key: "phenology.deciduous", label: "落叶", kind: "bool" },
  { key: "phenology.autumnColor", label: "秋色叶", kind: "bool" },
  { key: "tagGroups", label: "标签组", kind: "enumArray", options: TAG_GROUPS },
  { key: "functionTags", label: "功能标签", kind: "enumArray", options: FUNCTION_TAGS },
  { key: "regionTags", label: "区域标签", kind: "enumArray", options: REGION_TAGS },
  { key: "isWarning", label: "警示植物", kind: "bool", safety: true },
  { key: "warning.riskType", label: "风险类型", kind: "enum", options: RISK_TYPES, safety: true },
  { key: "warning.restriction", label: "管控级别", kind: "enum", options: RESTRICTIONS, safety: true },
  { key: "warning.riskPart", label: "风险部位", kind: "text", safety: true },
  { key: "warning.symptom", label: "中毒症状", kind: "text", safety: true },
  { key: "warning.consequence", label: "后果", kind: "text", safety: true },
];

/** safeForChildren 永远不允许 AI 自动填写，固定列入「需教师确认」 */
export const SAFE_CHILDREN_FIELD = { key: "safeForChildren", label: "儿童安全" };

export interface ParseOutcome {
  /** 校验通过的字段值（key 为点路径） */
  fields: Record<string, unknown>;
  /** LLM 给了值但校验不通过被丢弃 */
  invalid: { field: string; reason: string }[];
  /** LLM 未给出值的字段名（安全类不进这里，进 needsCheck） */
  unparsed: string[];
  /** 需教师人工核对的字段（安全保守策略 / 派生矛盾） */
  needsCheck: { field: string; label: string; note: string }[];
  questions: QuizQuestion[];
  droppedQuestions: { index: number; reason: string }[];
}

const CN_NUM: Record<string, number> = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6,
  七: 7, 八: 8, 九: 9, 十: 10, 十一: 11, 十二: 12,
};

function cnToNum(s: string): number | null {
  if (/^\d{1,2}$/.test(s)) {
    const n = parseInt(s, 10);
    return n >= 1 && n <= 12 ? n : null;
  }
  return CN_NUM[s] ?? null;
}

/** 从中文物候文本提取月份：支持「3-5月」「三月至五月」「3月、8月」等 */
export function deriveMonths(text: string): number[] {
  if (!text) return [];
  const found = new Set<number>();
  const num = String.raw`(\d{1,2}|十一|十二|十|[一二三四五六七八九])`;
  const rangeRe = new RegExp(`${num}\\s*[-–~—至到]\\s*${num}\\s*月`, "g");
  let rest = text;
  for (const m of rest.matchAll(rangeRe)) {
    const a = cnToNum(m[1]);
    const b = cnToNum(m[2]);
    if (a && b) {
      if (b >= a) for (let i = a; i <= b; i += 1) found.add(i);
      else {
        for (let i = a; i <= 12; i += 1) found.add(i);
        for (let i = 1; i <= b; i += 1) found.add(i);
      }
    }
  }
  rest = rest.replace(rangeRe, " ");
  const singleRe = new RegExp(`${num}\\s*月`, "g");
  for (const m of rest.matchAll(singleRe)) {
    const n = cnToNum(m[1]);
    if (n) found.add(n);
  }
  return [...found].sort((a, b) => a - b);
}

/** 从高度文本提取米数：「2-5米」→ {min:2,max:5}；「高约3米」→ {min:3,max:3} */
export function deriveHeight(text: string): { min: number; max: number } | null {
  if (!text) return null;
  const range = text.match(/(\d+(?:\.\d+)?)\s*[-–~—至到]\s*(\d+(?:\.\d+)?)\s*(?:米|m\b)/);
  if (range) {
    const min = parseFloat(range[1]);
    const max = parseFloat(range[2]);
    if (Number.isFinite(min) && Number.isFinite(max) && min <= max) return { min, max };
  }
  const single = text.match(/(\d+(?:\.\d+)?)\s*(?:米|m\b)/);
  if (single) {
    const v = parseFloat(single[1]);
    if (Number.isFinite(v) && v > 0 && v <= 60) return { min: v, max: v };
  }
  return null;
}

/** 从耐寒文本提取最低温：「耐寒-5℃」「可耐-10℃低温」→ -5 / -10 */
export function deriveMinTemp(text: string): number | null {
  if (!text) return null;
  const m = text.match(/(-?\d+(?:\.\d+)?)\s*(?:℃|°C|°|度)/);
  if (!m) return null;
  const v = parseFloat(m[1]);
  return Number.isFinite(v) && v >= -40 && v <= 5 ? v : null;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function sameSet(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((n, i) => n === b[i]);
}

/** 逐字段校验 LLM 输出：非法值丢弃计入 invalid，缺失计入 unparsed/needsCheck */
export function validateParsed(raw: Record<string, unknown>): ParseOutcome {
  const fields: Record<string, unknown> = {};
  const invalid: ParseOutcome["invalid"] = [];
  const unparsed: string[] = [];
  const needsCheck: ParseOutcome["needsCheck"] = [];

  const hasWarning = raw["isWarning"] === true;
  for (const def of FIELD_DEFS) {
    const v = raw[def.key];
    const missing = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
    if (missing) {
      if (def.safety) {
        // warning.* 子字段以 isWarning=true 为前提；资料未提风险时不逐个子项打扰教师
        if (def.key !== "isWarning" && !hasWarning) continue;
        needsCheck.push({ field: def.key, label: def.label, note: "需教师确认" });
      } else {
        unparsed.push(def.label);
      }
      continue;
    }
    switch (def.kind) {
      case "text": {
        if (typeof v !== "string") {
          invalid.push({ field: def.label, reason: "应为文本" });
          break;
        }
        fields[def.key] = v.trim().slice(0, 500);
        break;
      }
      case "enum": {
        if (typeof v === "string" && (def.options as readonly string[]).includes(v.trim())) {
          fields[def.key] = v.trim();
        } else {
          invalid.push({ field: def.label, reason: `值「${String(v)}」不在允许范围内` });
        }
        break;
      }
      case "bool": {
        if (typeof v !== "boolean") {
          invalid.push({ field: def.label, reason: "应为布尔值" });
          break;
        }
        // 安全保守：isWarning 只接受 true（资料明确提及风险）；false 不自动采纳
        if (def.safety && v === false) {
          needsCheck.push({ field: def.key, label: def.label, note: "需教师确认" });
          break;
        }
        fields[def.key] = v;
        break;
      }
      case "number": {
        const n = typeof v === "number" ? v : parseFloat(String(v));
        if (!Number.isFinite(n) || n < (def.min ?? -Infinity) || n > (def.max ?? Infinity)) {
          invalid.push({ field: def.label, reason: `数值「${String(v)}」非法或越界` });
          break;
        }
        fields[def.key] = n;
        break;
      }
      case "months": {
        if (!Array.isArray(v)) {
          invalid.push({ field: def.label, reason: "应为月份数组" });
          break;
        }
        const months = [...new Set(v.map((x) => parseInt(String(x), 10)).filter((n) => n >= 1 && n <= 12))].sort((a, b) => a - b);
        if (!months.length) invalid.push({ field: def.label, reason: "无合法月份（1-12）" });
        else fields[def.key] = months;
        break;
      }
      case "array": {
        if (!Array.isArray(v)) {
          invalid.push({ field: def.label, reason: "应为数组" });
          break;
        }
        const items = [...new Set(v.map((x) => String(x ?? "").trim()).filter(Boolean))].slice(0, 20);
        if (!items.length) invalid.push({ field: def.label, reason: "数组为空" });
        else fields[def.key] = items;
        break;
      }
      case "enumArray": {
        if (!Array.isArray(v)) {
          invalid.push({ field: def.label, reason: "应为数组" });
          break;
        }
        const allowed = def.options as readonly string[];
        const items = [...new Set(v.map((x) => String(x ?? "").trim()).filter((x) => allowed.includes(x)))];
        if (!items.length) invalid.push({ field: def.label, reason: "无一项属于允许的标签集合" });
        else fields[def.key] = items;
        break;
      }
      case "seasonInterest": {
        if (!isPlainObject(v)) {
          invalid.push({ field: def.label, reason: "应为四季对象" });
          break;
        }
        const keys = ["spring", "summer", "autumn", "winter"] as const;
        const out: Record<string, number> = {};
        let ok = true;
        for (const k of keys) {
          const n = typeof v[k] === "number" ? (v[k] as number) : parseFloat(String(v[k]));
          if (!Number.isFinite(n) || n < 0 || n > 5) {
            ok = false;
            break;
          }
          out[k] = Math.round(n * 10) / 10;
        }
        if (!ok) invalid.push({ field: def.label, reason: "四季值应为 0-5 的数字" });
        else fields[def.key] = out;
        break;
      }
    }
  }

  // safeForChildren：AI 永不自动判定，固定提示教师确认
  needsCheck.push({ field: SAFE_CHILDREN_FIELD.key, label: SAFE_CHILDREN_FIELD.label, note: "需教师确认" });

  // ---- 派生字段自洽：以文本为准重新推算，矛盾时标记需核对 ----
  const heightText = typeof fields["height.text"] === "string" ? (fields["height.text"] as string) : "";
  const dh = deriveHeight(heightText);
  if (dh) {
    for (const [key, derived] of [["height.min", dh.min], ["height.max", dh.max]] as const) {
      const given = raw[key];
      if (given !== undefined && given !== null) {
        const n = parseFloat(String(given));
        if (Number.isFinite(n) && Math.abs(n - derived) > 0.01) {
          needsCheck.push({ field: key, label: key === "height.min" ? "高度下限" : "高度上限", note: `与描述「${heightText}」不一致，已按描述推算` });
        }
      }
      fields[key] = derived;
    }
  }

  const phenText = typeof fields["phenology.text"] === "string" ? (fields["phenology.text"] as string) : "";
  // 物候文本常同时含花期与果期：剔除果期片段后再推花期，避免把果期月份并入花期
  const dm = deriveMonths(phenText.replace(/果期[^。，；,;]*/g, ""));
  if (dm.length && Array.isArray(fields["phenology.flowerMonths"]) && !sameSet(dm, fields["phenology.flowerMonths"] as number[])) {
    needsCheck.push({ field: "phenology.flowerMonths", label: "花期月份", note: `与描述「${phenText}」不一致，已按描述推算` });
    fields["phenology.flowerMonths"] = dm;
  }

  const hardText = typeof fields["hardiness.text"] === "string" ? (fields["hardiness.text"] as string) : "";
  const dt = deriveMinTemp(hardText);
  if (dt !== null && raw["hardiness.minTempC"] !== undefined && raw["hardiness.minTempC"] !== null) {
    const given = parseFloat(String(raw["hardiness.minTempC"]));
    if (Number.isFinite(given) && Math.abs(given - dt) > 0.01) {
      needsCheck.push({ field: "hardiness.minTempC", label: "耐寒最低温", note: `与描述「${hardText}」不一致，已按描述推算` });
      fields["hardiness.minTempC"] = dt;
    }
  }

  return { fields, invalid, unparsed, needsCheck, ...validateQuestions(raw.questions) };
}

/** 练习题校验：维度必须在既有集合内、4 选项齐全、必须有正确答案；每维度至多 1 题 */
export function validateQuestions(rawQs: unknown): { questions: QuizQuestion[]; droppedQuestions: { index: number; reason: string }[] } {
  const questions: QuizQuestion[] = [];
  const droppedQuestions: { index: number; reason: string }[] = [];
  if (!Array.isArray(rawQs)) return { questions, droppedQuestions };
  const usedDims = new Set<string>();
  const usedStems = new Set<string>();
  rawQs.slice(0, 12).forEach((item, i) => {
    const drop = (reason: string) => droppedQuestions.push({ index: i + 1, reason });
    if (!isPlainObject(item)) return drop("结构非法");
    const dimension = String(item.dimension ?? "").trim();
    if (!(QUIZ_DIMENSIONS as readonly string[]).includes(dimension)) return drop(`维度「${dimension}」不在既有维度集合内`);
    if (usedDims.has(dimension)) return drop(`维度「${dimension}」重复（每维度限 1 题）`);
    const q = String(item.q ?? "").trim();
    if (!q) return drop("题干为空");
    if (usedStems.has(q)) return drop("题干重复");
    const options = Array.isArray(item.options) ? item.options.map((o) => String(o ?? "").trim()) : [];
    if (options.length < 4 || options.slice(0, 4).some((o) => !o)) return drop("选项不足 4 个或含空选项");
    const answerIndex = Number(item.answerIndex);
    if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) return drop("缺正确答案标记");
    usedDims.add(dimension);
    usedStems.add(q);
    questions.push({
      q,
      dimension,
      options: options.slice(0, 4),
      answerIndex,
      explain: String(item.explain ?? "").trim().slice(0, 300),
    });
  });
  return { questions, droppedQuestions };
}

/** 容错提取 LLM 输出中的 JSON：允许 ```json 包裹与前后说明文字 */
export function extractLlmJson(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  const target = fenced?.[1] ?? text.match(/\{[\s\S]*\}/)?.[0];
  if (!target) return null;
  try {
    const parsed = JSON.parse(target) as unknown;
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
