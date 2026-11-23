"use client";

import { createElement, useEffect, useRef } from "react";

// 动态注册 <model-viewer> 自定义元素（@google/model-viewer），避免进首屏 bundle
export function ModelViewer({ src, poster, alt, className }: { src: string; poster?: string; alt?: string; className?: string }) {
  const bootRef = useRef(false);
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    void import("@google/model-viewer").catch(() => {});
  }, []);

  return createElement("model-viewer", {
    src,
    poster: poster || undefined,
    alt: alt ?? "3D 模型",
    className,
    "camera-controls": "",
    "auto-rotate": "",
    "interaction-prompt": "none",
    "shadow-intensity": "0.6",
    loading: "lazy",
    style: { width: "100%", height: "100%", backgroundColor: "transparent" },
  });
}
