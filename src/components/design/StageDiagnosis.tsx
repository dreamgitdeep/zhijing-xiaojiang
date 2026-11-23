"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, Mic, MicOff, Phone, PhoneOff, Send } from "lucide-react";
import { startSplitDrag } from "./split";
import type { SessionUser } from "@/lib/auth";
import type { StudentRun } from "@/lib/design";
import { ReviewCard } from "./ReviewCard";
import { useVoiceCall } from "./use-voice-call";
import { useVoiceInput } from "./use-voice-input";

interface Props {
  user: SessionUser | null;
  task: Record<string, any>;
  nongyuan: Record<string, any>;
  run: StudentRun | null;
  onRun: (r: StudentRun) => void;
  onUnlocked: () => void;
}

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export function StageDiagnosis({ user, task, nongyuan, run, onRun, onUnlocked }: Props) {
  const passScore = nongyuan.scoring?.passScore ?? task.passScore ?? 60;
  const savedPayload = run?.stage_payloads?.S1 as { payload?: Record<string, string>; meta?: any } | undefined;
  const savedReview = run?.stage_reviews?.S1;
  const savedScore = run?.stage_scores?.S1;
  const storageKey = `zjxj:design:${task.id}:S1:${user?.id ?? "anon"}`;

  const [messages, setMessages] = useState<Msg[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [hitEntryIds, setHitEntryIds] = useState<string[]>(savedPayload?.meta?.hitEntryIds ?? []);
  const [askedCount, setAskedCount] = useState<number>(savedPayload?.meta?.askedCount ?? 0);
  const [form, setForm] = useState<Record<string, string>>(savedPayload?.payload ?? {});
  const sentenceBufRef = useRef("");

  // 配额超额 / 不支持通话时的文字+语音输入降级
  const [input, setInput] = useState("");
  const [quotaBlocked, setQuotaBlocked] = useState(false);
  const [quotaInfo, setQuotaInfo] = useState("");
  const [micDenied, setMicDenied] = useState(false);
  const [listening, setListening] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const recRef = useRef<any>(null);

  // 刷新恢复：从 localStorage 取回对话记录（服务端不存对话文本）
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved.messages)) setMessages(saved.messages);
        if (Array.isArray(saved.hitEntryIds) && saved.hitEntryIds.length) setHitEntryIds(saved.hitEntryIds);
        if (typeof saved.askedCount === "number" && saved.askedCount > 0) setAskedCount(saved.askedCount);
        if (saved.form && typeof saved.form === "object") setForm((f) => ({ ...f, ...saved.form }));
      }
    } catch {
      /* 本地草稿损坏时忽略 */
    }
    setReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ messages, hitEntryIds, askedCount, form }));
    } catch {
      /* 存储满时忽略 */
    }
  }, [ready, storageKey, messages, hitEntryIds, askedCount, form]);

  const call = useVoiceCall(
    (text) => {
      void ask(text, true);
    },
    {
      onAutoEnd: () => {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: "本次通话已达时长上限，已自动挂断。可以再次拨打，或改用文字提问。" },
        ]);
      },
    }
  );

  async function answerCall() {
    if (call.phase !== "idle") return;
    setMicDenied(false);
    try {
      const res = await fetch("/api/voice/session", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.allowed) {
        setQuotaInfo(data?.quota ? `今日语音通话 ${data.quota} 次已用完` : "今日语音通话次数已用完");
        setQuotaBlocked(true);
        return;
      }
    } catch {
      setQuotaInfo("通话配额服务暂不可用");
      setQuotaBlocked(true);
      return;
    }
    let ok = false;
    if (messages.length === 0) {
      const greeting = "你好，我是这块基地的场地顾问。光照、土壤、排水这些情况，直接开口问我就行。";
      setMessages([{ role: "assistant", content: greeting }]);
      ok = await call.answer(greeting);
    } else {
      ok = await call.answer("我们继续，你还想了解场地的哪些情况？");
    }
    if (!ok) setMicDenied(true);
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
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const text = e.results?.[0]?.[0]?.transcript ?? "";
      if (text) setInput((prev) => (prev ? prev + " " : "") + text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  useEffect(() => {
    const w = window as unknown as Record<string, any>;
    setMicSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => {
      try {
        recRef.current?.abort?.();
      } catch {
        /* 已停止时忽略 */
      }
    };
  }, []);

  const [review, setReview] = useState<any>(
    savedReview
      ? {
          score: savedScore ?? 0,
          passed: (savedScore ?? 0) >= passScore,
          passScore,
          feedback: savedReview.feedback ?? "",
          cards: savedReview.cards ?? [],
          issues: savedReview.issues ?? [],
          keyPoints: savedReview.keyPoints ?? [],
        }
      : null
  );
  const [submitting, setSubmitting] = useState(false);
  const [chatPct, setChatPct] = useState(50);
  const listRef = useRef<HTMLDivElement>(null);
  const splitRef = useRef<HTMLDivElement>(null);

  const fields: any[] = nongyuan.diagnosisForm ?? [];

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function ask(text: string, speak: boolean) {
    if (!text.trim() || streaming) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setStreaming(true);
    setAskedCount((c) => c + 1);
    setMessages((m) => [...m, { role: "assistant", content: "" }]);
    sentenceBufRef.current = "";
    try {
      const res = await fetch("/api/design/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          messages: [...messages, { role: "user", content: text }],
          hitEntryIds,
        }),
      });
      if (!res.ok || !res.body) throw new Error("chat failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let meta: any = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.type === "meta") meta = parsed;
            else if (typeof parsed.text === "string") {
              setMessages((m) => {
                const next = [...m];
                const last = next[next.length - 1];
                next[next.length - 1] = { ...last, content: last.content + parsed.text };
                return next;
              });
              sentenceBufRef.current += parsed.text;
              if (speak) {
                let seg: RegExpMatchArray | null;
                while ((seg = sentenceBufRef.current.match(/^[^。！？!?；;\n]*[。！？!?；;\n]/))) {
                  const sentence = seg[0];
                  sentenceBufRef.current = sentenceBufRef.current.slice(sentence.length);
                  if (sentence.trim()) call.speakSentence(sentence);
                }
                if (sentenceBufRef.current.length >= 24) {
                  const buf = sentenceBufRef.current;
                  const cut = Math.max(buf.lastIndexOf("，"), buf.lastIndexOf("、"), buf.lastIndexOf(","));
                  if (cut >= 8) {
                    sentenceBufRef.current = buf.slice(cut + 1);
                    const part = buf.slice(0, cut + 1);
                    if (part.trim()) call.speakSentence(part);
                  }
                }
              }
            }
          } catch {
            /* 忽略非 JSON 行 */
          }
        }
      }
      if (speak && sentenceBufRef.current.trim()) call.speakSentence(sentenceBufRef.current);
      if (meta?.newHits?.length) setHitEntryIds((h) => [...new Set([...h, ...meta.newHits])]);
    } catch {
      const errMsg = "对话服务暂不可用，请稍后再试。";
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = { role: "assistant", content: errMsg };
        return next;
      });
      if (speak) call.speakSentence(errMsg);
    } finally {
      sentenceBufRef.current = "";
      setStreaming(false);
      if (speak) call.markStreamEnd();
    }
  }

  async function submit() {
    setSubmitting(true);
    setReview(null);
    try {
      const res = await fetch("/api/design/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, stageKey: "S1", payload: form, meta: { hitEntryIds, askedCount } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "review failed");
      setReview(data);
      const pr = await fetch(`/api/design/progress?taskId=${task.id}`);
      if (pr.ok) {
        const pd = await pr.json();
        if (pd.run) onRun(pd.run);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 lg:h-full">
      <div ref={splitRef} className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:gap-0">
      {/* 对话区 */}
      <div className="w-full min-w-0 lg:h-full lg:w-[var(--cw)]" style={{ "--cw": `${chatPct}%` } as CSSProperties}>
      <section className="flex h-[var(--size-chat-pane)] flex-col rounded-2xl bg-water-container/60 shadow-card lg:h-full">
        <header className="flex items-center gap-2 border-b-neo border-outline-variant/20 px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-water text-on-primary">
            <Bot className="h-4 w-4" />
          </span>
          <div>
            <p className="text-fs-sub font-medium text-on-surface">场地顾问 AI</p>
            <p className="text-fs-label text-on-surface-variant">提问解锁场地线索，不代填诊断结论</p>
          </div>
          <div className="ml-auto flex gap-1.5 text-fs-label">
            <span className="rounded-full bg-surface-container px-2 py-1 text-on-surface-variant">已问 {askedCount}</span>
            <span className="rounded-full bg-primary-container/60 px-2 py-1 text-on-primary-container">关键线索 {hitEntryIds.length}/{(nongyuan.inquiry?.criticalEntryIds ?? []).length}</span>
          </div>
        </header>
        {call.phase === "idle" ? (
        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {messages.length === 0 && (
            <p className="rounded-xl bg-surface-container px-3 py-2 text-fs-label text-on-surface-variant">
              试着问：场地的光照和土壤情况如何？雨季排水有问题吗？
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              {m.role === "user" ? (
                <p className="max-w-[var(--size-bubble-max-lg)] rounded-2xl rounded-tr-md bg-primary px-3.5 py-2 text-fs-sub text-on-primary">
                  {m.content || "…"}
                </p>
              ) : (
                <div className="max-w-[var(--size-bubble-max-lg)] rounded-2xl rounded-tl-md bg-surface-container px-3.5 py-2 text-on-surface-variant">
                  {m.content ? (
                    <div className="md-body overflow-x-auto">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-fs-sub">…</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-3">
          <div className="relative flex h-24 w-24 items-center justify-center">
            {(call.phase === "listening" || call.phase === "speaking") && (
              <span
                className={`absolute inset-0 animate-ping rounded-full opacity-30 ${
                  call.phase === "listening" ? "bg-success" : "bg-water"
                }`}
              />
            )}
            <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-water text-on-primary shadow-card">
              <Bot className="h-8 w-8" />
            </span>
          </div>
          <p className="text-fs-card font-medium text-on-surface">
            {call.phase === "connecting" && "接通中…"}
            {call.phase === "listening" && (call.muted ? "已静音，点麦克风恢复" : "正在聆听，直接开口提问…")}
            {call.phase === "thinking" && "顾问思考中…"}
            {call.phase === "speaking" && "顾问回答中…"}
          </p>
          <p className="text-fs-label tabular-nums text-on-surface-variant">
            {String(Math.floor(call.seconds / 60)).padStart(2, "0")}:{String(call.seconds % 60).padStart(2, "0")}
          </p>
          <div className="w-full max-w-[var(--size-bubble-max-lg)] rounded-xl bg-surface-container px-3 py-2 text-center text-fs-sub text-on-surface-variant">
            {(call.phase === "listening"
              ? call.vadActive
                ? "检测到你在说话…"
                : ""
              : call.phase === "speaking"
                ? call.speakingText
                : "") || "…"}
          </div>
        </div>
        )}
        {call.phase === "idle" ? (
        quotaBlocked ? (
        <div className="space-y-2 border-t-neo border-outline-variant/20 p-3">
          <p className="rounded-xl bg-surface-container px-3 py-2 text-fs-label text-on-surface-variant">
            {quotaInfo}，请改用文字或语音输入继续对话。
          </p>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !streaming && input.trim()) {
                  void ask(input, false);
                  setInput("");
                }
              }}
              placeholder="输入你的问题…"
              className="min-w-0 flex-1 rounded-xl border-neo border-outline-variant/30 bg-surface-container px-3 py-2.5 text-fs-sub text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-ink"
            />
            {micSupported && (
              <button
                type="button"
                onClick={toggleMic}
                aria-label="语音输入"
                title="语音输入"
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${
                  listening ? "bg-error text-surface" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                <Mic className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (streaming || !input.trim()) return;
                void ask(input, false);
                setInput("");
              }}
              disabled={streaming || !input.trim()}
              aria-label="发送"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary transition-opacity disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
        ) : call.supported ? (
        <div className="space-y-2 border-t-neo border-outline-variant/20 p-3">
          {micDenied && (
            <p className="rounded-xl bg-surface-container px-3 py-2 text-fs-label text-error">
              无法访问麦克风：请在浏览器地址栏允许麦克风权限后重试。
            </p>
          )}
          <button
            type="button"
            onClick={() => void answerCall()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-fs-sub font-medium text-on-primary shadow-card transition-all hover:-translate-y-0.5 hover:shadow-float"
          >
            <Phone className="h-4 w-4" />
            {messages.length === 0 ? "接通顾问语音" : "继续语音通话"}
          </button>
        </div>
        ) : (
        <div className="border-t-neo border-outline-variant/20 p-3">
          <p className="rounded-xl bg-surface-container px-3 py-2.5 text-fs-label text-error">
            当前浏览器不支持语音通话，请使用 Chrome 或 Edge 浏览器打开。
          </p>
        </div>
        )
        ) : (
        <div className="flex items-center justify-center gap-3 border-t-neo border-outline-variant/20 p-3">
          <button
            type="button"
            onClick={call.toggleMute}
            aria-label={call.muted ? "取消静音" : "静音"}
            title={call.muted ? "取消静音" : "静音"}
            className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
              call.muted ? "bg-error text-surface" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            {call.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={call.hangup}
            className="flex h-11 items-center gap-2 rounded-xl bg-error px-5 text-fs-sub font-medium text-surface shadow-card transition-all hover:-translate-y-0.5 hover:shadow-float"
          >
            <PhoneOff className="h-4 w-4" />
            挂断
          </button>
        </div>
        )}
      </section>
      </div>
      <div
        title="拖拽调整宽度"
        onMouseDown={(e) =>
          startSplitDrag(e, {
            start: chatPct,
            min: 25,
            max: 75,
            total: splitRef.current?.clientWidth ?? 800,
            onMove: setChatPct,
          })
        }
        className="mx-1.5 hidden w-1.5 shrink-0 cursor-col-resize rounded-full bg-outline-variant/20 transition-colors hover:bg-primary/50 lg:block"
      />
      <div className="min-w-0 flex-1 lg:h-full">
      {/* 诊断表 */}
      <section className="flex h-[var(--size-chat-pane)] flex-col rounded-2xl bg-sprout-container/60 shadow-card lg:h-full">
        <header className="border-b-neo border-outline-variant/20 px-4 py-3">
          <p className="text-fs-sub font-medium text-on-surface">场地诊断表（S1）</p>
          <p className="text-fs-label text-on-surface-variant">结合顾问线索填写 8 项诊断，提交后 AI 评阅</p>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {fields.map((f: any, fi: number) => (
            <div key={f.key || f.label || fi}>
              <label className="text-fs-label font-medium text-on-surface">
                {f.label} <span className="font-normal text-on-surface-variant/70">{f.hint}</span>
              </label>
              <textarea
                value={form[f.key] ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                rows={2}
                className="mt-1 w-full rounded-xl border-neo border-outline-variant/30 bg-surface px-3 py-2 text-fs-sub text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-ink"
                placeholder="填写诊断结论…"
              />
            </div>
          ))}
        </div>
        <div className="border-t-neo border-outline-variant/20 p-3">
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-fs-sub font-medium text-on-primary transition-opacity disabled:opacity-40"
          >
            {submitting ? "评阅中…" : "提交诊断，AI 评阅"}
          </button>
        </div>
      </section>
      </div>
      </div>

      {review && (
        <div className="max-h-[var(--size-illu-ratio)] shrink-0 overflow-y-auto">
          <ReviewCard review={review} onRetry={() => setReview(null)} onNext={review.passed ? onUnlocked : undefined} nextLabel="进入 S2 设计定位" />
        </div>
      )}
    </div>
  );
}
