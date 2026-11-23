"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  MessageCircleQuestion,
  Mic,
  Network,
  SendHorizontal,
  Sprout,
  Square,
  TriangleAlert,
  Volume2,
  X,
} from "lucide-react";
import { MindMap } from "@/components/MindMap";
import type { ChatController, ChatMode } from "./use-chat";

/**
 * 可复用对话区：消息流 + 输入区（不含历史列表、不含右侧推荐、不含「新对话」按钮）。
 * 状态全部经 props（chat controller）注入，不依赖 /chat 路由或页面级上下文。
 * mode="page" 显示「智能问答」标题；"embedded" 供第 10 轮图鉴内嵌。
 */
export function ChatPanel({
  chat,
  mode = "page",
  headerSlot,
  flush = false,
}: {
  chat: ChatController;
  mode?: ChatMode;
  /** 渲染在标题栏右侧的可选插槽（如页面模式下的右侧面板折叠开关） */
  headerSlot?: React.ReactNode;
  /** 内嵌进连通面板时去掉自身卡片外壳，尺寸由父级控制 */
  flush?: boolean;
}) {
  const {
    plant,
    signedIn,
    messages,
    contextPlant,
    setContextPlant,
    input,
    setInput,
    streaming,
    speakingIdx,
    listening,
    mindIdx,
    setMindIdx,
    micSupported,
    quick,
    bottomRef,
    abortRef,
    sendMessage,
    speak,
    toggleMic,
  } = chat;

  const showHeader = mode === "page" || Boolean(contextPlant) || Boolean(headerSlot);
  // 图鉴内嵌窄栏：隐藏推荐问题、话筒挪到输入框上方，输入框独占一行更宽
  const embedded = mode === "embedded";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input, contextPlant);
  };

  const textarea = (
    <textarea
      value={input}
      onChange={(e) => setInput(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendMessage(input, contextPlant);
        }
      }}
      rows={1}
      maxLength={2000}
      placeholder="输入问题，或点话筒语音提问，Enter 发送…"
      className="max-h-32 flex-1 resize-none rounded-xl bg-surface-container px-4 py-3 text-fs-sub text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-ink"
    />
  );

  const micBtn = (
    <button
      type="button"
      onClick={toggleMic}
      disabled={!micSupported}
      aria-label={listening ? "停止语音输入" : "语音输入"}
      title={micSupported ? (listening ? "停止语音输入" : "点击说话，语音输入问题") : "当前浏览器不支持语音输入"}
      className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors disabled:opacity-40 ${
        listening ? "animate-pulse bg-error text-on-error" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
      }`}
    >
      <Mic className="h-4 w-4" />
    </button>
  );

  const sendBtn = streaming ? (
    <button
      type="button"
      onClick={() => abortRef.current?.abort()}
      aria-label="停止生成"
      className="rounded-xl bg-surface-container px-3.5 py-3 text-on-surface-variant transition-colors hover:bg-surface-container-high"
    >
      <Square className="h-4 w-4" />
    </button>
  ) : (
    <button
      type="submit"
      disabled={!input.trim()}
      aria-label="发送"
      className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-on-primary transition-opacity hover:opacity-90 disabled:opacity-40"
    >
      <SendHorizontal className="h-4 w-4" />
    </button>
  );

  return (
    <section
      className={
        flush
          ? "flex min-h-0 flex-col overflow-hidden h-full"
          : `flex flex-col overflow-hidden rounded-xl bg-surface shadow-card ${
              mode === "page" ? "min-h-[var(--size-chat-min)] lg:h-[var(--size-panel-vh)]" : "h-[var(--size-chat-pane)]"
            }`
      }
    >
      {showHeader && (
        <header className="flex items-center justify-between gap-3 border-b-neo border-outline-variant/20 px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            {mode === "page" && (
              <>
                <MessageCircleQuestion className="h-5 w-5 shrink-0 text-foreground" />
                <h1 className="font-medium text-on-surface">智能问答</h1>
              </>
            )}
            {contextPlant && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-error/10 px-2.5 py-1 text-fs-label font-medium text-error">
                <TriangleAlert className="h-3 w-3" />
                正在讲解：{contextPlant.name}
                <button
                  type="button"
                  onClick={() => setContextPlant(null)}
                  aria-label="取消讲解上下文"
                  className="hover:opacity-70"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
          {headerSlot}
        </header>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="mx-auto w-full max-w-measure space-y-4">
          {messages.length === 0 && (
            <div className="flex gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-neo border-ink bg-primary-container text-on-primary-container">
                <Sprout className="h-4 w-4" />
              </div>
              <div className="max-w-[var(--size-bubble-max)] rounded-2xl rounded-tl-md border-neo border-ink bg-surface-container px-4 py-3 text-fs-sub leading-relaxed text-on-surface">
                你好，我是植景小匠的 AI 助教。课程收录的植物都可以问我：识别要点、习性、造景应用、安全知识都行。
                {!signedIn && "（登录后可保存对话记录）"}
              </div>
            </div>
          )}
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end gap-2.5">
                <div className="max-w-[var(--size-bubble-max)] whitespace-pre-wrap rounded-2xl rounded-tr-md border-neo border-ink bg-primary px-4 py-3 text-fs-sub leading-relaxed text-on-primary">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-neo border-ink bg-primary-container text-on-primary-container">
                  <Sprout className="h-4 w-4" />
                </div>
                <div className="max-w-[var(--size-bubble-max-lg)] rounded-2xl rounded-tl-md border-neo border-ink bg-surface-container px-4 py-3 text-fs-sub leading-relaxed text-on-surface">
                  {m.content ? (
                    <>
                      <div className="mb-2 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setMindIdx(mindIdx === i ? null : i)}
                          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-fs-label transition-colors ${
                            mindIdx === i
                              ? "bg-primary text-on-primary"
                              : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
                          }`}
                        >
                          <Network className="h-3 w-3" />
                          {mindIdx === i ? "思维导图" : "文字"}
                        </button>
                      </div>
                      {mindIdx === i ? (
                        <MindMap text={m.content} topic={plant?.name ?? "植物问答"} />
                      ) : (
                        <div className="md-body">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                        </div>
                      )}
                    </>
                  ) : streaming && i === messages.length - 1 ? (
                    <span className="inline-block h-4 w-2 animate-pulse bg-on-surface-variant/60 align-middle" />
                  ) : null}
                  {m.content && !streaming && (
                    <button
                      type="button"
                      onClick={() => speak(m.content, i)}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface-container-highest px-3 py-1 text-fs-label text-on-surface-variant transition-colors hover:text-foreground"
                      title={speakingIdx === i ? "停止朗读" : "语音朗读本条回答"}
                    >
                      {speakingIdx === i ? <Square className="h-3 w-3 fill-current" /> : <Volume2 className="h-3 w-3" />}
                      {speakingIdx === i ? "停止" : "朗读"}
                    </button>
                  )}
                  {m.content && i === messages.length - 1 && !streaming && (
                    <p className="mt-2 border-t-neo border-outline-variant/20 pt-2 text-fs-label text-on-surface-variant">
                      本答案依据课程植物库资料生成 · 考试考点以课堂讲授为准
                    </p>
                  )}
                </div>
              </div>
            )
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t-neo border-outline-variant/20 px-5 pb-4 pt-3">
        <div className="mx-auto w-full max-w-measure">
          {!embedded && (
            <div className="mb-3 flex flex-wrap gap-2">
              {quick.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendMessage(q, contextPlant)}
                  disabled={streaming}
                  className="rounded-full bg-surface-container px-3 py-1.5 text-fs-label text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
          {embedded ? (
            <form onSubmit={submit}>
              <div className="mb-2 flex">{micBtn}</div>
              <div className="flex items-end gap-2">
                {textarea}
                {sendBtn}
              </div>
            </form>
          ) : (
            <form className="flex items-end gap-2" onSubmit={submit}>
              {textarea}
              {micBtn}
              {sendBtn}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
