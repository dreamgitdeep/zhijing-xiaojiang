export type LayerKey = 'tree' | 'shrub' | 'herb' | 'vine' | 'bamboo';
export type Restriction = 'forbid' | 'caution';
export type SafetyFilter = 'all' | 'warning' | 'safeForChildren' | 'forbid';

export interface LightInfo {
  text: string;
  need: string;
  shadeTolerant?: boolean;
  sunTolerant?: boolean;
}

export interface WaterInfo {
  text: string;
  need: string;
  avoidWaterlog?: boolean;
}

export interface SoilInfo {
  text: string;
  ph: string;
  drainage: string;
  tolerant?: boolean;
}

export interface HardinessInfo {
  text: string;
  minTempC?: number | null;
  zoneMin?: number | null;
  zoneMax?: number | null;
  evergreenSouthOnly?: boolean;
}

export interface SeasonInterest {
  spring: number;
  summer: number;
  autumn: number;
  winter: number;
}

export interface Phenology {
  flowerMonths: number[];
  fruitMonths: number[];
  text: string;
  evergreen?: boolean;
  deciduous?: boolean;
  autumnColor?: boolean;
  seasonInterest: SeasonInterest;
  peakSeason: string;
}

export interface PlantImages {
  full: string;
  close: string;
  thumb: string;
}

export interface ImageCreditInfo {
  license?: string;
  attribution?: string;
  photographer?: string;
  pageUrl?: string;
}

export interface WarningInfo {
  riskType: string;
  riskLevel: string;
  riskPart: string;
  symptom: string;
  consequence: string;
  identify: string;
  teachUse: string;
  banReason?: string;
  restriction: Restriction;
}

export interface QuizQuestion {
  /** 题目稳定 ID：掌握判定按题聚合历史的依据。教师增删题时保持不变，新增题目前端生成。 */
  qid?: string;
  q: string;
  dimension: string;
  options: string[];
  answerIndex: number;
  explain: string;
}

export interface Plant {
  id: string;
  seq?: number;
  name: string;
  latin: string;
  alias: string[];
  category: string;
  taxon?: string;
  lifeForm?: string;
  layer: LayerKey;
  functionTags: string[];
  tagGroups: string[];
  regionTags: string[];
  light: LightInfo;
  water: WaterInfo;
  soil: SoilInfo;
  hardiness: HardinessInfo;
  height?: { text: string; min?: number; max?: number };
  canopy?: { min?: number; max?: number; estimated?: number | string };
  ornamentalPart?: string;
  color?: string;
  phenology: Phenology;
  usage: string[];
  region?: string;
  notes?: string;
  images: PlantImages;
  source?: string;
  imageCredit?: { full?: ImageCreditInfo; close?: ImageCreditInfo };
  isWarning: boolean;
  warning: WarningInfo | null;
  safeForChildren: boolean;
  quiz: QuizQuestion[];
}

/** 图鉴首屏卡片最小字段：不含 quiz/答案/笔记/生态明细，详情按需从 /api/plants/[id] 加载 */
export interface PlantLite {
  id: string;
  name: string;
  latin: string;
  category: string;
  layer: LayerKey;
  alias: string[];
  functionTags: string[];
  tagGroups: string[];
  regionTags: string[];
  thumb: string;
  isWarning: boolean;
  /** 无警示时序列化省略，降低首屏传输量 */
  restriction?: Restriction;
  safeForChildren: boolean;
  phenologyText: string;
  light: string;
  water: string;
  soilPh: string;
  soilDrainage: string;
}

export function toPlantLite(p: Plant): PlantLite {
  return {
    id: p.id,
    name: p.name,
    latin: p.latin,
    category: p.category,
    layer: p.layer,
    alias: p.alias ?? [],
    functionTags: p.functionTags ?? [],
    tagGroups: p.tagGroups ?? [],
    regionTags: p.regionTags ?? [],
    thumb: p.images.thumb,
    isWarning: p.isWarning,
    restriction: p.warning?.restriction,
    safeForChildren: p.safeForChildren,
    phenologyText: p.phenology?.text ?? '',
    light: p.light?.need ?? '',
    water: p.water?.need ?? '',
    soilPh: p.soil?.ph ?? '',
    soilDrainage: p.soil?.drainage ?? '',
  };
}

export interface FiltersMeta {
  categories: string[];
  layers: { key: LayerKey; label: string }[];
  tagGroups: string[];
  regions?: string[];
  safety: string[];
}

export interface PlantsDataset {
  version?: string;
  total: number;
  filters: FiltersMeta;
  /** 练习题维度（题库结构约束，教师出题只能从中选择） */
  quizDimensions?: string[];
  plants: Plant[];
}

const layerLabels: Record<LayerKey, string> = {
  tree: '乔木',
  shrub: '灌木',
  herb: '草本',
  vine: '藤本',
  bamboo: '竹类',
};

export function layerLabel(key: LayerKey): string {
  return layerLabels[key] ?? key;
}