"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Box, ChevronLeft, ChevronRight, Video, X } from "lucide-react";
import { ModelViewer } from "./ModelViewer";

export interface CaseMediaData {
  type: "image" | "video" | "model";
  url: string;
  poster?: string;
}

// 兼容旧单对象与新数组，统一归一为数组
export function normalizeMediaList(media: CaseMediaData | CaseMediaData[] | null | undefined): CaseMediaData[] {
  if (!media) return [];
  if (Array.isArray(media)) return media.filter((m) => m && m.url);
  return media.url ? [media] : [];
}

// 列表/侧栏用的静态缩略图：取第一个资源，图片用自身，视频/3D 用封面帧，缺省回落 cover
export function mediaThumb(media: CaseMediaData | CaseMediaData[] | null | undefined, cover?: string | null): string | undefined {
  const first = normalizeMediaList(media)[0];
  if (!first) return cover ?? undefined;
  if (first.type === "image") return first.url;
  return first.poster ?? cover ?? undefined;
}

export function CaseMediaView({
  media,
  fallback,
  alt,
  className,
}: {
  media?: CaseMediaData | null;
  fallback?: ReactNode;
  alt?: string;
  className?: string;
}) {
  if (!media?.url) return <>{fallback ?? null}</>;
  if (media.type === "video") {
    return <video src={media.url} poster={media.poster} controls preload="metadata" playsInline className={className ?? "h-full w-full object-cover"} />;
  }
  if (media.type === "model") {
    return <ModelViewer src={media.url} poster={media.poster} alt={alt} className={className ?? "h-full w-full"} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={media.url} alt={alt ?? ""} className={className ?? "h-full w-full object-cover"} />
  );
}

function ThumbInner({ m }: { m: CaseMediaData }) {
  if (m.type === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={m.url} alt="" className="h-full w-full object-cover" />
    );
  }
  if (m.poster) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={m.poster} alt="" className="h-full w-full object-cover" />
    );
  }
  return (
    <span className="flex h-full w-full items-center justify-center bg-surface-container-high text-on-surface-variant">
      {m.type === "video" ? <Video className="h-4 w-4" /> : <Box className="h-4 w-4" />}
    </span>
  );
}

// 资源展示画廊：主视图 + 缩略图条 + 图片点击放大灯箱
// variant: hero=卡顶横幅（定高）/ panel=工作台侧栏（矮定高）/ fill=撑满父级定高面板（桌面主视图 flex-1、缩略图沉底）
export function CaseMediaGallery({
  media,
  fallback,
  alt,
  variant = "hero",
}: {
  media?: CaseMediaData | CaseMediaData[] | null;
  fallback?: ReactNode;
  alt?: string;
  variant?: "hero" | "panel" | "fill";
}) {
  const items = normalizeMediaList(media);
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const idx = items.length ? Math.min(active, items.length - 1) : 0;
  const cur = items[idx];

  const step = useCallback(
    (d: number) => {
      setActive((a) => (items.length ? (a + d + items.length) % items.length : 0));
    },
    [items.length]
  );

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, step]);

  if (items.length === 0) return <>{fallback ?? null}</>;

  const hero = variant === "hero";
  const fill = variant === "fill";
  const mainH = fill ? "h-64 md:h-80 lg:h-auto lg:min-h-0 lg:flex-1" : hero ? "h-64 md:h-80" : "h-40";

  return (
    <div className={fill ? "lg:flex lg:h-full lg:flex-col" : ""}>
      {/* 主视图 */}
      <div className={`relative ${mainH} w-full overflow-hidden bg-surface-container ${hero || fill ? "" : "rounded-xl"}`}>
        {cur.type === "image" ? (
          <button type="button" onClick={() => setLightbox(true)} className="block h-full w-full cursor-zoom-in" title="点击放大">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cur.url} alt={alt ?? ""} className="h-full w-full object-cover" />
          </button>
        ) : (
          <CaseMediaView media={cur} alt={alt} className="h-full w-full object-cover" />
        )}
        {items.length > 1 && (
          <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/50 px-2.5 py-0.5 text-fs-label text-white">
            {idx + 1} / {items.length}
          </span>
        )}
      </div>

      {/* 缩略图条 */}
      {items.length > 1 && (
        <div className={`flex gap-1.5 overflow-x-auto ${fill ? "shrink-0 px-3 pb-3 pt-2" : "px-0.5 pt-2"}`}>
          {items.map((m, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              title={m.type === "image" ? "图片" : m.type === "video" ? "视频" : "3D 模型"}
              className={`relative h-12 w-16 shrink-0 overflow-hidden rounded-md border-neo transition ${
                i === idx ? "border-ink ring-2 ring-ink/30" : "border-outline-variant/30 opacity-70 hover:opacity-100"
              }`}
            >
              <ThumbInner m={m} />
            </button>
          ))}
        </div>
      )}

      {/* 灯箱（全屏放大） */}
      {lightbox && (
        <div className="fixed inset-0 z-[70] bg-black/85" onClick={() => setLightbox(false)}>
          <div className="relative flex h-full w-full items-center justify-center p-4 md:p-12" onClick={(e) => e.stopPropagation()}>
            {cur.type === "image" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cur.url} alt={alt ?? ""} className="max-h-[var(--size-modal-vh)] max-w-full rounded-lg object-contain shadow-float" />
            )}
            {cur.type === "video" && <video src={cur.url} poster={cur.poster} controls autoPlay playsInline className="max-h-[var(--size-modal-vh)] max-w-full rounded-lg" />}
            {cur.type === "model" && (
              <div className="h-[var(--size-modal-vh-md)] w-full max-w-3xl">
                <ModelViewer src={cur.url} poster={cur.poster} alt={alt} className="h-full w-full" />
              </div>
            )}

            <button
              type="button"
              onClick={() => setLightbox(false)}
              className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white transition hover:bg-white/30"
              title="关闭"
            >
              <X className="h-5 w-5" />
            </button>
            {items.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-2 text-white transition hover:bg-white/30 md:left-6"
                  title="上一个"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-2 text-white transition hover:bg-white/30 md:right-6"
                  title="下一个"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
                <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-fs-label text-white">
                  {idx + 1} / {items.length}
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
