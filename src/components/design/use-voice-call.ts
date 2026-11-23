"use client";

import { useEffect, useRef, useState } from "react";
import { stripMd } from "@/components/chat/use-chat";

export type CallPhase = "idle" | "connecting" | "listening" | "thinking" | "speaking";

const SILENCE_END_MS = 900;
const VAD_FRAME_MS = 100;
const MIN_SPEECH_MS = 300;
const MAX_UTTERANCE_MS = 30_000;
const AMBIENT_FRAMES = 6;
export const MAX_CALL_SECONDS = 900;

type QueueItem = { text: string; promise?: Promise<string | null>; url?: string };

const FILLER_TEXT = "嗯，我想一想。";

export function useVoiceCall(
  onUtterance: (text: string) => void,
  opts?: { onAutoEnd?: () => void }
) {
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [speakingText, setSpeakingText] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [vadActive, setVadActive] = useState(false);
  const [supported, setSupported] = useState(false);

  const phaseRef = useRef<CallPhase>("idle");
  const mutedRef = useRef(false);
  const onUtteranceRef = useRef(onUtterance);
  onUtteranceRef.current = onUtterance;
  const onAutoEndRef = useRef(opts?.onAutoEnd);
  onAutoEndRef.current = opts?.onAutoEnd;

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef(0);

  const queueRef = useRef<QueueItem[]>([]);
  const streamEndedRef = useRef(true);
  const pumpingRef = useRef(false);
  const playingRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const vadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fillerUrlRef = useRef<string | null>(null);
  const vadStateRef = useRef({
    speaking: false,
    speechStartAt: 0,
    lastVoiceAt: 0,
    threshold: 0,
    ambient: [] as number[],
  });

  useEffect(() => {
    setSupported(
      typeof navigator !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof window !== "undefined" &&
        "MediaRecorder" in window
    );
  }, []);

  useEffect(
    () => () => {
      teardown();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  function transition(next: CallPhase) {
    phaseRef.current = next;
    setPhase(next);
    if (
      next === "thinking" &&
      fillerUrlRef.current &&
      !playingRef.current &&
      queueRef.current.length === 0
    ) {
      queueRef.current.push({ text: FILLER_TEXT, url: fillerUrlRef.current });
      void pump();
    }
  }

  function curPhase(): CallPhase {
    return phaseRef.current;
  }

  function startTimer() {
    if (tickRef.current) clearInterval(tickRef.current);
    secondsRef.current = 0;
    tickRef.current = setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
      if (secondsRef.current >= MAX_CALL_SECONDS) {
        hangup();
        onAutoEndRef.current?.();
      }
    }, 1000);
  }

  function stopTimer() {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }

  /* ---------------- TTS：云端合成 + 预取 + 顺序播放 ---------------- */

  async function fetchTts(text: string, signal: AbortSignal): Promise<string | null> {
    try {
      const res = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal,
      });
      if (!res.ok) return null;
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  }

  function ensureFetch(item: QueueItem) {
    if (!item.promise && !item.url && abortRef.current) {
      item.promise = fetchTts(item.text, abortRef.current.signal);
    }
  }

  function primeFiller() {
    if (fillerUrlRef.current || !abortRef.current) return;
    void fetchTts(FILLER_TEXT, abortRef.current.signal).then((url) => {
      if (url && phaseRef.current !== "idle") fillerUrlRef.current = url;
      else if (url) URL.revokeObjectURL(url);
    });
  }

  async function pump() {
    if (pumpingRef.current || playingRef.current) return;
    const item = queueRef.current[0];
    if (!item) {
      setSpeakingText("");
      if (
        streamEndedRef.current &&
        (phaseRef.current === "speaking" || phaseRef.current === "thinking")
      ) {
        resumeListening();
      }
      return;
    }
    pumpingRef.current = true;
    try {
      if (!item.url) ensureFetch(item);
      const next = queueRef.current[1];
      if (next && !next.url) ensureFetch(next);
      const url = item.url ?? (await item.promise);
      if (phaseRef.current === "idle") return;
      queueRef.current.shift();
      setSpeakingText(stripMd(item.text));
      if (!url) {
        return pump();
      }
      const audio = new Audio(url);
      playingRef.current = audio;
      const done = () => {
        playingRef.current = null;
        if (url !== fillerUrlRef.current) URL.revokeObjectURL(url);
        if (phaseRef.current !== "idle") void pump();
      };
      audio.onended = done;
      audio.onerror = done;
      audio.play().catch(done);
    } finally {
      pumpingRef.current = false;
    }
  }

  function speakSentence(text: string) {
    const t = text.trim();
    if (!t || phaseRef.current === "idle") return;
    if (phaseRef.current !== "speaking") transition("speaking");
    const item: QueueItem = { text: t };
    queueRef.current.push(item);
    ensureFetch(item);
    void pump();
  }

  function markStreamEnd() {
    streamEndedRef.current = true;
    void pump();
  }

  /* ---------------- ASR：录音 + 能量 VAD + 云端识别 ---------------- */

  async function ensureMic() {
    if (micStreamRef.current) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micStreamRef.current = stream;
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser);
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;
  }

  function releaseMic() {
    stopRecorder(true);
    if (vadTimerRef.current) {
      clearInterval(vadTimerRef.current);
      vadTimerRef.current = null;
    }
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    analyserRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setVadActive(false);
  }

  function startListening() {
    if (phaseRef.current !== "listening" || mutedRef.current) return;
    if (recorderRef.current || !micStreamRef.current || !analyserRef.current) return;
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "";
    const rec = new MediaRecorder(
      micStreamRef.current,
      mime ? { mimeType: mime } : undefined
    );
    chunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      void handleRecorded();
    };
    rec.start(250);
    recorderRef.current = rec;
    vadStateRef.current = {
      speaking: false,
      speechStartAt: 0,
      lastVoiceAt: 0,
      threshold: 0,
      ambient: [],
    };
    vadTimerRef.current = setInterval(vadTick, VAD_FRAME_MS);
  }

  function stopRecorder(discard: boolean) {
    const rec = recorderRef.current;
    recorderRef.current = null;
    if (vadTimerRef.current) {
      clearInterval(vadTimerRef.current);
      vadTimerRef.current = null;
    }
    setVadActive(false);
    if (rec && rec.state !== "inactive") {
      if (discard) rec.onstop = null;
      rec.stop();
    }
  }

  function vadTick() {
    const analyser = analyserRef.current;
    if (!analyser || !recorderRef.current) return;
    const data = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i += 1) sum += data[i] * data[i];
    const rms = Math.sqrt(sum / data.length);
    const st = vadStateRef.current;
    const now = Date.now();
    if (st.ambient.length < AMBIENT_FRAMES) {
      st.ambient.push(rms);
      return;
    }
    if (!st.threshold) {
      const floor = Math.max(...st.ambient);
      st.threshold = Math.max(floor * 2.2, 0.012);
    }
    if (!st.speaking) {
      if (rms > st.threshold) {
        st.speaking = true;
        st.speechStartAt = now;
        st.lastVoiceAt = now;
        setVadActive(true);
      }
      return;
    }
    if (rms > st.threshold) {
      st.lastVoiceAt = now;
      return;
    }
    if (now - st.lastVoiceAt > SILENCE_END_MS) {
      if (now - st.speechStartAt >= MIN_SPEECH_MS) {
        stopRecorder(false);
      } else {
        st.speaking = false;
        setVadActive(false);
      }
      return;
    }
    if (now - st.speechStartAt > MAX_UTTERANCE_MS) {
      stopRecorder(false);
    }
  }

  async function handleRecorded() {
    const blob = new Blob(chunksRef.current, {
      type: recorderRef.current?.mimeType || "audio/webm",
    });
    chunksRef.current = [];
    if (curPhase() === "idle") return;
    if (blob.size < 4000) {
      startListening();
      return;
    }
    try {
      const wavBase64 = await blobToWavBase64(blob);
      const res = await fetch("/api/voice/asr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: wavBase64 }),
      });
      const data = await res.json().catch(() => null);
      const text =
        res.ok && data && typeof data.text === "string" ? data.text.trim() : "";
      if (curPhase() === "idle") return;
      if (text) {
        transition("thinking");
        onUtteranceRef.current(text);
      } else {
        startListening();
      }
    } catch {
      if (curPhase() !== "idle") startListening();
    }
  }

  async function blobToWavBase64(blob: Blob): Promise<string> {
    const arr = await blob.arrayBuffer();
    const ctx = audioCtxRef.current ?? new AudioContext();
    const decoded = await ctx.decodeAudioData(arr);
    const targetRate = 16000;
    const ch0 = decoded.getChannelData(0);
    const ch1 = decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : null;
    const ratio = decoded.sampleRate / targetRate;
    const outLen = Math.max(1, Math.floor(decoded.duration * targetRate));
    const pcm = new Int16Array(outLen);
    for (let i = 0; i < outLen; i += 1) {
      const pos = i * ratio;
      const i0 = Math.floor(pos);
      const i1 = Math.min(i0 + 1, ch0.length - 1);
      const frac = pos - i0;
      const a = ch1 ? (ch0[i0] + ch1[i0]) / 2 : ch0[i0];
      const b = ch1 ? (ch0[i1] + ch1[i1]) / 2 : ch0[i1];
      const sample = Math.max(-1, Math.min(1, a + (b - a) * frac));
      pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    const bytes = new Uint8Array(44 + pcm.length * 2);
    const view = new DataView(bytes.buffer);
    const writeStr = (off: number, s: string) => {
      for (let i = 0; i < s.length; i += 1) view.setUint8(off + i, s.charCodeAt(i));
    };
    writeStr(0, "RIFF");
    view.setUint32(4, 36 + pcm.length * 2, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, targetRate, true);
    view.setUint32(28, targetRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, "data");
    view.setUint32(40, pcm.length * 2, true);
    for (let i = 0; i < pcm.length; i += 1) view.setInt16(44 + i * 2, pcm[i], true);
    let bin = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }

  function resumeListening() {
    if (phaseRef.current === "idle") return;
    streamEndedRef.current = false;
    setSpeakingText("");
    transition("listening");
    startListening();
  }

  /* ---------------- 通话控制 ---------------- */

  async function answer(greeting: string): Promise<boolean> {
    if (phaseRef.current !== "idle") return false;
    abortRef.current = new AbortController();
    setSeconds(0);
    setMuted(false);
    mutedRef.current = false;
    primeFiller();
    transition("connecting");
    try {
      await ensureMic();
    } catch {
      transition("idle");
      return false;
    }
    audioCtxRef.current?.resume().catch(() => {});
    startTimer();
    streamEndedRef.current = true;
    if (greeting) {
      transition("speaking");
      const item: QueueItem = { text: greeting };
      queueRef.current.push(item);
      ensureFetch(item);
      void pump();
    } else {
      resumeListening();
    }
    return true;
  }

  function hangup() {
    transition("idle");
    stopTimer();
    stopRecorder(true);
    releaseMic();
    queueRef.current = [];
    const audio = playingRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      playingRef.current = null;
    }
    abortRef.current?.abort();
    abortRef.current = null;
    if (fillerUrlRef.current) {
      URL.revokeObjectURL(fillerUrlRef.current);
      fillerUrlRef.current = null;
    }
    streamEndedRef.current = true;
    setSpeakingText("");
    setSeconds(0);
  }

  function teardown() {
    if (phaseRef.current !== "idle") hangup();
    stopTimer();
  }

  function toggleMute() {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    if (phaseRef.current !== "listening") return;
    if (next) {
      stopRecorder(true);
    } else {
      startListening();
    }
  }

  return {
    supported,
    phase,
    speakingText,
    seconds,
    muted,
    vadActive,
    answer,
    hangup,
    speakSentence,
    markStreamEnd,
    toggleMute,
  };
}
