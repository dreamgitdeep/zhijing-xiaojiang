/** AI 辅助搜索：受约束的结构化筛选条件（字段与取值全部来自 plant-parse 白名单） */
export interface AiConditions {
  category?: string;
  layer?: string;
  light?: string;
  water?: string;
  soilPh?: string;
  soilDrainage?: string;
  tagGroups?: string[];
  functionTags?: string[];
  regionTags?: string[];
  /** true=仅警示植物；false=仅无警示（"无刺无毒"类诉求） */
  isWarning?: boolean;
  keyword?: string;
}

/** 左栏 UI 不直接承载、需以「已选标签」形式呈现的维度 */
export interface AiExtra {
  functionTags: string[];
  regionTags: string[];
  soilDrainage?: string;
}

export const LAYER_LABEL: Record<string, string> = {
  tree: "乔木", shrub: "灌木", herb: "草本", vine: "藤本", bamboo: "竹类",
};
export const LIGHT_LABEL: Record<string, string> = {
  semi: "耐半阴", sun: "喜光", sun_to_semi: "喜光亦耐半阴",
};
export const WATER_LABEL: Record<string, string> = {
  dry: "耐旱", medium: "水分中等", moist: "喜湿润", wet: "耐水湿",
};
export const PH_LABEL: Record<string, string> = {
  acid: "酸性土", acid_to_neutral: "酸至中性土", neutral: "中性土", alkaline: "碱性土", any: "对土壤酸碱度不挑",
};
export const DRAIN_LABEL: Record<string, string> = { any: "排水要求不严", well: "需排水良好" };
