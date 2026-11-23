"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { BarChart3, Check, Copy, Mic, Send, Sparkles, Square } from "lucide-react";
import { useVoiceInput } from "./design/use-voice-input";
import { EXAMPLE_QUESTIONS } from "@/lib/analytics/intent";
import type { AnalyticsBasis, ChartSpec } from "@/lib/analytics/metrics";

const AnalyticsChart = dynamic(() => import("./analytics/AnalyticsChart"), {
  ssr: false,
  loading: () => <div className="mt-3 h-[var(--size-chart-sm)] rounded-lg bg-surface-container/50" />,
});

interface TableData {
  columns: string[];
  rows: (string | number)[][];
}

interface AssistantTurn {
  kind: "assistant";
  status: string | null;
  clarify: string | null;
  basis: AnalyticsBasis | null;
  table: TableData | null;
  chart: ChartSpec | null;
  narrative: string;
  error: string | null;
  done: boolean;
}

type Turn = { kind: "user"; text: string } | AssistantTurn;

function emptyAssistant(): AssistantTurn {
  return { kind: "assistant", status: null, clarify: null, basis: null, table: null, chart: null, narrative: "", error: null, done: false };
}

/** 从植景管家跳转的 URL 参数组装一个问题（?q= 优先，其次 class/task/range） */
function questionFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  const p = new URLSearchParams(window.location.search);
  const q = p.get("q");
  if (q && q.trim()) return q.trim();
  const cls = p.get("class");
  const task = p.get("task");
  const range = p.get("range");
  if (!cls && !task && !range) return null;
  let days: number | null = null;
  if (range) {
    const wm = range.match(/^(\d+)w$/);
    const dm = range.match(/^(\d+)d$/);
    if (wm) days = Number(wm[1]) * 7;
    else if (dm) days = Number(dm[1]);
  }
  if (task) return `分析「${task}」的提交与各阶段得分情况${cls ? `（${cls}）` : ""}`;
  if (cls) return `${cls} 的学情分析${days ? `（近 ${days} 天）` : ""}`;
  return days ? `近 ${days} 天的练习趋势` : null;
}

