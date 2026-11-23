"use client";

import { useEffect, useRef, useState } from "react";
import { matchPlantByName } from "@/lib/plant-match";

export type ChatMode = "page" | "embedded";

export type Msg = { role: "user" | "assistant"; content: string };
export type PlantLite = {
  id: string;
  name: string;
  latin: string;
  thumb: string;
  isWarning: boolean;
  category: string;
  tags: string[];
} | null;
export type PlantName = { id: string; name: string; latin: string };
export type Resources = {
  plantId: string;
  plantName: string;
  images: { url: string; alt: string }[];
  links: { title: string; url: string; snippet: string }[];
};
export type Conversation = { id: string; title: string; lastAt: string; legacy?: boolean; source?: "chat" | "catalog" };

/** 消息级附件（随 assistant 消息落库，打开历史对话时还原） */
export type RenderEntry = { url?: string; plantId: string; at: string; status: "ok" | "failed" };
export type MsgMeta = { resources?: Resources; renders?: RenderEntry[] };

export const QUICK_WITH_PLANT = ["它的识别要点是什么？", "园林中如何安全应用？", "有哪些安全的替代植物？", "修剪时要特别注意什么？"];
export const QUICK_GENERAL = ["推荐几种耐阴地被植物", "蔷薇科有哪些造景植物？", "夹竹桃为什么不能进校园绿地？", "什么是植物层次搭配？"];

