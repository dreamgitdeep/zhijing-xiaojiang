import { NextResponse } from "next/server";
import { LLMClient } from "coze-coding-dev-sdk";
import { getSessionUser } from "@/lib/auth";
import {
  CATEGORIES,
  FUNCTION_TAGS,
  LAYERS,
  LIGHT_NEED,
  PEAK_SEASON,
  QUIZ_DIMENSIONS,
  REGION_TAGS,
  RESTRICTIONS,
  RISK_TYPES,
  SOIL_DRAINAGE,
  SOIL_PH,
  TAG_GROUPS,
  WATER_NEED,
  extractLlmJson,
  validateParsed,
} from "@/lib/plant-parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_TEXT_LEN = 8000;
const LIMIT_PER_MINUTE = 5;
const LIMIT_PER_DAY = 100;
const usage = new Map<string, number[]>();

function checkRateLimit(userId: string): { ok: true } | { ok: false; reason: string } {
  const now = Date.now();
  const stamps = (usage.get(userId) ?? []).filter((t) => now - t < 24 * 3600 * 1000);
  const lastMinute = stamps.filter((t) => now - t < 60 * 1000).length;
  if (lastMinute >= LIMIT_PER_MINUTE) return { ok: false, reason: "识别太频繁，请稍后再试（每分钟最多 5 次）" };
  if (stamps.length >= LIMIT_PER_DAY) return { ok: false, reason: "今日识别次数已达上限（每天 100 次），请明天再试" };
  stamps.push(now);
  usage.set(userId, stamps);
  if (usage.size > 2000) usage.delete(usage.keys().next().value as string);
  return { ok: true };
}

function buildPrompt(text: string): string {
  return `你是植物数据结构化助手。严格依据下方【资料文本】抽取植物信息并生成练习题，只输出一个 JSON 对象，不输出任何解释文字。
【硬性规则】
1. 只抽取资料中明确写出的内容，禁止臆造、禁止补充资料未提及的常识；无法确定的字段直接省略该键。
2. 枚举字段的值只能从给定白名单中挑选；白名单中没有合适项就省略。
3. 数字必须忠于资料原文（单位：米、℃）；月份用 1-12 的整数。
4. 安全字段保守处理：仅当资料明确提到有毒/有刺/致敏等风险时，才输出 isWarning=true 与 warning.* 各项；资料未提及风险时，不输出任何安全字段，严禁输出"安全"类判断。
5. 生成 6 道单选练习题，维度各出 1 题（维度只能从：${QUIZ_DIMENSIONS.join("、")} 中选），题干互不重复且必须基于资料中的事实，考查识别要点与造景应用；每题 4 个选项，answerIndex 为正确答案下标（0-3），explain ≤60 字。
【输出 JSON 结构】
{
  "fields": {
    "name": 中文名称, "latin": 拉丁学名, "alias": [别名],
    "category": "${CATEGORIES.join("|")}" 之一,
    "layer": "${LAYERS.join("|")}" 之一（乔木/灌木/草本/藤本/竹类）,
    "lifeForm": 生活型描述,
    "light.text": 光照描述, "light.need": "${LIGHT_NEED.join("|")}" 之一（sun=喜光 sun_to_semi=喜光至半阴 semi=耐阴/喜半阴）,
    "light.shadeTolerant": 是否耐阴(布尔),
    "water.text": 水分描述, "water.need": "${WATER_NEED.join("|")}" 之一（dry=耐旱 medium=中等 moist=喜湿润 wet=喜湿/水生）,
    "water.avoidWaterlog": 是否忌积水(布尔),
    "soil.text": 土壤描述, "soil.ph": "${SOIL_PH.join("|")}" 之一（acid=喜酸性 neutral=中性 alkaline=耐碱性 acid_to_neutral=酸性至中性 any=不严）,
    "soil.drainage": "${SOIL_DRAINAGE.join("|")}" 之一（well=要求排水良好 any=不严）,
    "soil.tolerant": 是否耐瘠薄(布尔),
    "hardiness.text": 耐寒性描述（含具体温度时写明）, "hardiness.minTempC": 耐寒最低温数字, "hardiness.zoneMin": 数字, "hardiness.zoneMax": 数字,
    "height.text": 高度描述（如"2-5米"）,
    "ornamentalPart": 观赏部位（如"叶、花、果"）, "color": 主要观赏颜色,
    "usage": [园林用途], "region": 产地分布,
    "phenology.text": 物候描述（含花期果期，如"花期3-5月，果期9-10月"）,
    "phenology.flowerMonths": [花期月份整数], "phenology.fruitMonths": [果期月份整数],
    "phenology.peakSeason": "${PEAK_SEASON.join("|")}" 之一（观赏旺季）,
    "phenology.seasonInterest": {"spring":0-5,"summer":0-5,"autumn":0-5,"winter":0-5}（四季观赏强度，资料无依据则省略）,
    "phenology.evergreen": 常绿(布尔), "phenology.deciduous": 落叶(布尔), "phenology.autumnColor": 秋色叶(布尔),
    "tagGroups": [仅可从：${TAG_GROUPS.join("、")} 中选],
    "functionTags": [仅可从：${FUNCTION_TAGS.join("、")} 中选],
    "regionTags": [仅可从：${REGION_TAGS.join("、")} 中选],
    "isWarning": true（仅资料明确提及风险时输出）,
    "warning.riskType": "${RISK_TYPES.join("|")}" 之一,
    "warning.restriction": "${RESTRICTIONS.join("|")}" 之一（forbid=禁止进校园绿地 caution=慎用）,
    "warning.riskPart": 风险部位, "warning.symptom": 中毒症状, "warning.consequence": 后果
  },
  "questions": [{"dimension": 维度, "q": 题干, "options": [4个选项], "answerIndex": 0-3, "explain": 解析}]
}
【资料文本】
${text}`;
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED", message: "请先登录" }, { status: 401 });
  if (user.role !== "teacher") return NextResponse.json({ error: "FORBIDDEN", message: "仅教师可使用智能识别" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "EMPTY_TEXT", message: "请先填写要识别的植物资料" }, { status: 400 });
  if (text.length > MAX_TEXT_LEN) {
    return NextResponse.json({ error: "TEXT_TOO_LONG", message: `资料过长（超过 ${MAX_TEXT_LEN} 字），请精简后再识别` }, { status: 400 });
  }

  const limit = checkRateLimit(user.id);
  if (!limit.ok) return NextResponse.json({ error: "RATE_LIMITED", message: limit.reason }, { status: 429 });

  try {
    const llm = new LLMClient();
    const events = llm.stream(
      [{ role: "user", content: buildPrompt(text) }],
      { model: "doubao-seed-2-0-lite-260215" },
    );
    let raw = "";
    for await (const event of events) {
      raw += typeof event?.content === "string" ? event.content : event?.content?.toString() ?? "";
    }
    const parsed = extractLlmJson(raw);
    if (!parsed) {
      return NextResponse.json({ error: "PARSE_FAILED", message: "识别结果解析失败，请重试或补充资料后重新识别" }, { status: 502 });
    }
    const result = validateParsed({
      ...(typeof parsed.fields === "object" && parsed.fields !== null ? (parsed.fields as Record<string, unknown>) : {}),
      questions: parsed.questions,
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "LLM_FAILED", message: "智能识别服务暂不可用，请稍后重试" }, { status: 502 });
  }
}
