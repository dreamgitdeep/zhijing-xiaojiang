import {
  CATEGORIES,
  LAYERS,
  LIGHT_NEED,
  WATER_NEED,
  SOIL_PH,
  SOIL_DRAINAGE,
  TAG_GROUPS,
  REGION_TAGS,
  FUNCTION_TAGS,
} from "./plant-parse";
import type { PlantLite } from "./types";
import { LAYER_LABEL, LIGHT_LABEL, WATER_LABEL, PH_LABEL, DRAIN_LABEL } from "./ai-search-labels";
import type { AiConditions, AiExtra } from "./ai-search-labels";

export type { AiConditions, AiExtra } from "./ai-search-labels";
export { LAYER_LABEL, LIGHT_LABEL, WATER_LABEL, PH_LABEL, DRAIN_LABEL } from "./ai-search-labels";

export function describeConditions(c: AiConditions): string[] {
  const out: string[] = [];
  if (c.category) out.push(`分类：${c.category}`);
  if (c.layer) out.push(`层级：${LAYER_LABEL[c.layer] ?? c.layer}`);
  if (c.light) out.push(`光照：${LIGHT_LABEL[c.light] ?? c.light}`);
  if (c.water) out.push(`水分：${WATER_LABEL[c.water] ?? c.water}`);
  if (c.soilPh) out.push(`土壤：${PH_LABEL[c.soilPh] ?? c.soilPh}`);
  if (c.soilDrainage) out.push(`排水：${DRAIN_LABEL[c.soilDrainage] ?? c.soilDrainage}`);
  if (c.tagGroups?.length) out.push(`功能组：${c.tagGroups.join("、")}`);
  if (c.functionTags?.length) out.push(`功能标签：${c.functionTags.join("、")}`);
  if (c.regionTags?.length) out.push(`适生区域：${c.regionTags.join("、")}`);
  if (c.isWarning === true) out.push("仅看警示植物");
  if (c.isWarning === false) out.push("仅看无警示植物");
  if (c.keyword) out.push(`关键词：${c.keyword}`);
  return out;
}

function inList(v: unknown, list: readonly string[]): v is string {
  return typeof v === "string" && (list as readonly unknown[]).includes(v);
}

