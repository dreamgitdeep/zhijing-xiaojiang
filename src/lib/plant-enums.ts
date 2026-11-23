/** 图鉴筛选 UI 与校验共用的小型枚举（独立模块，避免首屏拉入 plant-parse 全量） */
export const LIGHT_NEED = ["semi", "sun", "sun_to_semi"] as const;
export const WATER_NEED = ["dry", "medium", "moist", "wet"] as const;
export const SOIL_PH = ["acid", "acid_to_neutral", "neutral", "alkaline", "any"] as const;
export const SOIL_DRAINAGE = ["any", "well"] as const;
