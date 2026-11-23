/**
 * S4 植物筛选与合规审查 —— 同构纯函数引擎（客户端实时提示 + 服务端评阅共用一套口径）。
 * 保守原则：植物资料未提及毒性时不得判为"安全"，只能提示"需核实"。
 */
import type { Plant } from "./types";

/* ---------- 分区场地条件（S4 由学生标注） ---------- */
export type LightCond = "sun" | "semi" | "shade" | "unknown";
export type WaterCond = "dry" | "moist" | "waterlog" | "unknown";
export type UsageCond = "children" | "resting" | "ornamental" | "production" | "eco" | "unknown";

export interface ZoneConditions {
  light: LightCond;
  water: WaterCond;
  usage: UsageCond;
}

export const EMPTY_CONDITIONS: ZoneConditions = { light: "unknown", water: "unknown", usage: "unknown" };

export const LIGHT_COND_LABEL: Record<LightCond, string> = {
  sun: "强光为主",
  semi: "半阴",
  shade: "荫蔽",
  unknown: "未标注",
};
export const WATER_COND_LABEL: Record<WaterCond, string> = {
  dry: "偏干",
  moist: "湿润",
  waterlog: "低洼易积水",
  unknown: "未标注",
};
export const USAGE_COND_LABEL: Record<UsageCond, string> = {
  children: "儿童活动",
  resting: "休憩停留",
  ornamental: "观赏漫步",
  production: "生产采摘",
  eco: "生态保育",
  unknown: "未标注",
};

/* ---------- 植物投影（只保留选择器与合规所需字段） ---------- */
export interface PlantPick {
  id: string;
  name: string;
  latin: string;
  category: string;
  layer: Plant["layer"];
  thumb: string;
  alias: string[];
  functionTags: string[];
  tagGroups: string[];
  isWarning: boolean;
  restriction?: "forbid" | "caution";
  riskType?: string;
  safeForChildren: boolean;
  phenologyText: string;
  lightNeed: string;
  shadeTolerant: boolean;
  sunTolerant: boolean;
  waterNeed: string;
  avoidWaterlog: boolean;
  edible: boolean;
}

export function toPlantPick(p: Plant): PlantPick {
  const tags = p.functionTags ?? [];
  return {
    id: p.id,
    name: p.name,
    latin: p.latin,
    category: p.category,
    layer: p.layer,
    thumb: p.images?.thumb ?? "",
    alias: p.alias ?? [],
    functionTags: tags,
    tagGroups: p.tagGroups ?? [],
    isWarning: p.isWarning,
    restriction: p.warning?.restriction,
    riskType: p.warning?.riskType,
    safeForChildren: p.safeForChildren,
    phenologyText: p.phenology?.text ?? "",
    lightNeed: p.light?.need ?? "",
    shadeTolerant: !!p.light?.shadeTolerant,
    sunTolerant: !!p.light?.sunTolerant,
    waterNeed: p.water?.need ?? "",
    avoidWaterlog: !!p.water?.avoidWaterlog,
    edible: tags.includes("食用") || tags.includes("食用浆果") || ["蔬食作物", "食用灌木"].includes(p.category),
  };
}

/* ---------- 合规提示 ---------- */
export type HintLevel = "error" | "warn" | "info";
export interface ComplianceHint {
  level: HintLevel;
  text: string;
}

const isToxic = (risk?: string) => !!risk && (risk.includes("毒"));

/** 单个植物在指定分区条件下的安全 + 生态提示。 */
export function plantHints(p: PlantPick, cond: ZoneConditions): ComplianceHint[] {
  const hints: ComplianceHint[] = [];
  const usage = cond.usage;

  // —— 安全合规 ——
  if (p.restriction === "forbid") {
    hints.push({ level: "error", text: `「${p.name}」为禁植植物，不应选用。` });
  } else if (p.isWarning && p.riskType) {
    const rt = p.riskType;
    if (isToxic(rt)) {
      if (usage === "children") hints.push({ level: "error", text: `「${p.name}」${rt}，不宜用于儿童活动区。` });
      else if (usage === "resting") hints.push({ level: "warn", text: `「${p.name}」${rt}，用于休憩停留区需谨慎。` });
      else hints.push({ level: "info", text: `「${p.name}」${rt}，注意种植位置并设提示。` });
    } else if (rt.includes("刺")) {
      if (usage === "children" || usage === "resting")
        hints.push({ level: "warn", text: `「${p.name}」有刺，不宜靠近儿童活动/休憩停留区。` });
      else hints.push({ level: "info", text: `「${p.name}」有刺，注意与活动路线保持距离。` });
    } else if (rt.includes("致敏")) {
      if (usage === "children") hints.push({ level: "warn", text: `「${p.name}」易致敏，不宜用于儿童活动区。` });
      else hints.push({ level: "info", text: `「${p.name}」易致敏，敏感人群需注意。` });
    } else if (p.restriction === "caution") {
      hints.push({ level: "info", text: `「${p.name}」为慎用植物（${rt}）。` });
    }
  } else if (usage === "children" && !p.safeForChildren) {
    // 保守原则：资料未提及毒性不判安全，只提示核实
    hints.push({ level: "info", text: `「${p.name}」毒性资料未提及，用于儿童活动区前需核实。` });
  }

  // —— 生态适配 ——
  if (cond.light === "shade" && p.lightNeed === "sun" && !p.shadeTolerant) {
    hints.push({ level: "warn", text: `「${p.name}」喜强光，分区偏荫蔽，长势可能受限。` });
  }
  if (cond.light === "sun" && p.lightNeed === "semi" && !p.sunTolerant) {
    hints.push({ level: "warn", text: `「${p.name}」偏耐阴，强光下易灼伤。` });
  }
  if (cond.water === "waterlog" && (p.avoidWaterlog || p.waterNeed === "dry")) {
    hints.push({ level: "warn", text: `「${p.name}」不耐积水，分区低洼易积水，易烂根。` });
  }
  if (cond.water === "dry" && (p.waterNeed === "moist" || p.waterNeed === "wet")) {
    hints.push({ level: "info", text: `「${p.name}」喜湿，分区偏干，需注意补水。` });
  }

  return hints;
}

export interface ZoneWithPlants {
  zoneId: string;
  name: string;
  conditions: ZoneConditions;
  plants: PlantPick[];
}

/** 分区级汇总：逐植物提示 + 重复/数量/条件未标注等轻提示。 */
export function zoneHints(zone: ZoneWithPlants): ComplianceHint[] {
  const hints: ComplianceHint[] = [];
  const c = zone.conditions;

  if (c.light === "unknown" && c.water === "unknown" && c.usage === "unknown") {
    hints.push({ level: "info", text: "该分区尚未标注场地条件，暂无法做安全与生态适配判断。" });
  }

  const seen = new Set<string>();
  for (const p of zone.plants) {
    if (seen.has(p.id)) {
      hints.push({ level: "info", text: `「${p.name}」在该分区被重复选择。` });
    }
    seen.add(p.id);
    hints.push(...plantHints(p, c));
  }

  if (zone.plants.length === 0) hints.push({ level: "info", text: "该分区还未选择植物。" });
  else if (zone.plants.length > 12) hints.push({ level: "info", text: "该分区植物种类较多，注意疏密与层次。" });

  return hints;
}

/** 汇总所有分区提示，用于评阅时统计问题数量。 */
export function allZoneHints(zones: ZoneWithPlants[]): ComplianceHint[] {
  return zones.flatMap((z) => zoneHints(z));
}
