"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Sparkles, X } from "lucide-react";
import { useVoiceInput } from "./use-voice-input";

export interface ParsedEntry {
  topic: string;
  keywords: string[];
  importance: "critical" | "normal";
  answer: string;
}

export default function InquiryAiModal({
  open,
  existingCount,
  onClose,
  onApply,
}: {
  open: boolean;
  existingCount: number;
  onClose: () => void;
  onApply: (entries: ParsedEntry[], mode: "replace" | "append") => void;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState<ParsedEntry[] | null>(null);
  const voiceBase = useRef("");

  useEffect(() => {
    if (open) {
      setText("");
      setErr("");
      setPreview(null);
      setLoading(false);
    }
  }, [open]);

  const voice = useVoiceInput((t) => {
    setText(voiceBase.current + (voiceBase.current ? "\n" : "") + t);
  });

  if (!open) return null;

  function startVoice() {
    if (!voice.listening) voiceBase.current = text;
    voice.toggle();
  }

  async function parse() {
    const t = text.trim();
    if (!t) return setErr("请先填写或口述一段任务需求");
    setLoading(true);
    setErr("");
    setPreview(null);
    try {
      const res = await fetch("/api/admin/design-tasks/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "parseInquiry", text: t }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return setErr(d.message ?? "识别失败，请重试");
      setPreview(d.entries ?? []);
    } catch {
      setErr("识别失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  const field = "w-full rounded-lg border-neo border-outline-variant/30 bg-surface px-3 py-2 text-fs-body text-on-surface focus:outline-none focus:ring-2 focus:ring-ink";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[var(--size-modal-vh)] w-full max-w-2xl flex-col rounded-2xl bg-surface p-6 shadow-float" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-fs-card font-medium text-on-surface">AI 智能填写「学生可问问题与 AI 回答」</h3>
            <p className="mt-1 text-fs-label text-on-surface-variant">
              用一段话描述任务里学生可能要问的问题与参考答案，AI 会按「主题 / 关键词 / 重要性 / 回答」自动拆成条目。
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-on-surface-variant transition hover:bg-surface-container" aria-label="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          <div className="flex items-end gap-2">
            <textarea
              className={`${field} min-h-[var(--size-min-xs)] resize-y`}
              placeholder="示例：这个场地朝南、夏季西晒严重，学生可能会问光照怎么处理；场地原有几株大树要保留，可问保留与利用……"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            {voice.supported && (
              <button
                type="button"
                onClick={startVoice}
                aria-label={voice.listening ? "停止语音输入" : "语音输入"}
                title={voice.listening ? "停止语音输入" : "语音输入"}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                  voice.listening ? "animate-pulse bg-error text-on-error" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                <Mic className="h-4 w-4" />
              </button>
            )}
          </div>

          {!preview && (
            <button
              type="button"
              disabled={loading}
              onClick={() => void parse()}
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-fs-body font-medium text-on-primary transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? "AI 识别中…" : "AI 识别并拆分"}
            </button>
          )}

          {err && <p className="text-fs-label text-error">{err}</p>}

          {preview && (
            <div className="space-y-2">
              <p className="text-fs-label text-on-surface-variant">已识别 {preview.length} 条，确认后可填入：</p>
              {preview.map((e, i) => (
                <div key={i} className="rounded-lg border-neo border-outline-variant/25 bg-surface-container-lowest/40 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-fs-sub font-medium text-on-surface">{e.topic}</span>
                    <span className={`rounded-full px-2 py-0.5 text-fs-label ${e.importance === "critical" ? "bg-primary-container text-on-primary-container" : "bg-surface-container-high text-on-surface-variant"}`}>
                      {e.importance === "critical" ? "关键" : "普通"}
                    </span>
                  </div>
                  <p className="mt-1 text-fs-label text-on-surface-variant">关键词：{e.keywords.join("、") || "（无）"}</p>
                  <p className="mt-1 text-fs-label text-on-surface">{e.answer}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {preview && (
          <div className="mt-4 flex items-center gap-2 border-t-neo border-outline-variant/20 pt-4">
            <button type="button" onClick={() => onApply(preview, "replace")} className="rounded-full bg-primary px-4 py-2 text-fs-body font-medium text-on-primary transition hover:opacity-90">
              替换填入{existingCount > 0 ? `（覆盖现有 ${existingCount} 条）` : ""}
            </button>
            <button type="button" onClick={() => onApply(preview, "append")} className="rounded-full bg-surface-container px-4 py-2 text-fs-body font-medium text-on-surface transition hover:bg-surface-container-high">
              追加填入
            </button>
            <button type="button" onClick={() => setPreview(null)} className="rounded-full px-4 py-2 text-fs-body text-on-surface-variant transition hover:bg-surface-container">
              重新识别
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