export const stripMd = (s: string) =>
  s
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*`_|~-]/g, "")
    .replace(/\n{2,}/g, "\n");

export function fmtConvTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return sameDay ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

export interface UseChatOptions {
  plantsLite: PlantName[];
  /** 页面模式由 /chat?plantId= 注入的完整上下文植物 */
  plant: PlantLite;
  signedIn: boolean;
  mode?: ChatMode;
  /** 预留：第 10 轮图鉴内嵌时按 id/名注入上下文（plant 为空时生效） */
  contextPlantId?: string;
  contextPlantName?: string;
  /** 页面模式：打开指定会话（图鉴「展开为完整页」带 ?conv= 延续同一会话） */
  initialConvId?: string;
}

export function useChat({ plantsLite, plant, signedIn, mode = "page", contextPlantId, contextPlantName, initialConvId }: UseChatOptions) {
  // 会话来源标识：页面模式=普通对话；内嵌（第 10 轮图鉴）=图鉴速查。随消息落库，历史列表据此分组
  const source: "chat" | "catalog" = mode === "embedded" ? "catalog" : "chat";
  const initialContext: PlantLite =
    plant ??
    (contextPlantId && contextPlantName
      ? { id: contextPlantId, name: contextPlantName, latin: "", thumb: "", isWarning: false, category: "", tags: [] }
      : null);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [contextPlant, setContextPlant] = useState(initialContext);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [resources, setResources] = useState<Resources | null>(null);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [listening, setListening] = useState(false);
  const [mindIdx, setMindIdx] = useState<number | null>(null);
  const [renderImgs, setRenderImgs] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [renderNotice, setRenderNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const startedRef = useRef(false);
  const recRef = useRef<{ stop: () => void } | null>(null);

  const [micSupported, setMicSupported] = useState(false);
  useEffect(() => {
    setMicSupported(
      Boolean(
        (window as unknown as Record<string, unknown>).SpeechRecognition ||
          (window as unknown as Record<string, unknown>).webkitSpeechRecognition
      )
    );
  }, []);

  function speak(text: string, idx: number) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (speakingIdx === idx) {
      window.speechSynthesis.cancel();
      setSpeakingIdx(null);
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(stripMd(text));
    u.lang = "zh-CN";
    u.onend = () => setSpeakingIdx(null);
    u.onerror = () => setSpeakingIdx(null);
    setSpeakingIdx(idx);
    window.speechSynthesis.speak(u);
  }

  function toggleMic() {
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const w = window as unknown as Record<string, any>;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "zh-CN";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      const t = Array.from(e.results as any[])
        .map((r) => r[0].transcript)
        .join("");
      setInput(t);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  /** 把附件定点并入该对话最近一条 assistant 消息的 meta（失败不影响主流程） */
  async function persistMeta(conversationId: string, patch: { resources?: Resources; render?: RenderEntry }) {
    try {
      await fetch("/api/chat-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, ...patch }),
      });
    } catch {
      /* 附件持久化失败不阻断对话 */
    }
  }

  async function loadResources(plantId: string, plantName: string, convId: string | null) {
    try {
      const res = await fetch(`/api/plant-resources?plantId=${encodeURIComponent(plantId)}`);
      if (!res.ok) return;
      const data = await res.json();
      const pack: Resources = { plantId, plantName, images: data.images ?? [], links: data.links ?? [] };
      setResources(pack);
      // 有内容才落库；随最近 assistant 消息持久化，重开对话可还原
      if (convId && signedIn && (pack.images.length > 0 || pack.links.length > 0)) {
        void persistMeta(convId, { resources: pack });
      }
    } catch {
      /* resources are optional */
    }
  }

  async function generateRender(plantId: string) {
    if (renderImgs[plantId] || generating) return;
    setGenerating(true);
    setRenderNotice(null);
    const at = new Date().toISOString();
    try {
      const res = await fetch("/api/plant-render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        setRenderImgs((s) => ({ ...s, [plantId]: data.url }));
        if (activeId && signedIn) void persistMeta(activeId, { render: { url: data.url, plantId, at, status: "ok" } });
      } else {
        const msg =
          res.status === 429 || res.status === 401
            ? (data.message ?? (res.status === 401 ? "请先登录后再生成造景效果图" : "生成太频繁，请稍后再试"))
            : "效果图生成失败，可再次尝试";
        setRenderNotice(msg);
        if (activeId && signedIn) void persistMeta(activeId, { render: { plantId, at, status: "failed" } });
      }
    } catch {
      setRenderNotice("效果图生成失败，可再次尝试");
      if (activeId && signedIn) void persistMeta(activeId, { render: { plantId, at, status: "failed" } });
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function stream(prompt: string, activePlant: PlantLite, convId: string | null) {
    const content = prompt.trim();
    if (!content || streaming) return;
    const next: Msg[] = [...messages, { role: "user", content }, { role: "assistant", content: "" }];
    setMessages(next);
    setInput("");
    setStreaming(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(0, -1), plantId: activePlant?.id, conversationId: convId, source }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error("chat request failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const evt of events) {
          const line = evt.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const { delta } = JSON.parse(payload) as { delta: string };
            if (delta) {
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                copy[copy.length - 1] = { ...last, content: last.content + delta };
                return copy;
              });
            }
          } catch {
            // 忽略无法解析的事件
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant" && !last.content) {
            copy[copy.length - 1] = { ...last, content: "（已停止生成）" };
          }
          return copy;
        });
      } else {
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: "网络异常，请稍后重试。" };
          return copy;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      if (convId) {
        setConversations((prev) => {
          const title = prompt.trim().slice(0, 40);
          const now = new Date().toISOString();
          const rest = prev.filter((c) => c.id !== convId);
          const existing = prev.find((c) => c.id === convId);
          return [{ id: convId, title: existing && existing.title !== "新对话" ? existing.title : title, lastAt: now }, ...rest];
        });
      }
      const matched = matchPlantByName(prompt, plantsLite) ?? activePlant;
      if (matched) loadResources(matched.id, matched.name, convId);
    }
  }

  async function loadConversations(): Promise<Conversation[]> {
    try {
      const res = await fetch("/api/chat-history");
      if (!res.ok) return [];
      const data = await res.json();
      const list: Conversation[] = Array.isArray(data.conversations) ? data.conversations : [];
      setConversations(list);
      return list;
    } catch {
      return [];
    }
  }

  async function openConversation(id: string) {
    if (streaming) abortRef.current?.abort();
    setActiveId(id);
    setMessages([]);
    setResources(null);
    setMindIdx(null);
    try {
      const res = await fetch(`/api/chat-history?conversationId=${encodeURIComponent(id)}`);
      if (!res.ok) return;
      const data = await res.json();
      const list: { role: string; content: string; meta?: MsgMeta | null }[] = Array.isArray(data.messages) ? data.messages : [];
      setMessages(list.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content })));
      // 从最近一条带附件的 assistant 消息还原推荐资源与效果图（只读还原，不触发重新生成）
      let meta: MsgMeta | null = null;
      for (let i = list.length - 1; i >= 0; i--) {
        const m = list[i];
        if (m.role === "assistant" && m.meta && (m.meta.resources || (m.meta.renders && m.meta.renders.length))) {
          meta = m.meta;
          break;
        }
      }
      if (meta?.resources) setResources(meta.resources);
      const okRenders = (meta?.renders ?? []).filter((r) => r.status === "ok" && r.url);
      if (okRenders.length) {
        setRenderImgs((prev) => {
          const next = { ...prev };
          for (const r of okRenders) next[r.plantId] = r.url as string;
          return next;
        });
      }
    } catch {
      /* 加载失败保持空对话 */
    }
  }

  function newConversation() {
    if (streaming) abortRef.current?.abort();
    setActiveId(null);
    setMessages([]);
    setResources(null);
    setMindIdx(null);
  }

  /** 统一发送入口：快捷提问、手输、回车全部走这里；无活跃对话时自动创建，绝不另开对话 */
  function sendMessage(text: string, targetPlant: PlantLite) {
    const content = text.trim();
    if (!content || streaming) return;
    let convId = activeId;
    if (!convId && signedIn) {
      convId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setActiveId(convId);
    }
    void stream(content, targetPlant, convId ?? null);
  }

  async function renameConversation(id: string, title: string) {
    const t = title.trim();
    setRenamingId(null);
    if (!t) return;
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title: t.slice(0, 40) } : c)));
    try {
      await fetch("/api/chat-history", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: id, title: t }),
      });
    } catch {
      /* 重命名失败下次加载恢复 */
    }
  }

  async function deleteConversation(id: string) {
    if (!window.confirm("删除该对话？删除后消息不可恢复。")) return;
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) newConversation();
    try {
      await fetch(`/api/chat-history?conversationId=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch {
      /* 删除失败下次加载仍会显示 */
    }
  }

  // 页面模式才加载/自动打开历史对话；内嵌模式为植物范围内的即时问答
  useEffect(() => {
    if (mode !== "page" || !signedIn) return;
    void loadConversations().then((list) => {
      // 「展开为完整页」带 ?conv= 时延续指定会话（存在才打开，否则回退最新一条）
      if (initialConvId) {
        const target = list.find((c) => c.id === initialConvId);
        if (target) {
          void openConversation(target.id);
          return;
        }
      }
      if (list.length > 0 && !plant) void openConversation(list[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, mode]);

  useEffect(() => {
    if (!startedRef.current && contextPlant && messages.length === 0 && !initialConvId) {
      startedRef.current = true;
      sendMessage(`请讲解${contextPlant.name}的观赏特性、造景应用与养护要点`, contextPlant);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 内嵌模式带 initialConvId（图鉴窄栏刷新恢复）：延续旧会话而非重新讲解
  useEffect(() => {
    if (mode !== "embedded" || !signedIn || !initialConvId) return;
    void openConversation(initialConvId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const quick = contextPlant ? QUICK_WITH_PLANT : QUICK_GENERAL;

  // 相关推荐图片：只展示本地图鉴图（必定可用）；历史会话里残留的网络图一律过滤
  const resourceImgs = resources
    ? resources.images
        .filter((img) => img.url.startsWith("/images/"))
        .map((img) => ({ ...img, local: true }))
    : [];

  return {
    plant,
    signedIn,
    messages,
    conversations,
    activeId,
    listOpen,
    renamingId,
    renameValue,
    contextPlant,
    input,
    streaming,
    resources,
    speakingIdx,
    listening,
    mindIdx,
    renderImgs,
    generating,
    renderNotice,
    micSupported,
    quick,
    resourceImgs,
    abortRef,
    bottomRef,
    setInput,
    setContextPlant,
    setMindIdx,
    setListOpen,
    setRenamingId,
    setRenameValue,
    sendMessage,
    newConversation,
    openConversation,
    renameConversation,
    deleteConversation,
    generateRender,
    speak,
    toggleMic,
  };
}

export type ChatController = ReturnType<typeof useChat>;
