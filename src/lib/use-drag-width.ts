"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

/** 拖动分隔条调整宽度；可选 localStorage 持久化。direction=1 表示向右拖变宽，-1 相反。 */
export function useDragWidth(initial: number, min: number, max: number, storageKey?: string) {
  const [width, setWidth] = useState(initial);
  const widthRef = useRef(initial);
  widthRef.current = width;

  useEffect(() => {
    if (!storageKey) return;
    try {
      const v = Number(localStorage.getItem(storageKey));
      if (Number.isFinite(v) && v >= min && v <= max) setWidth(v);
    } catch {
      /* ignore */
    }
  }, [storageKey, min, max]);

  const startDrag = useCallback(
    (e: ReactPointerEvent, direction: 1 | -1 = 1) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = widthRef.current;
      const onMove = (ev: PointerEvent) => {
        setWidth(Math.min(max, Math.max(min, startW + (ev.clientX - startX) * direction)));
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        try {
          if (storageKey) localStorage.setItem(storageKey, String(widthRef.current));
        } catch {
          /* ignore */
        }
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [min, max, storageKey]
  );

  return [width, startDrag] as const;
}
