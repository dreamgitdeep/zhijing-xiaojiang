"use client";
import { useRef, useState } from "react";
import { Mic, Sparkles } from "lucide-react";
import { useVoiceInput } from "@/components/design/use-voice-input";

export interface AiSearchResult {
  conditions: Record<string, unknown>;
  description: string[];
  unrecognized: { field: string; value: string }[];
  count: number;
  ids: string[];
}

export function AiSearchPanel(
  {
    loggedIn,
    onApply
  }: {
    loggedIn: boolean;
    onApply: (r: AiSearchResult) => void;
  }
) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const voiceBaseRef = useRef("");
  const { supported: micSupported, listening, toggle: toggleMic } = useVoiceInput((t) => {
    const base = voiceBaseRef.current;
    setQuery(base ? base.trimEnd() + " " + t : t);
  });
  const onMic = () => {
    if (!listening) voiceBaseRef.current = query;
    toggleMic();
  };

  const submit = async () => {
    const q = query.trim();
    if (!q) { setMsg({ kind: "info", text: "先输入或语音说出想找的植物，比如「桂花」或「耐阴、耐湿、适合水边」" }); return; }
    if (!loggedIn) { setMsg({ kind: "info", text: "AI 辅助搜索登录后可用" }); return; }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/catalog/ai-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (res.status === 401) { setMsg({ kind: "info", text: "AI 辅助搜索登录后可用" }); return; }
      if (res.status === 429 || !res.ok) { setMsg({ kind: "error", text: data.message ?? "AI 搜索暂不可用，请稍后再试" }); return; }
      if (data.description?.length === 0) {
        setMsg({ kind: "info", text: "没能从描述中解析出筛选条件，换个说法试试，或直接用下方筛选栏" });
        return;
      }
      onApply(data);
    } catch {
      setMsg({ kind: "error", text: "网络异常，请稍后再试" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl bg-primary-container/60 p-3.5 shadow-card">
      <p className="flex items-center gap-1.5 text-fs-sub font-medium text-on-surface">
        <Sparkles className="h-4 w-4 text-foreground" />
        AI 辅助搜索
      </p>
      <p className="mt-1 text-fs-label text-on-surface-variant">
        可直接搜名称 / 学名 / 别名，也可描述习性，如「耐阴耐湿、适合水边」
      </p>
      <div className="relative mt-2.5">
        <textarea
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          rows={3}
          placeholder="如：桂花，或耐阴耐湿、适合水边的灌木"
          className="w-full resize-none rounded-lg border-none bg-surface py-2.5 pl-3.5 pr-11 text-fs-sub text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-ink" />
        {micSupported && (
          <button
            type="button"
            onClick={onMic}
            aria-label={listening ? "停止语音输入" : "开始语音输入"}
            title={listening ? "正在录音，说完点击结束" : "点击开始语音输入"}
            className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 transition-colors ${listening ? "bg-error text-on-error" : "bg-primary-container text-foreground hover:bg-primary hover:text-on-primary"}`}>
            {listening && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-error/40" />}
            <Mic className={`relative h-4 w-4 ${listening ? "animate-pulse" : ""}`} />
          </button>
        )}
      </div>
      {listening && (
        <p className="mt-1.5 flex items-center gap-1.5 text-fs-label text-error">
          <span aria-hidden className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-error" />
          正在聆听，请说话…说完再点一下话筒即可结束
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={submit}
        className="mt-2.5 w-full rounded-lg bg-primary py-2.5 text-fs-sub font-medium text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50">
        {busy ? "解析中…" : "搜索"}
      </button>
      {msg && <p className={`mt-2 text-fs-label ${msg.kind === "error" ? "text-error" : "text-on-surface-variant"}`}>{msg.text}</p>}
    </div>
  );
}