export default function LearningAnalyticsChat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const autoRanRef = useRef(false);

  const { supported: micSupported, listening, toggle: toggleMic } = useVoiceInput((t) => setInput(t));

  const scrollToEnd = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToEnd();
  }, [turns, scrollToEnd]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const updateLastAssistant = useCallback((patch: (t: AssistantTurn) => AssistantTurn) => {
    setTurns((prev) => {
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].kind === "assistant") {
          const copy = [...prev];
          copy[i] = patch(prev[i] as AssistantTurn);
          return copy;
        }
      }
      return prev;
    });
  }, []);

  const ask = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (!question || busy) return;
      setInput("");
      setBusy(true);
      setTurns((prev) => [...prev, { kind: "user", text: question }, emptyAssistant()]);

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch("/api/admin/learning-analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          let msg = "分析请求失败，请稍后重试";
          try {
            const j = await res.json();
            if (j.error === "FORBIDDEN") msg = "需要教师权限";
            else if (j.error === "UNAUTHORIZED") msg = "请先登录";
          } catch {
            /* ignore */
          }
          updateLastAssistant((t) => ({ ...t, error: msg, done: true }));
          return;
        }
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
            try {
              const payload = JSON.parse(line.slice(5).trim());
              if (payload.type === "status") {
                updateLastAssistant((t) => ({ ...t, status: payload.text }));
              } else if (payload.type === "result") {
                updateLastAssistant((t) => ({ ...t, status: null, basis: payload.basis, table: payload.table, chart: payload.chart }));
              } else if (payload.type === "delta") {
                updateLastAssistant((t) => ({ ...t, status: null, narrative: t.narrative + payload.text }));
              } else if (payload.type === "clarify") {
                updateLastAssistant((t) => ({ ...t, status: null, clarify: payload.text }));
              } else if (payload.type === "error") {
                updateLastAssistant((t) => ({ ...t, status: null, error: payload.text }));
              } else if (payload.type === "done") {
                updateLastAssistant((t) => ({ ...t, status: null, done: true }));
              }
            } catch {
              /* 忽略无法解析的事件 */
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          updateLastAssistant((t) => ({ ...t, status: null, error: "网络异常，请稍后重试", done: true }));
        }
      } finally {
        setBusy(false);
        updateLastAssistant((t) => ({ ...t, status: null, done: true }));
      }
    },
    [busy, updateLastAssistant],
  );

  // 接收植景管家跳转：带参数时自动执行一次分析
  useEffect(() => {
    if (autoRanRef.current) return;
    const q = questionFromLocation();
    if (q) {
      autoRanRef.current = true;
      void ask(q);
    }
  }, [ask]);

  function stop() {
    abortRef.current?.abort();
    setBusy(false);
  }

  async function copyTurn(t: AssistantTurn, idx: number) {
    const b = t.basis;
    const lines: string[] = [];
    if (b) lines.push(`【${b.metricLabel}】范围：${b.filtersDesc}；命中 ${b.hitCount}${b.timeRangeDesc ? `；${b.timeRangeDesc}` : ""}`);
    if (t.narrative) lines.push(t.narrative);
    if (t.table) {
      lines.push(t.table.columns.join("\t"));
      for (const r of t.table.rows) lines.push(r.join("\t"));
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1600);
    } catch {
      /* 剪贴板不可用时静默 */
    }
  }

  const empty = turns.length === 0;

  return (
    <section className="overflow-hidden rounded-xl border-neo border-primary/25 bg-surface shadow-leaf lg:col-span-5">
      <div className="h-1.5 bg-primary" />
      {/* 标题栏 */}
      <div className="flex items-center justify-between border-b-neo border-outline-variant/20 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-container text-foreground">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h2 className="flex items-center gap-2 text-fs-card font-medium text-on-surface">
              AI 学情分析
            </h2>
            <p className="text-fs-label text-on-surface-variant">提出任意学情问题，AI 基于真实数据为您统计并解读</p>
          </div>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full bg-surface-container px-3 py-1 text-fs-label text-on-surface-variant sm:flex">
          <BarChart3 className="h-3.5 w-3.5" />
          数据实时统计 · 口径与看板一致
        </span>
      </div>

      {/* 对话与结果区（可滚动） */}
      <div ref={scrollRef} className="h-[var(--size-chart-lg)] overflow-y-auto px-6 py-5">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="mb-1 text-fs-card font-medium text-on-surface">想看点什么数据？直接问我</p>
            <p className="mb-5 max-w-measure text-fs-sub text-on-surface-variant">
              我可以统计班级掌握对比、学生排行、练习趋势、植物难度、设计任务提交与各阶段得分等，并给出图表与解读。
            </p>
            <div className="flex max-w-measure flex-wrap justify-center gap-2">
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => void ask(q)}
                  className="rounded-full border-neo border-primary/30 bg-primary-container/30 px-4 py-2 text-fs-sub text-on-surface transition-colors hover:bg-primary-container/60"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {turns.map((turn, idx) =>
              turn.kind === "user" ? (
                <div key={idx} className="flex justify-end">
                  <div className="max-w-measure rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-fs-sub text-on-primary">
                    {turn.text}
                  </div>
                </div>
              ) : (
                <div key={idx} className="flex justify-start">
                  <div className="w-full max-w-3xl rounded-2xl rounded-bl-md border-neo border-outline-variant/25 bg-surface-container/40 px-4 py-3">
                    {turn.status && (
                      <p className="flex items-center gap-2 text-fs-sub text-on-surface-variant">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                        {turn.status}
                      </p>
                    )}
                    {turn.error && <p className="text-fs-sub text-error">{turn.error}</p>}
                    {turn.clarify && <p className="whitespace-pre-wrap text-fs-sub text-on-surface">{turn.clarify}</p>}

                    {turn.basis && (
                      <p className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-fs-label text-on-surface-variant">
                        <span className="rounded-full bg-primary-container/50 px-2 py-0.5 font-medium text-on-primary-container">{turn.basis.metricLabel}</span>
                        <span>依据：{turn.basis.filtersDesc}</span>
                        <span>· 命中 {turn.basis.hitCount}</span>
                        {turn.basis.timeRangeDesc && <span>· {turn.basis.timeRangeDesc}</span>}
                      </p>
                    )}

                    {turn.chart && <AnalyticsChart spec={turn.chart} />}

                    {turn.table && turn.table.rows.length > 0 && (
                      <div className="mt-3 overflow-x-auto rounded-lg border-neo border-outline-variant/20 bg-surface">
                        <table className="w-full text-fs-label">
                          <thead>
                            <tr className="border-b-neo border-outline-variant/20 bg-surface-container/60 text-left text-on-surface-variant">
                              {turn.table.columns.map((c) => (
                                <th key={c} className="px-3 py-2 font-medium">
                                  {c}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-outline-variant/15">
                            {turn.table.rows.slice(0, 20).map((r, ri) => (
                              <tr key={ri}>
                                {r.map((cell, ci) => (
                                  <td key={ci} className="px-3 py-1.5 text-on-surface">
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {turn.table.rows.length > 20 && (
                          <p className="px-3 py-1.5 text-fs-label text-on-surface-variant">仅显示前 20 条，共 {turn.table.rows.length} 条</p>
                        )}
                      </div>
                    )}

                    {turn.narrative && (
                      <p className="mt-3 whitespace-pre-wrap border-t-neo border-outline-variant/20 pt-3 text-fs-sub leading-relaxed text-on-surface">
                        {turn.narrative}
                      </p>
                    )}

                    {turn.done && !turn.error && !turn.clarify && (turn.narrative || turn.table || turn.chart) && (
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={() => void copyTurn(turn, idx)}
                          className="flex items-center gap-1.5 rounded-md border-neo border-outline-variant/30 px-2.5 py-1 text-fs-label text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
                        >
                          {copiedIdx === idx ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedIdx === idx ? "已复制" : "复制结论"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {/* 输入区（固定在对话框下方） */}
      <div className="border-t-neo border-outline-variant/20 bg-surface-container/30 px-6 py-4">
        {!empty && turns.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.slice(0, 3).map((q) => (
              <button
                key={q}
                onClick={() => void ask(q)}
                disabled={busy}
                className="rounded-full border-neo border-outline-variant/30 bg-surface px-3 py-1 text-fs-label text-on-surface-variant transition-colors hover:bg-surface-container disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask(input);
              }
            }}
            placeholder="输入学情问题，如：最近一周谁没有练习？"
            className="h-11 flex-1 rounded-full border-neo border-outline-variant/30 bg-surface px-5 text-fs-sub text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none"
          />
          {micSupported && (
            <button
              onClick={toggleMic}
              aria-label="语音输入"
              className={`flex h-11 w-11 items-center justify-center rounded-full border-neo transition-colors ${
                listening ? "border-error bg-error/10 text-error" : "border-outline-variant/30 bg-surface text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              <Mic className="h-5 w-5" />
            </button>
          )}
          {busy ? (
            <button
              onClick={stop}
              aria-label="停止"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-on-surface-variant text-surface transition-opacity hover:opacity-80"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => void ask(input)}
              disabled={!input.trim()}
              aria-label="发送"
              className="flex h-11 w-11 items-center justify-center rounded-lg border-neo border-ink bg-primary text-on-primary shadow-card transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Send className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
