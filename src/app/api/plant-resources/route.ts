import { NextResponse } from "next/server";
import { SearchClient, Config } from "coze-coding-dev-sdk";
import { loadDataset } from "@/lib/data";
import { requireUserToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface ResourcePack {
  images: { url: string; alt: string }[];
  links: { title: string; url: string; snippet: string }[];
}

const cache = new Map<string, { at: number; pack: ResourcePack }>();
const TTL = 10 * 60 * 1000;

export async function GET(req: Request) {
  try {
    await requireUserToken();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const plantId = new URL(req.url).searchParams.get("plantId");
  if (!plantId) return NextResponse.json({ error: "plantId required" }, { status: 400 });

  const hit = cache.get(plantId);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.pack);

  const dataset = await loadDataset();
  const plant = dataset.plants.find((p) => p.id === plantId);
  if (!plant) return NextResponse.json({ error: "plant not found" }, { status: 404 });

  const client = new SearchClient(new Config());
  const pack: ResourcePack = { images: [], links: [] };

  // 相关推荐图片只取本地图鉴图（网络图常加载失败），full/close/thumb 去重
  pack.images = [plant.images.full, plant.images.close, plant.images.thumb]
    .filter((u, i, arr) => Boolean(u) && arr.indexOf(u) === i)
    .map((url) => ({ url, alt: plant.name }));

  const webRes = await client.webSearch(`${plant.name} 观赏特性 造景应用 养护`, 3).catch(() => null);
  if (webRes) {
    pack.links = (webRes.web_items ?? [])
      .flatMap((i) => (i.url ? [{ title: i.title, url: i.url, snippet: i.snippet ?? "" }] : []))
      .slice(0, 3);
  }

  cache.set(plantId, { at: Date.now(), pack });
  return NextResponse.json(pack);
}
