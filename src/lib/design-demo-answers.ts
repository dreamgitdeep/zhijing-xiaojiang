/**
 * 植景设计「演示答案」注册表 —— 供演示人员一键填充并快速展示各阶段的标准作答。
 * 仅指定演示账号（学号 DEMO_STUDENT_NO）可见可用，其他学生与教师均不展示，
 * 防止标准作答泄漏；应用入口 /api/design/stage/apply-demo 同样按学号校验。
 *
 * 内容依据 task-chuangzhi-01 的 referenceSolution / nongyuan.site 编写：
 * 五分区 A 一米菜园 / B 诗经花园 / C 朴门花园 / D 公共活动区 / E 雨水收集堆肥区。
 *
 * S3/S5 几何说明：底图 site-plan-blank.webp（1024×2048）中场地为南北向狭长四边形，
 * 轮廓约 (447,10)-(522,26)-(522,1878)-(218,1898)（图像像素）。画布坐标系按
 * canvasGeom([0,0,1024,2048]) 推导：S=2310，底图偏移 (imgX,imgY)=(643,131)，
 * 故下方坐标 = 图像像素 + (643,131)。分区自上而下按面积比例切分（北→南）。
 */

/** 唯一可见/可用演示答案的演示账号学号（秋千，教师指定） */
export const DEMO_STUDENT_NO = "20232001027";

export interface DemoStageAnswer {
  payload: any;
  meta: Record<string, any>;
  /** 应用后写入 stage_reviews 的评阅（演示口径） */
  review: {
    feedback: string;
    cards: any[];
    issues: string[];
    keyPoints: string[];
    strengths?: string[];
    suggestions?: string[];
    selfEvalCheck?: string;
  };
}

const ZONE_COLORS = ["#2F7A4F", "#C0563B", "#3B6FC0", "#B58A2E", "#7A4FC0"];

/** 五分区几何（画布坐标，自上而下） */
const ZONE_POINTS: Record<string, [number, number][]> = {
  A: [
    [1095, 163],
    [1157, 163],
    [1157, 594],
    [1043, 594],
  ],
  B: [
    [1043, 594],
    [1157, 594],
    [1157, 1027],
    [991, 1027],
  ],
  C: [
    [991, 1027],
    [1157, 1027],
    [1157, 1418],
    [943, 1418],
  ],
  D: [
    [943, 1418],
    [1157, 1418],
    [1157, 1713],
    [907, 1713],
  ],
  E: [
    [907, 1713],
    [1157, 1713],
    [1157, 2007],
    [870, 2019],
  ],
};

const ZONE_NAMES: Record<string, string> = {
  A: "一米菜园区",
  B: "诗经花园区",
  C: "朴门花园区",
  D: "公共活动区",
  E: "雨水收集堆肥区",
};

/** 各分区场地条件（S4 标注口径，与 nongyuan.site.zones.conditions 对应） */
const ZONE_CONDITIONS: Record<string, { light: string; water: string; usage: string }> = {
  A: { light: "sun", water: "moist", usage: "production" },
  B: { light: "semi", water: "moist", usage: "ornamental" },
  C: { light: "sun", water: "moist", usage: "eco" },
  D: { light: "sun", water: "moist", usage: "children" },
  E: { light: "sun", water: "waterlog", usage: "eco" },
};

/** 各分区植物清单（referenceSolution 植物 → plants.json id） */
const ZONE_PLANT_IDS: Record<string, string[]> = {
  A: ["p086", "p090", "p089", "p133", "p134", "p088"], // 番茄/黄瓜/辣椒/胡萝卜/玉米/草莓
  B: ["p127", "p129", "p003", "p118", "p110", "p130"], // 桃树/木瓜海棠/木槿/枸杞/萱草/蜀葵
  C: ["p082", "p084", "p051", "p080", "p048", "p087"], // 薄荷/迷迭香/鼠尾草/百里香/金鸡菊/紫苏
  D: ["p005", "p001", "p126", "p083", "p049", "p044"], // 桂花/含笑/乌桕(原有保留)/薰衣草/麦冬/矾根
  E: ["p070", "p069", "p071", "p072", "p114"], // 千屈菜/再力花/水生美人蕉/睡莲/鸢尾
};

