"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

// 案例介绍：打字机逐字呈现 + 默认自动语音播报（醒目喇叭可关闭）
export function CaseIntro({ text }: { text: string }) {
  const content = (text ?? "").trim();
  const [shown, setShown] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);
  const startedRef = useRef(false);

  // 打字机（尊重系统"减少动态效果"：直接全量呈现）
  useEffect(() => {
    if (!content) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(content.length);
      return;
    }
    setShown(0);
    const total = content.length;
    const step = Math.max(24, Math.min(60, Math.round(11000 / total)));
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setShown(i);
      if (i >= total) clearInterval(timer);
    }, step);
    return () => clearInterval(timer);
  }, [content]);

  function stopSpeak() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  function startSpeak() {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !content) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(content);
    u.lang = "zh-CN";
    u.rate = 1;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }

  // 挂载后默认自动播报；离开页面即停
  useEffect(() => {
    const hasTts = typeof window !== "undefined" && "speechSynthesis" in window;
    setSupported(hasTts);
    if (hasTts && content && !startedRef.current) {
      startedRef.current = true;
      startSpeak();
    }
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
      setSpeaking(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleMute() {
    if (muted) {
      setMuted(false);
      startSpeak();
    } else {
      setMuted(true);
      stopSpeak();
    }
  }

  if (!content) return null;
  const done = shown >= content.length;
  const label = muted ? "语音已关闭" : speaking ? "播报中" : "点击播报";

  return (
    <div className="mt-4">
      {supported && (
        <div className="mb-3 flex items-center gap-2.5">
          <button
            type="button"
            onClick={toggleMute}
            aria-pressed={!muted}
            className={
              muted
                ? "inline-flex items-center gap-2 rounded-full border-neo border-outline-variant/40 bg-surface-container px-4 py-2 text-fs-sub font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high"
                : "inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-fs-sub font-medium text-on-primary shadow-card transition-all hover:-translate-y-0.5 hover:shadow-float"
            }
          >
            {muted ? <VolumeX className="h-4.5 w-4.5" /> : <Volume2 className={`h-4.5 w-4.5${speaking ? " animate-pulse" : ""}`} />}
            {label}
          </button>
          {!muted && !speaking && (
            <span className="text-fs-label text-on-surface-variant">若未自动播放，点一下喇叭即可</span>
          )}
          {!muted && speaking && (
            <span className="text-fs-label text-on-surface-variant">正在为你朗读案例介绍…</span>
          )}
        </div>
      )}
      <p className="whitespace-pre-line text-fs-body text-on-surface">
        {content.slice(0, shown)}
        {!done && <span className="ml-0.5 inline-block h-4 w-[var(--size-accent-bar)] animate-pulse rounded-sm bg-primary align-[-2px]" />}
      </p>
    </div>
  );
}
