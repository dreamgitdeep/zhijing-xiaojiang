import { NextResponse } from "next/server";
import { LLMClient } from "coze-coding-dev-sdk";
import { requireUserToken } from "@/lib/auth";
import { loadPlantsForServer } from "@/lib/data";
import { toPlantLite } from "@/lib/types";
import { extractLlmJson } from "@/lib/plant-parse";
import { validateAiConditions, matchesConditions, describeConditions } from "@/lib/ai-search";
import {
  CATEGORIES, LAYERS, LIGHT_NEED, WATER_NEED, SOIL_PH, SOIL_DRAINAGE,
  TAG_GROUPS, REGION_TAGS, FUNCTION_TAGS,
} from "@/lib/plant-parse";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LIMIT_PER_MINUTE = 5;
const LIMIT_PER_DAY = 50;
const usage = new Map<string, number[]>();

function checkRateLimit(userId: string): { ok: true } | { ok: false; reason: string } {
  const now = Date.now();
  const stamps = (usage.get(userId) ?? []).filter(t => now - t < 24 * 3600 * 1000);
  const lastMinute = stamps.filter(t => now - t < 60 * 1000).length;
  if (lastMinute >= LIMIT_PER_MINUTE) return { ok: false, reason: "AI 搜索太频繁，请稍后再试（每分钟最多 5 次）" };
  if (stamps.length >= LIMIT_PER_DAY) return { ok: false, reason: "今日 AI 搜索次数已达上限（每天 50 次），请明天再试" };
  stamps.push(now);
  usage.set(userId, stamps);
  if (usage.size > 2000) usage.delete(usage.keys().next().value as string);
  return { ok: true };
}

const SYSTEM_PROMPT = `你是「植景小匠」植物图鉴的筛选条件解析器。把学生的自然语言诉求解析为结构化筛选条件 JSON。
只输出一个 JSON 对象（不要 markdown 围栏、不要解释），可用字段与取值白名单：
- category: ${CATEGORIES.join("/")}
- layer: ${LAYERS.join("/")}（tree=乔木 shrub=灌木 herb=草本 vine=藤本 bamboo=竹类）
- light: ${LIGHT_NEED.join("/")}（semi=耐阴/半阴 sun=喜光 sun_to_semi=喜光也耐半阴）
- water: ${WATER_NEED.join("/")}（dry=耐旱 medium=中性 moist=喜湿润 wet=耐湿/水边/积水）
- soilPh: ${SOIL_PH.join("/")}
- soilDrainage: ${SOIL_DRAINAGE.join("/")}（well=怕积水/需排水好）
- tagGroups: 数组，取值 ${TAG_GROUPS.join("/")}
- functionTags: 数组，取值 ${FUNCTION_TAGS.join("/")}
- regionTags: 数组，取值 ${REGION_TAGS.join("/")}
- isWarning: true 或 false（"无刺无毒/安全"→false；"哪些有毒/警示"→true）
- keyword: 字符串，植物名称/学名/别名，或其他无法映射到字段的名称/用途类自由关键词（用户输入植物名、学名或别名时原样放入 keyword；如"开白花"无法映射到枚举时不要猜，留空）
规则：
1. 只依据用户输入；无法确定的字段一律不写，宁缺毋猜。
2. 用户提到具体场地分区名称（如 A-E 区、一米菜园、儿童活动区、沙坑等预设指称）时，必须转译为条件化表述再映射（如"低洼易积水地段"→water:wet，"半阴地段"→light:semi），输出中不得出现任何分区指称。
3. 取值必须严格来自白名单，否则该字段不写。
4. category/layer/light/water/soilPh/soilDrainage 是单值字符串字段，keyword 是字符串，isWarning 是布尔值——一律不要包成数组；只有 tagGroups/functionTags/regionTags 是数组。
5. 每个语义只映射到最合适的单个字段，不要跨字段重复：能用 light/water 表达的（如"耐阴"→light:semi、"耐湿"→water:wet），不要再往 tagGroups/functionTags 里重复添加同义项。
6. 用户输入具体植物名称、学名或别名（如"桂花""Osmanthus fragrans""木樨"）时，原样放入 keyword 做名称检索；若同时描述了习性，名称进 keyword、习性映射到对应字段。`;

export async function POST(req: Request) {
  let user;
  try {
    user = (await requireUserToken()).user;
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED", message: "AI 辅助搜索登录后可用" }, { status: 401 });
  }

  let body: { query?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const query = (body.query ?? "").trim();
  if (!query) return NextResponse.json({ error: "EMPTY_QUERY", message: "请输入想筛选的植物类型" }, { status: 400 });
  if (query.length > 200) return NextResponse.json({ error: "TOO_LONG", message: "描述太长了，请精简到 200 字以内" }, { status: 400 });

  const limit = checkRateLimit(user.id);
  if (!limit.ok) return NextResponse.json({ error: "RATE_LIMITED", message: limit.reason }, { status: 429 });

  let rawText = "";
  try {
    const client = new LLMClient();
    const events = client.stream(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: query },
      ],
      { model: "doubao-seed-2-0-lite-260215" },
    );
    for await (const event of events) {
      const delta = typeof event?.content === "string" ? event.content : event?.content?.toString() ?? "";
      if (delta) rawText += delta;
    }
  } catch {
    return NextResponse.json({ error: "LLM_FAILED", message: "AI 服务暂不可用，请稍后再试或手动使用左侧筛选" }, { status: 502 });
  }

  const parsed = extractLlmJson(rawText);
  const { conditions, unrecognized } = validateAiConditions(parsed);
  const hasAny = Object.keys(conditions).length > 0;

  const dataset = await loadPlantsForServer();
  const lites = dataset.plants.map(toPlantLite);
  const matched = hasAny ? lites.filter(p => matchesConditions(p, conditions)) : [];

  return NextResponse.json({
    conditions,
    description: describeConditions(conditions),
    unrecognized,
    count: matched.length,
    ids: matched.map(p => p.id),
  });
}
