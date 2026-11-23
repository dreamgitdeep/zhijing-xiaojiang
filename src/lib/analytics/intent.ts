/**
 * AI 学情分析——结构化查询意图（四段式架构的 ①/② 段契约）。
 *
 * 红线：LLM 只输出本文件定义的白名单字段；服务端只把这些字段映射到
 * metrics.ts 里的预定义聚合，绝不拼接 SQL。
 */

/** 指标白名单：每个 key 对应 metrics.ts 里一个预定义聚合执行器 */
export type MetricKey =
  | "overview"
  | "class_mastery"
  | "student_ranking"
  | "practice_trend"
  | "plant_difficulty"
  | "task_submission"
  | "task_stage_scores"
  | "active_students";

/** 分组维度白名单（仅部分指标使用，其余指标分组固定） */
export type GroupKey = "day" | "week";

export interface IntentFilters {
  className?: string;
  studentName?: string;
  studentNo?: string;
  taskTitle?: string;
  plantName?: string;
  /** 时间窗口（天），仅 practice_trend / active_students 使用 */
  days?: number;
  /** active_students 专用：看活跃还是未活跃 */
  activeMode?: "active" | "inactive";
}

export interface QueryIntent {
  metric: MetricKey;
  groupBy?: GroupKey;
  filters?: IntentFilters;
  sortBy?: "mastered" | "attempts" | "avg" | "active" | "value";
  sortOrder?: "asc" | "desc";
  limit?: number;
}

export interface MetricMeta {
  key: MetricKey;
  label: string;
  /** 给 LLM 的指标说明（何时选它） */
  desc: string;
  /** 示例问法（也用于前端示例问题引导） */
  examples: string[];
}

/** 指标目录：注入给 ① 段 LLM 做选择，也用于 ② 段澄清提示 */
export const METRIC_CATALOG: MetricMeta[] = [
  {
    key: "overview",
    label: "总体概况",
    desc: "全班/全课程总览：学生数、班级数、近 7 天活跃人数、人均掌握种数、练习总次数、植物库条数、已发布任务数。问『整体情况』『概况』时选它。",
    examples: ["整体学情概况如何", "课程现在总体情况怎么样"],
  },
  {
    key: "class_mastery",
    label: "班级掌握对比",
    desc: "按班级对比人均掌握植物种数与人数。问『哪个班掌握得好』『各班对比』时选它。",
    examples: ["各班掌握情况对比", "哪个班掌握得最好"],
  },
  {
    key: "student_ranking",
    label: "学生学情排行",
    desc: "按学生列出掌握种数、练习次数、平均正确率、最近活跃；可只看某个学生或某个班。问『某个学生怎么样』『谁掌握最多』时选它。",
    examples: ["张三的学习情况", "掌握最多的前 5 名学生", "测试班的学生表现"],
  },
  {
    key: "practice_trend",
    label: "练习趋势",
    desc: "近 N 天每天的练习次数（可含平均正确率）。问『最近练习活跃吗』『练习趋势』时选它。",
    examples: ["近两周的练习趋势", "最近 7 天大家练得勤吗"],
  },
  {
    key: "plant_difficulty",
    label: "植物难度榜",
    desc: "按植物统计练习次数与平均正确率，找出最难/最易的植物。问『哪种植物最难』『哪种植物错得多』时选它。",
    examples: ["哪些植物学生最容易答错", "最难的 5 种植物"],
  },
  {
    key: "task_submission",
    label: "设计任务提交概况",
    desc: "已发布植景设计任务的应提交、已提交、提交率、达标数。问『任务提交得怎么样』时选它。",
    examples: ["设计任务提交率如何", "创智农园任务有多少人交了"],
  },
  {
    key: "task_stage_scores",
    label: "任务阶段得分分布",
    desc: "单个任务各阶段的提交与得分分布、学生总分明细。问『某任务各阶段得分』『某任务谁没过关』时选它。需指定任务。",
    examples: ["创智农园任务各阶段得分分布", "这个任务哪些学生没达标"],
  },
  {
    key: "active_students",
    label: "活跃/未活跃名单",
    desc: "近 N 天内有练习（活跃）或无练习（未活跃/疑似下滑）的学生名单。问『谁最近没练』『哪些学生下滑了』时选它。",
    examples: ["最近一周谁没有练习", "近 7 天活跃的学生有哪些"],
  },
];

export const METRIC_KEYS = METRIC_CATALOG.map((m) => m.key);

export function metricLabel(key: MetricKey): string {
  return METRIC_CATALOG.find((m) => m.key === key)?.label ?? key;
}

/** 前端示例问题引导（从目录各指标取首条示例） */
export const EXAMPLE_QUESTIONS: string[] = [
  "整体学情概况如何？",
  "各班掌握情况对比",
  "最近一周谁没有练习？",
  "哪些植物学生最容易答错？",
  "设计任务提交率如何？",
];