/** 服务端逐字段校验：非法字段/取值一律丢弃并计入 unrecognized，绝不透传查库 */
export function validateAiConditions(raw: unknown): { conditions: AiConditions; unrecognized: { field: string; value: string }[] } {
  const c: AiConditions = {};
  const unrecognized: { field: string; value: string }[] = [];
  const drop = (field: string, value: unknown) => unrecognized.push({ field, value: String(value) });
  if (!raw || typeof raw !== "object") return { conditions: c, unrecognized };
  const r = raw as Record<string, unknown>;

  // LLM 常见偏差：单值包成数组、大小写/空格、截断的中文名（如「花灌木」→「花灌木/绿篱」）
  const pickScalar = (v: unknown, list: readonly string[]): string | null => {
    const first: unknown = Array.isArray(v) ? v[0] : v;
    if (typeof first !== "string") return null;
    const s = first.trim().toLowerCase();
    if (!s) return null;
    if ((list as readonly string[]).includes(s)) return s;
    const cands = (list as readonly string[]).filter(x => x.includes(s) || s.includes(x));
    return cands.length === 1 ? cands[0] : null;
  };
  const scalar = (field: string, v: unknown, list: readonly string[]): string | null => {
    if (v === undefined || v === null || v === "") return null;
    const m = pickScalar(v, list);
    if (!m) drop(field, Array.isArray(v) ? v.join(",") : v);
    return m;
  };

  const category = scalar("category", r.category, CATEGORIES);
  if (category) c.category = category;
  const ZH_LAYER: Record<string, string> = { 乔木: "tree", 灌木: "shrub", 草本: "herb", 藤本: "vine", 竹类: "bamboo" };
  const rawLayer = Array.isArray(r.layer) ? r.layer[0] : r.layer;
  const layer = scalar("layer", typeof rawLayer === "string" ? (ZH_LAYER[rawLayer.trim()] ?? rawLayer) : rawLayer, LAYERS);
  if (layer) c.layer = layer;
  const light = scalar("light", r.light, LIGHT_NEED);
  if (light) c.light = light;
  const water = scalar("water", r.water, WATER_NEED);
  if (water) c.water = water;
  const soilPh = scalar("soilPh", r.soilPh, SOIL_PH);
  if (soilPh) c.soilPh = soilPh;
  const soilDrainage = scalar("soilDrainage", r.soilDrainage, SOIL_DRAINAGE);
  if (soilDrainage) c.soilDrainage = soilDrainage;

  const arr = (v: unknown, list: readonly string[]) =>
    Array.isArray(v) ? v.filter((x): x is string => inList(x, list)) : [];
  const arrDropped = (field: string, v: unknown, list: readonly string[]) => {
    if (!Array.isArray(v)) return [];
    const bad = v.filter(x => !inList(x, list));
    bad.forEach(x => drop(field, x));
    return v.filter((x): x is string => inList(x, list));
  };

  if (r.tagGroups !== undefined) { const v = arrDropped("tagGroups", r.tagGroups, TAG_GROUPS); if (v.length) c.tagGroups = v; }
  if (r.functionTags !== undefined) { const v = arrDropped("functionTags", r.functionTags, FUNCTION_TAGS); if (v.length) c.functionTags = v; }
  if (r.regionTags !== undefined) { const v = arrDropped("regionTags", r.regionTags, REGION_TAGS); if (v.length) c.regionTags = v; }
  if (r.isWarning === true) c.isWarning = true;
  else if (r.isWarning === false) c.isWarning = false;
  else if (r.isWarning !== undefined && r.isWarning !== null && r.isWarning !== "") drop("isWarning", r.isWarning);
  if (typeof r.keyword === "string" && r.keyword.trim()) c.keyword = r.keyword.trim().slice(0, 40);

  return { conditions: c, unrecognized };
}

export function matchesConditions(p: PlantLite, c: AiConditions): boolean {
  if (c.category && p.category !== c.category) return false;
  if (c.layer && p.layer !== c.layer) return false;
  if (c.light) {
    const need = p.light;
    const ok = need === c.light || (need === "sun_to_semi" && (c.light === "sun" || c.light === "semi"));
    if (!ok) return false;
  }
  if (c.water && p.water !== c.water) return false;
  if (c.soilPh) {
    const ph = p.soilPh;
    const ok = ph === "any" || ph === c.soilPh
      || (ph === "acid_to_neutral" && (c.soilPh === "acid" || c.soilPh === "neutral"));
    if (!ok) return false;
  }
  if (c.soilDrainage && !(p.soilDrainage === c.soilDrainage || (c.soilDrainage === "well" && p.soilDrainage === "any"))) return false;
  if (c.tagGroups?.length && !c.tagGroups.some(t => p.tagGroups.includes(t))) return false;
  if (c.functionTags?.length && !c.functionTags.some(t => p.functionTags.includes(t))) return false;
  if (c.regionTags?.length && !c.regionTags.some(t => p.regionTags.includes(t))) return false;
  if (c.isWarning === true && !p.isWarning) return false;
  if (c.isWarning === false && p.isWarning) return false;
  if (c.keyword) {
    const hay = [p.name, p.latin, ...p.alias, ...p.functionTags].join(" ").toLowerCase();
    if (!hay.includes(c.keyword.toLowerCase())) return false;
  }
  return true;
}

export function extraOf(c: AiConditions): AiExtra {
  return {
    functionTags: c.functionTags ?? [],
    regionTags: c.regionTags ?? [],
    soilDrainage: c.soilDrainage,
  };
}