/** S5 建设计划（源自 nongyuan.site.zones.designIntent） */
const ZONE_PLANS: Record<string, string> = {
  A: "抬高种植箱阵列种植蔬菜，规避建筑垃圾土；采收后以背景植物补景，箱间留步道供认养管理与科普。",
  B: "桃树、木瓜海棠等小乔木为上层的《诗经》植物群落，灌木与宿根花卉衬中下层，兼顾文化标识与四季观赏。",
  C: "螺旋花园与锁孔花园布局，香草蜜源植物相生混种，预留自播野花空间，吸引传粉昆虫做生态示范。",
  D: "桂花、含笑等小乔木形成遮荫骨架，下层芳香地被结合休憩座椅；儿童沙坑 5m 内零有毒有刺植物。",
  E: "雨水收集洼地周边配置耐湿草本，堆肥箱与蚯蚓塔设于边缘，鸢尾等根茎有毒种类远离儿童动线。",
};

/** S5 植物落位（画布坐标，均位于对应分区多边形内部） */
const ZONE_PLACEMENTS: Record<string, { plantId: string; x: number; y: number }[]> = {
  A: [
    { plantId: "p086", x: 1102, y: 191 },
    { plantId: "p090", x: 1138, y: 256 },
    { plantId: "p089", x: 1086, y: 321 },
    { plantId: "p133", x: 1138, y: 386 },
    { plantId: "p134", x: 1070, y: 451 },
    { plantId: "p088", x: 1138, y: 521 },
  ],
  B: [
    { plantId: "p127", x: 1048, y: 631 },
    { plantId: "p129", x: 1141, y: 691 },
    { plantId: "p003", x: 1033, y: 756 },
    { plantId: "p118", x: 1141, y: 821 },
    { plantId: "p110", x: 1017, y: 886 },
    { plantId: "p130", x: 1141, y: 951 },
    { plantId: "p110", x: 1043, y: 991 },
  ],
  C: [
    { plantId: "p082", x: 996, y: 1061 },
    { plantId: "p084", x: 1141, y: 1121 },
    { plantId: "p051", x: 982, y: 1181 },
    { plantId: "p080", x: 1141, y: 1241 },
    { plantId: "p048", x: 967, y: 1301 },
    { plantId: "p087", x: 1141, y: 1361 },
  ],
  D: [
    { plantId: "p005", x: 950, y: 1446 },
    { plantId: "p001", x: 1141, y: 1501 },
    { plantId: "p126", x: 936, y: 1556 },
    { plantId: "p083", x: 1141, y: 1601 },
    { plantId: "p049", x: 925, y: 1646 },
    { plantId: "p044", x: 1141, y: 1686 },
  ],
  E: [
    { plantId: "p070", x: 913, y: 1746 },
    { plantId: "p069", x: 1141, y: 1801 },
    { plantId: "p071", x: 900, y: 1856 },
    { plantId: "p072", x: 1141, y: 1911 },
    { plantId: "p114", x: 886, y: 1966 },
  ],
};

const ZONE_IDS = ["A", "B", "C", "D", "E"];

function s3Zones() {
  return ZONE_IDS.map((id, i) => ({
    id,
    name: ZONE_NAMES[id],
    color: ZONE_COLORS[i],
    points: ZONE_POINTS[id],
  }));
}

function s4Zones() {
  return ZONE_IDS.map((id, i) => ({
    zoneId: id,
    name: ZONE_NAMES[id],
    color: ZONE_COLORS[i],
    conditions: { ...ZONE_CONDITIONS[id] },
    plantIds: [...ZONE_PLANT_IDS[id]],
  }));
}

