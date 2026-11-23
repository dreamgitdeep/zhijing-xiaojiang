"use client";

import { useEffect, useRef, useState } from "react";

// 浏览器语音输入（Web Speech API，zh-CN）。onResult 在每次识别更新时收到当前完整转写文本。
export function useVoiceInput(onResult: (transcript: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<{ stop: () => void } | null>(null);
  const cbRef = useRef(onResult);
  cbRef.current = onResult;

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  function toggle() {
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
      cbRef.current(t);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  return { supported, listening, toggle };
}
