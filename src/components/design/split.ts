import type { MouseEvent as ReactMouseEvent } from "react";

export function startSplitDrag(
  e: ReactMouseEvent,
  opts: { start: number; min: number; max: number; total: number; onMove: (pct: number) => void },
) {
  e.preventDefault();
  const startX = e.clientX;
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";
  const move = (ev: MouseEvent) =>
    opts.onMove(Math.min(opts.max, Math.max(opts.min, opts.start + ((ev.clientX - startX) / opts.total) * 100)));
  const up = () => {
    window.removeEventListener("mousemove", move);
    window.removeEventListener("mouseup", up);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };
  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);
}
