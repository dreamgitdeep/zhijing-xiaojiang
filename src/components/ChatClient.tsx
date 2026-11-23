"use client";

import { useEffect, useState } from "react";
import { BookOpen, ChevronDown, History, PanelRightClose, PanelRightOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { useChat, fmtConvTime, type PlantLite, type PlantName } from "./chat/use-chat";
import { ChatPanel } from "./chat/ChatPanel";
import { RecommendPanel } from "./chat/RecommendPanel";
import { useDragWidth } from "@/lib/use-drag-width";

const RIGHT_OPEN_KEY = "zjxj:chat:rightOpen";

/**
 * /chat 页面模式组合层：历史对话（左）+ 对话区（中）+ 推荐面板（右）。
 * 右侧推荐面板可折叠并与中间对话区联动；状态经 localStorage 持久化。
 * 对话与推荐逻辑全部在 useChat / ChatPanel / RecommendPanel，可复用于图鉴内嵌。
 */
export default function ChatClient({
  plant,
  signedIn,
  plantsLite,
  initialConvId,
}: {
  plant: PlantLite;
  signedIn: boolean;
  plantsLite: PlantName[];
  initialConvId?: string;
}) {
  const chat = useChat({ plant, signedIn, plantsLite, mode: "page", initialConvId });
  const {
    conversations,
    activeId,
    listOpen,
    setListOpen,
    renamingId,
    renameValue,
    setRenamingId,
    setRenameValue,
    newConversation,
    openConversation,
    renameConversation,
    deleteConversation,
  } = chat;

  // 右侧推荐面板折叠状态：默认展开，读取 localStorage 持久化值
  const [rightOpen, setRightOpen] = useState(true);
  // 「图鉴速查」分组（来源=catalog 的会话）折叠状态；图鉴内嵌问答产生的会话归入此分组
  const [catalogOpen, setCatalogOpen] = useState(true);
  // 三板块连通布局：左（历史）/右（推荐）宽度可拖动，持久化
  const [leftW, startLeftDrag] = useDragWidth(240, 180, 400, "zjxj:chat:left-w");
  const [rightW, startRightDrag] = useDragWidth(300, 220, 420, "zjxj:chat:right-w");
  useEffect(() => {
    try {
      const v = localStorage.getItem(RIGHT_OPEN_KEY);
      if (v != null) setRightOpen(v === "1");
    } catch {
      /* localStorage 不可用时保持默认展开 */
    }
  }, []);
  function toggleRight() {
    setRightOpen((o) => {
      const next = !o;
      try {
        localStorage.setItem(RIGHT_OPEN_KEY, next ? "1" : "0");
      } catch {
        /* 忽略持久化失败 */
      }
      return next;
    });
  }

  // 窄屏不做推荐面板适配（教师明确无需移动端适配）；推荐面板仅桌面三栏显示

  const collapseBtn = (
    <button
      type="button"
      onClick={toggleRight}
      aria-label={rightOpen ? "收起推荐面板" : "展开推荐面板"}
      title={rightOpen ? "收起右侧推荐面板" : "展开右侧推荐面板"}
      className="hidden shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-fs-label text-on-surface-variant transition-colors hover:bg-surface-container lg:flex"
    >
      {rightOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
      {rightOpen ? "收起推荐" : "展开推荐"}
    </button>
  );

  // 单条会话项（普通对话与图鉴速查分组共用）
  function renderConvItem(c: { id: string; title: string; lastAt: string }) {
    return renamingId === c.id ? (
      <input
        autoFocus
        value={renameValue}
        onChange={(e) => setRenameValue(e.target.value)}
        onBlur={() => void renameConversation(c.id, renameValue)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void renameConversation(c.id, renameValue);
          if (e.key === "Escape") setRenamingId(null);
        }}
        aria-label="重命名对话"
        className="w-full rounded-md border-neo border-primary/40 bg-surface px-2 py-1.5 text-fs-label text-on-surface focus:outline-none"
      />
    ) : (
      <div
        className={`group flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 transition-colors ${
          activeId === c.id ? "bg-primary-container/70" : "hover:bg-surface-container"
        }`}
        onClick={() => void openConversation(c.id)}
      >
        <div className="min-w-0 flex-1">
          <p className={`truncate text-fs-label ${activeId === c.id ? "font-medium text-on-surface" : "text-on-surface"}`}>
            {c.title}
          </p>
          <p className="text-fs-label text-on-surface-variant/80">{fmtConvTime(c.lastAt)}</p>
        </div>
        <button
          type="button"
          aria-label="重命名对话"
          onClick={(e) => {
            e.stopPropagation();
            setRenamingId(c.id);
            setRenameValue(c.title);
          }}
          className="hidden rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface group-hover:block"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="删除对话"
          onClick={(e) => {
            e.stopPropagation();
            void deleteConversation(c.id);
          }}
          className="hidden rounded p-1 text-on-surface-variant hover:bg-error/10 hover:text-error group-hover:block"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  const normalConvs = conversations.filter((c) => c.source !== "catalog");
  const catalogConvs = conversations.filter((c) => c.source === "catalog");

  const conversationListInner = (
    <>
      <div className="flex items-center justify-between gap-2 border-b-neo border-outline-variant/20 px-4 py-3">
        <p className="flex items-center gap-1.5 text-fs-label font-medium text-on-surface-variant">
          <History className="h-3.5 w-3.5" />
          历史对话
        </p>
        <button
          type="button"
          onClick={newConversation}
          className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-fs-label font-medium text-on-primary transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          新建对话
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {!signedIn && <p className="px-2 py-3 text-fs-label text-on-surface-variant">登录后可保存并查看历史对话</p>}
        {signedIn && conversations.length === 0 && (
          <p className="px-2 py-3 text-fs-label text-on-surface-variant">还没有对话记录，点「新建对话」开始提问</p>
        )}
        <ul className="space-y-1">{normalConvs.map((c) => <li key={c.id}>{renderConvItem(c)}</li>)}</ul>
        {catalogConvs.length > 0 && (
          <div className="mt-3 border-t-neo border-outline-variant/20 pt-2">
            <button
              type="button"
              onClick={() => setCatalogOpen((o) => !o)}
              aria-expanded={catalogOpen}
              className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-fs-label font-medium text-on-surface-variant transition-colors hover:bg-surface-container"
            >
              <span className="flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5" />
                图鉴速查（{catalogConvs.length}）
              </span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform motion-reduce:transition-none ${catalogOpen ? "" : "-rotate-90"}`} />
            </button>
            {catalogOpen && (
              <ul className="mt-1 space-y-1">{catalogConvs.map((c) => <li key={c.id}>{renderConvItem(c)}</li>)}</ul>
            )}
          </div>
        )}
      </div>
    </>
  );

  const dividerCls = "w-1 shrink-0 cursor-col-resize bg-outline-variant/30 transition-colors hover:bg-primary/50";

  return (
    <>
      {/* 窄屏：可折叠历史对话 + 对话区（推荐面板仅桌面显示） */}
      <div className="flex flex-col gap-6 lg:hidden">
        <div>
          <button
            type="button"
            onClick={() => setListOpen((v) => !v)}
            className="mb-2 flex w-full items-center justify-between rounded-xl bg-surface px-4 py-3 text-fs-sub font-medium text-on-surface shadow-card"
          >
            历史对话（{conversations.length}）
            <span className="text-fs-label text-on-surface-variant">{listOpen ? "收起" : "展开"}</span>
          </button>
          {listOpen && (
            <div className="flex flex-col overflow-hidden rounded-xl bg-surface shadow-card">{conversationListInner}</div>
          )}
        </div>
        <ChatPanel chat={chat} mode="page" headerSlot={collapseBtn} />
      </div>

      {/* 桌面：历史对话 + 对话区 + 推荐面板连成一个整体，分隔条可拖动调宽 */}
      <div className="hidden h-[var(--size-panel-vh)] overflow-hidden rounded-xl bg-surface shadow-card lg:flex">
        <aside className="flex min-h-0 shrink-0 flex-col border-r-neo border-outline-variant/20" style={{ width: leftW }}>
          {conversationListInner}
        </aside>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="拖动调整历史对话宽度"
          onPointerDown={(e) => startLeftDrag(e, 1)}
          className={dividerCls}
        />
        <div className="min-h-0 min-w-0 flex-1">
          <ChatPanel chat={chat} mode="page" flush headerSlot={collapseBtn} />
        </div>
        {rightOpen && (
          <>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="拖动调整推荐面板宽度"
              onPointerDown={(e) => startRightDrag(e, -1)}
              className={dividerCls}
            />
            <aside className="flex min-h-0 shrink-0 flex-col border-l-neo border-outline-variant/20" style={{ width: rightW }}>
              <RecommendPanel chat={chat} flush />
            </aside>
          </>
        )}
      </div>
    </>
  );
}
