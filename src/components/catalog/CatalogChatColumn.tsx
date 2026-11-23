"use client";

// 图鉴内嵌问答窄栏「外壳」：随首屏渲染（体积极小），对话引擎延迟到首次交互才加载。
// 激活来源：点植物卡片「AI 讲解」（父级传入 activePlant）、聚焦输入框（通用问答）、
// 或刷新后从 localStorage 恢复上一次植物会话（刷新不丢）。
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Sparkles } from "lucide-react";
import type { PlantName } from "@/components/chat/use-chat";

// 与 CatalogChatEngine 持久化键保持一致（勿静态引用引擎模块，避免引擎进首屏）
const CATALOG_CHAT_KEY = "zjxj:catalog-chat";

const CatalogChatEngine = dynamic(
  () => import("./CatalogChatEngine").then((m) => m.CatalogChatEngine),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[var(--size-chat-pane)] flex-col items-center justify-center gap-2 rounded-xl bg-surface shadow-card">
        <span className="h-5 w-5 animate-spin rounded-full border-neo border-primary/30 border-t-primary" />
        <p className="text-fs-label text-on-surface-variant">正在唤起 AI 助教…</p>
      </div>
    ),
  }
);

type Restored = { plant: PlantName; convId: string };

export function CatalogChatColumn({
  activePlant,
  plantsLite,
  signedIn,
  flush = false,
}: {
  activePlant: PlantName | null;
  plantsLite: PlantName[];
  signedIn: boolean;
  flush?: boolean;
}) {
  const [engaged, setEngaged] = useState(false);
  const [restored, setRestored] = useState<Restored | null>(null);

  // 刷新恢复：读取上一次植物会话（仅登录用户有持久化会话）
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CATALOG_CHAT_KEY);
      if (!raw) return;
      const v = JSON.parse(raw) as { plantId?: string; plantName?: string; convId?: string };
      if (v?.plantId && v?.plantName && v?.convId) {
        setRestored({ plant: { id: v.plantId, name: v.plantName, latin: "" }, convId: v.convId });
        setEngaged(true);
      }
    } catch {
      /* 恢复失败保持空态 */
    }
  }, []);

  // 卡片点「AI 讲解」→ 激活
  useEffect(() => {
    if (activePlant) setEngaged(true);
  }, [activePlant]);

  // 生效植物：优先卡片点击，其次刷新恢复
  const effPlant = activePlant ?? restored?.plant ?? null;
  // 仅当恢复的植物与当前生效植物一致时延续旧会话，否则新开会话
  const initialConvId =
    restored && effPlant && restored.plant.id === effPlant.id ? restored.convId : undefined;

  if (!engaged) {
    return (
      <div className={`flex flex-col overflow-hidden ${flush ? "" : "rounded-xl bg-surface shadow-card"}`}>
        <div className="flex items-center gap-2.5 border-b-neo border-outline-variant/20 px-4 py-3.5">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <h2 className="text-fs-card font-medium text-on-surface">AI 助教</h2>
        </div>
        <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
          <Sparkles className="h-8 w-8 text-foreground/25" />
          <p className="text-fs-sub leading-relaxed text-on-surface-variant">
            点击植物卡片的「AI 讲解」开始提问，
            <br />
            或直接输入你想了解的植物问题
          </p>
        </div>
        <div className="border-t-neo border-outline-variant/20 px-4 py-3">
          <input
            readOnly
            placeholder="问问这株植物…"
            onFocus={() => setEngaged(true)}
            onClick={() => setEngaged(true)}
            className="w-full cursor-pointer rounded-xl bg-surface-container px-4 py-3 text-fs-sub text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-ink"
          />
        </div>
      </div>
    );
  }

  return (
    <CatalogChatEngine
      key={effPlant?.id ?? "general"}
      plantsLite={plantsLite}
      signedIn={signedIn}
      contextPlantId={effPlant?.id}
      contextPlantName={effPlant?.name}
      initialConvId={initialConvId}
      flush={flush}
    />
  );
}
