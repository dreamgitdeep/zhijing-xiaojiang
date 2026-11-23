"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight, BookOpen, ChevronDown, Lightbulb, RotateCcw } from "lucide-react";

interface Props {
  review: {
    score: number;
    passed: boolean;
    passScore: number;
    feedback: string;
    cards?: { title: string; body: string; ref?: string }[];
    issues?: string[];
    keyPoints?: string[];
    attemptNo?: number;
    bestScore?: number | null;
  };
  onRetry?: () => void;
  onNext?: () => void;
  nextLabel?: string;
}

export function ReviewCard({ review, onRetry, onNext, nextLabel }: Props) {
  const [cardsOpen, setCardsOpen] = useState(false);
  const cards = review.cards ?? [];
  const issues = review.issues ?? [];
  const keyPoints = review.keyPoints ?? [];

  return (
    <div className="rounded-2xl bg-blossom-container/50 p-6 shadow-card">
      <div className="flex items-center gap-4">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-fs-card font-black ${
            review.passed ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
          }`}
        >
          {review.score}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-fs-sub font-medium text-on-surface">
            {review.passed ? `评阅通过（≥${review.passScore}）` : `未达通过线（${review.passScore}）`}
            {review.attemptNo ? <span className="ml-2 text-fs-label font-normal text-on-surface-variant">第 {review.attemptNo} 次提交</span> : null}
          </p>
          <p className="mt-0.5 text-fs-label text-on-surface-variant">
            本次 {review.score} 分
            {review.bestScore != null && ` · 历史最佳 ${Math.max(review.bestScore, review.score)} 分`}
          </p>
          <p className="mt-1 whitespace-pre-line text-fs-sub text-on-surface-variant">{review.feedback}</p>
        </div>
      </div>

      {issues.length > 0 && (
        <div className="mt-4 rounded-xl bg-warning/10 p-4">
          <p className="flex items-center gap-1.5 text-fs-label font-medium text-warning">
            <AlertTriangle className="h-4 w-4" /> 问题清单（你哪里需要改）
          </p>
          <ul className="mt-2 space-y-1.5">
            {issues.map((s, i) => (
              <li key={i} className="flex gap-1.5 text-fs-label leading-relaxed text-on-surface-variant">
                <span className="shrink-0 text-warning">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {keyPoints.length > 0 && (
        <div className="mt-3 rounded-xl bg-primary-container/40 p-4">
          <p className="flex items-center gap-1.5 text-fs-label font-medium text-on-primary-container">
            <Lightbulb className="h-4 w-4" /> 参考要点（正确方向）
          </p>
          <ul className="mt-2 space-y-1.5">
            {keyPoints.map((s, i) => (
              <li key={i} className="flex gap-1.5 text-fs-label leading-relaxed text-on-surface-variant">
                <span className="shrink-0 text-foreground">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {cards.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setCardsOpen((o) => !o)}
            className="flex items-center gap-1.5 text-fs-label font-medium text-foreground"
          >
            <BookOpen className="h-3.5 w-3.5" />
            知识卡片（{cards.length}）
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${cardsOpen ? "rotate-180" : ""}`} />
          </button>
          {cardsOpen && (
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {cards.map((c, i) => (
                <div key={i} className="rounded-xl bg-primary-container/40 p-3">
                  <p className="text-fs-label font-medium text-on-primary-container">{c.title}</p>
                  <p className="mt-1 text-fs-label leading-relaxed text-on-surface-variant">{c.body}</p>
                  {c.ref && <p className="mt-1 text-fs-label text-on-surface-variant/60">参考：{c.ref}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-1.5 rounded-xl border-neo border-outline-variant/30 px-4 py-2 text-fs-label font-medium text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            <RotateCcw className="h-3.5 w-3.5" /> 重新提交
          </button>
        )}
        {review.passed && onNext && (
          <button
            type="button"
            onClick={onNext}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-fs-label font-medium text-on-primary"
          >
            {nextLabel ?? "下一阶段"} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
