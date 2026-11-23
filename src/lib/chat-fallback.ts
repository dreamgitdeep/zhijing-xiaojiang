import type { Plant, PlantsDataset } from "@/lib/types";
import { layerLabel } from "@/lib/types";

function restrictionLabel(p: Plant) {
  if (!p.isWarning || !p.warning) return null;
  return p.warning.restriction === "forbid" ? "禁止种植（植红）" : "慎用（橙警）";
}

function plantBrief(p: Plant) {
  const lines: string[] = [];
  lines.push(`【${p.name}】${p.latin}`);
  lines.push(`分类：${p.category} · ${layerLabel(p.layer)}`);
  lines.push(`习性：光照 ${p.light}，水分 ${p.water}，土壤 ${p.soil}；株高约 ${p.height}，冠幅约 ${p.canopy}。`);
  if (p.phenology) {
    const months = p.phenology.flowerMonths?.length ? p.phenology.flowerMonths.join("、") : "—";
    lines.push(`观赏：以${p.ornamentalPart}为主，主色调 ${p.color}，花期 ${months}。`);
  }
  if (p.usage?.length) lines.push(`造景应用：常用于${p.usage.join("、")}。`);
  const restrict = restrictionLabel(p);
  if (restrict) {
    lines.push(`安全提示：${restrict}——${p.warning?.riskType ?? ""}风险部位为${p.warning?.riskPart ?? "全株"}，接触或误食可${p.warning?.symptom ?? "引起不适"}。教学中${p.warning?.teachUse ?? "仅作认知讲解，不安排实地种植作业"}。`);
  } else {
    lines.push("安全提示：未见明确毒性记录，校园种植相对安全。");
  }
  return lines.join("\n");
}

function findPlant(dataset: PlantsDataset, plantId?: string, message?: string): Plant | undefined {
  if (plantId) return dataset.plants.find((p) => p.id === plantId);
  if (!message) return undefined;
  const q = message.trim();
  const hit = dataset.plants.find(
    (p) => p.name === q || p.alias?.includes(q) || q.includes(p.name) || p.alias?.some((a) => a.length >= 2 && q.includes(a))
  );
  return hit;
}

export function fallbackAnswer(dataset: PlantsDataset, plantId: string | undefined, userMessage: string): string {
  const plant = findPlant(dataset, plantId, userMessage);
  if (plant) {
    return `${plantBrief(plant)}\n\n—— 本答案依据课程植物库资料生成。`;
  }

  const keywords = ["耐阴", "耐旱", "芳香", "观花", "观叶", "地被", "藤本", "乔木", "灌木", "草本"];
  const kw = keywords.find((k) => userMessage.includes(k));
  if (kw) {
    const pool = dataset.plants.filter((p) => {
      if (kw === "地被") return layerLabel(p.layer) === "地被" || p.usage?.some((u) => u.includes("地被"));
      if (kw === "藤本") return p.layer === "vine";
      if (kw === "乔木") return p.layer === "tree";
      if (kw === "灌木") return p.layer === "shrub";
      if (kw === "草本") return p.layer === "herb";
      if (kw === "耐阴") return p.light?.text?.includes("耐阴") || p.light?.text?.includes("半阴") || p.light?.shadeTolerant;
      if (kw === "耐旱") return p.water?.text?.includes("耐旱") || p.water?.need?.includes("干旱");
      if (kw === "芳香") return p.ornamentalPart?.includes("香") || p.alias?.some((a) => a.includes("香"));
      if (kw === "观花") return p.phenology?.flowerMonths?.length;
      if (kw === "观叶") return p.ornamentalPart?.includes("叶");
      return false;
    });
    const picks = pool.slice(0, 6);
    if (picks.length) {
      return `围绕「${kw}」，从课程植物库中为你整理了 ${picks.length} 种参考植物：\n\n${picks
        .map((p) => `· ${p.name}（${p.latin}）—— ${p.category} · ${layerLabel(p.layer)}${p.isWarning ? " · 注意安全警示" : ""}`)
        .join("\n")}\n\n如需某种植物的详细讲解，直接回复它的名称即可。\n\n—— 本答案依据课程植物库资料生成。`;
    }
  }

  return "我是《植物造景》课程助教。目前 AI 讲解通道不可用，我仍可以依据课程植物库（135 种植物）回答问题：\n\n· 直接回复植物名称，如「香樟」「夹竹桃」，我会给出习性与造景应用讲解；\n· 也可以按需求提问，如「推荐几种耐阴地被」「蔷薇科有哪些造景植物」。\n\n—— 本答案依据课程植物库资料生成。";
}