function s5Zones() {
  return ZONE_IDS.map((id, i) => ({
    zoneId: id,
    name: ZONE_NAMES[id],
    color: ZONE_COLORS[i],
    points: ZONE_POINTS[id],
    conditions: { ...ZONE_CONDITIONS[id] },
    plan: ZONE_PLANS[id],
    placements: ZONE_PLACEMENTS[id].map((p, j) => ({ id: `demo-${id}-${j + 1}`, plantId: p.plantId, x: p.x, y: p.y })),
  }));
}

const DEMO_ANSWERS: Record<string, Record<string, DemoStageAnswer>> = {
  "task-chuangzhi-01": {
    S1: {
      payload: {
        light:
          "场地整体光照充足：开阔段全日照，日有效光照 6-8 小时；北侧紧邻建筑一侧受建筑遮挡形成半阴带，约 3-5 小时，宜布置耐阴植物。",
        soil:
          "土壤为建筑垃圾混杂土，土层薄、压实严重、肥力差，须做 30cm 以上厚土堆肥改良，种植箱抬高规避劣质土。",
        drainage:
          "整体排水差，低洼段雨后积水 1-2 天，须选耐湿植物或结合雨水收集设施化解，不宜种植怕涝种类。",
        pipeline:
          "地下埋有电缆与给水管线，走向未完全探明，乔木种植须避开管线或先探挖确认，浅根草本影响较小。",
        terrain:
          "整体平坦，东西向略有高差，东段低洼易积水，无需大动土方，设计顺应现有地形组织排水即可。",
        users:
          "三类主要人群：周边居民（认养种植、共建共管）、附近白领（休憩与芳香体验）、儿童（自然游乐与科普），须兼顾安全与参与性。",
        climate:
          "夏季高温伏旱与梅雨集中交替，冬季湿冷，植物选择需耐热、耐短期水湿并有一定耐寒性。",
        maintenance:
          "养护依赖志愿者、物业人手极少、预算低，只能走低维护路线；禁止有毒、强刺与入侵物种。",
      },
      meta: {
        hitEntryIds: ["Q01", "Q04", "Q05", "Q07", "Q10", "Q12", "Q17", "Q19", "Q20"],
        askedCount: 12,
      },
      review: {
        feedback:
          "演示答案：八字段诊断完整覆盖光照、土壤、排水、管线、地形、人群、气候与养护限制，关键信息（建筑遮挡半阴、建筑垃圾土、东段低洼积水、管线探挖、志愿者低维护）均已到位。",
        cards: [],
        issues: [],
        keyPoints: ["诊断结论将直接支撑 S2 定位：贫瘠土 + 低维护 + 认养需求 → 可食花园主定位"],
      },
    },
    S2: {
      payload: {
        primary: "edible",
        secondary: ["science", "eco"],
        principles: ["p1", "p2", "p3", "p4"],
        reasons: {
          r1: "场地为建筑垃圾土且预算低，本土优先、低维护才能匹配志愿者养护条件。",
          r2: "可食作物与蜜源、观赏植物混配，兼顾产出、生态与景观三重效益。",
          r3: "儿童参与活动多，安全优先：无剧毒无强刺，沙坑周边 5m 规避致敏植物。",
          r4: "场地排水差、东段低洼，雨水友好、海绵式种植可把劣势转为雨水涵养亮点。",
        },
      },
      meta: {},
      review: {
        feedback:
          "演示答案：主定位「可食花园」与场地贫瘠土、志愿者低维护、居民认养需求高度匹配，科普与生态为次定位；四条设计原则全部正确且理由落到场地条件。",
        cards: [],
        issues: [],
        keyPoints: ["不取纯观赏花境取向：低预算与零养护条件下无法维持"],
      },
    },
    S3: {
      payload: { zones: s3Zones() },
      meta: { site: { x: 643, y: 131, w: 1024, h: 2048 }, siteArea: 1024 * 2048 },
      review: {
        feedback:
          "演示答案：五个功能分区顺狭长场地自北向南落位——一米菜园、诗经花园、朴门花园、公共活动区、雨水收集堆肥区，覆盖率与命名完整。",
        cards: [],
        issues: [],
        keyPoints: ["低洼积水段留给雨水收集堆肥区，公共活动区靠近人流并守住儿童安全红线"],
      },
    },
    S4: {
      payload: { zones: s4Zones() },
      meta: { totalPlants: ZONE_IDS.reduce((s, id) => s + ZONE_PLANT_IDS[id].length, 0) },
      review: {
        feedback:
          "演示答案：各分区条件标注与植物清单匹配——菜园全日照生产、诗经花园半阴观赏、朴门花园生态混种、活动区儿童安全、雨水区耐湿植物，合规无冲突项。",
        cards: [],
        issues: [],
        keyPoints: ["鸢尾根茎有毒，须远离儿童动线；乌桕为场地原有乔木，保留利用"],
      },
    },
    S5: {
      payload: { zones: s5Zones() },
      meta: {
        totalPlants: ZONE_IDS.reduce((s, id) => s + ZONE_PLACEMENTS[id].length, 0),
        plansWritten: 5,
      },
      review: {
        feedback:
          "演示答案：植物按分区条件落位成图，乔灌草层次清晰，五个分区均附建设计划（种植箱阵列、诗经群落、螺旋花园、遮荫骨架、雨水洼地）。",
        cards: [],
        issues: [],
        keyPoints: ["同一植物恒定同一符号代号，图例与种植设计图一一对应"],
      },
    },
    S6: {
      payload: {
        selfEval: [
          {
            key: "eco",
            label: "生态性",
            score: 18,
            basis:
              "五大分区以本土与蜜源植物为主，朴门花园区混种薄荷、鼠尾草等香草并预留自播野花空间，雨水收集堆肥区以千屈菜、再力花涵养雨水，支持传粉昆虫。",
          },
          {
            key: "safety",
            label: "安全性",
            score: 19,
            basis:
              "公共活动区儿童沙坑 5m 内选用桂花、含笑、麦冬等无毒无刺植物，雨水收集堆肥区的鸢尾远离儿童动线，全园规避剧毒与强刺种类。",
          },
          {
            key: "landscape",
            label: "景观性",
            score: 17,
            basis:
              "诗经花园区桃树、木瓜海棠、木槿提供春花，公共活动区桂花提供秋香，一米菜园区采收后以背景植物补景，四季层次分明。",
          },
          {
            key: "ops",
            label: "运维性",
            score: 18,
            basis:
              "整体遵循低维护原则，香草类可自播繁衍，堆肥箱与蚯蚓塔实现园内物质循环，契合志愿者养护能力与低预算条件。",
          },
          {
            key: "fit",
            label: "适用性",
            score: 18,
            basis:
              "可食花园主定位呼应居民认养需求，诗经花园区承担科普展示满足学生研学，公共活动区服务白领休憩，与场地人群需求逐一对应。",
          },
        ],
      },
      meta: {},
      review: {
        feedback:
          "演示答案：五维自评依据均落到具体分区与植物，自评与方案一致；方案以可食花园为主线，功能、生态与安全兼顾，整体完成度高。",
        cards: [],
        issues: [],
        keyPoints: ["最终成绩取 S6 最佳分，演示按满分口径写入"],
        strengths: [
          "定位—分区—植物—布局链路完整自洽",
          "儿童安全红线与低维护约束贯穿始终",
          "雨水劣势转为生态亮点",
        ],
        suggestions: ["后续可补充四季季相的量化对照表", "可加入居民共建的阶段性养护计划"],
        selfEvalCheck: "自评依据与方案内容一致，未见夸大：各维度均能对应到具体分区与植物配置。",
      },
    },
  },
};

export function getDemoAnswer(taskId: string, stageKey: string): DemoStageAnswer | null {
  return DEMO_ANSWERS[taskId]?.[stageKey] ?? null;
}

export function hasDemoAnswers(taskId: string): boolean {
  return Boolean(DEMO_ANSWERS[taskId]);
}
