"use client";

// 图鉴内嵌问答引擎（懒加载）：复用第 4 轮 useChat + ChatPanel，
// 以 mode="embedded" 运行（source="catalog"），全站对话逻辑仅此一份。
// 教师点名：图鉴 AI 助教只保留对话框，不带相关推荐/造景效果图/相关链接（RecommendPanel 仅 /chat 用）。
import { useEffect } from "react";
import Link from "next/link";
import { Maximize2 } from "lucide-react";
import { useChat, type PlantName } from "@/components/chat/use-chat";
import { ChatPanel } from "@/components/chat/ChatPanel";

export const CATALOG_CHAT_KEY = "zjxj:catalog-chat";

export function CatalogChatEngine({
  plantsLite,
  signedIn,
  contextPlantId,
  contextPlantName,
  initialConvId,
  flush = false,
}: {
  plantsLite: PlantName[];
  signedIn: boolean;
  contextPlantId?: string;
  contextPlantName?: string;
  initialConvId?: string;
  flush?: boolean;
}) {
  const chat = useChat({
    plantsLite,
    plant: null,
    signedIn,
    mode: "embedded",
    contextPlantId,
    contextPlantName,
    initialConvId,
  });

  // 持久化当前植物会话，供刷新后恢复（刷新不丢）
  useEffect(() => {
    if (chat.activeId && contextPlantId) {
      try {
        localStorage.setItem(
          CATALOG_CHAT_KEY,
          JSON.stringify({ plantId: contextPlantId, plantName: contextPlantName ?? "", convId: chat.activeId })
        );
      } catch {
        /* localStorage 不可用时放弃恢复能力 */
      }
    }
  }, [chat.activeId, contextPlantId, contextPlantName]);

  const expandHref = chat.activeId
    ? `/chat?conv=${chat.activeId}`
    : contextPlantId
      ? `/chat?plantId=${contextPlantId}`
      : "/chat";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChatPanel
        chat={chat}
        mode="embedded"
        flush={flush}
        headerSlot={
          <Link
            href={expandHref}
            title="在完整问答页继续本会话"
            className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2.5 py-1 text-fs-label text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-foreground"
          >
            <Maximize2 className="h-3 w-3" />
            展开为完整页
          </Link>
        }
      />
    </div>
  );
}

