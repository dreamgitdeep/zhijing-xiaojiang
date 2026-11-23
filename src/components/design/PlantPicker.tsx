"use client";

import { useMemo, useState } from "react";
import { Search, TriangleAlert, X, Plus, Check } from "lucide-react";
import type { PlantPick } from "@/lib/plant-compliance";
import { layerLabel } from "@/lib/types";

interface Props {
  plants: PlantPick[];
  zoneName: string;
  selectedIds: Set<string>;
  onAdd: (p: PlantPick) => void;
  onClose: () => void;
}

const LIGHT_OPTS = [
  { v: "all", label: "光照不限" },
  { v: "sun", label: "喜光" },
  { v: "sun_to_semi", label: "喜光至半阴" },
  { v: "semi", label: "耐半阴" },
];
const WATER_OPTS = [
  { v: "all", label: "水分不限" },
  { v: "dry", label: "耐旱" },
  { v: "medium", label: "中等" },
  { v: "moist", label: "喜湿" },
  { v: "wet", label: "湿生/水生" },
];

function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border-neo border-outline-variant/60 bg-surface px-2.5 py-1.5 text-fs-label text-on-surface focus:outline-none focus:ring-2 focus:ring-ink"
    >
      {options.map((o) => (
        <option key={o.v} value={o.v}>{o.label}</option>
      ))}
    </select>
  );
}

export function PlantPicker({ plants, zoneName, selectedIds, onAdd, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [light, setLight] = useState("all");
  const [water, setWater] = useState("all");
  const [edible, setEdible] = useState<"all" | "edible">("all");
  const [safety, setSafety] = useState<"all" | "safe" | "warning">("all");

  const categories = useMemo(() => Array.from(new Set(plants.map((p) => p.category))).sort(), [plants]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return plants.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (light !== "all" && p.lightNeed !== light) return false;
      if (water !== "all" && p.waterNeed !== water) return false;
      if (edible === "edible" && !p.edible) return false;
      if (safety === "safe" && p.isWarning) return false;
      if (safety === "warning" && !p.isWarning) return false;
      if (q) {
        const hay = [p.name, p.latin, ...p.alias, ...p.functionTags].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [plants, search, category, light, water, edible, safety]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex h-[var(--size-modal-vh)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-surface shadow-float">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b-neo border-outline-variant/50 px-5 py-3.5">
          <div>
            <p className="text-fs-card font-medium text-on-surface">选择植物</p>
            <p className="text-fs-label text-on-surface-variant">为「{zoneName}」从植物图鉴中挑选，点「加入」即选入</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container" aria-label="关闭">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 搜索 + 筛选 */}
        <div className="space-y-2.5 border-b-neo border-outline-variant/50 px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索植物名 / 别名 / 拉丁名…"
              className="w-full rounded-lg border-neo border-outline-variant/60 bg-surface-container/60 py-2 pl-9 pr-3 text-fs-body text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-ink"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Sel value={category} onChange={setCategory} options={[{ v: "all", label: "全部分类" }, ...categories.map((c) => ({ v: c, label: c }))]} />
            <Sel value={light} onChange={setLight} options={LIGHT_OPTS} />
            <Sel value={water} onChange={setWater} options={WATER_OPTS} />
            <Sel value={safety} onChange={(v) => setSafety(v as any)} options={[{ v: "all", label: "安全性不限" }, { v: "safe", label: "无警示" }, { v: "warning", label: "有警示" }]} />
            <button
              type="button"
              onClick={() => setEdible((e) => (e === "edible" ? "all" : "edible"))}
              className={`rounded-full px-3 py-1.5 text-fs-label font-medium transition-colors ${edible === "edible" ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"}`}
            >
              可食用
            </button>
            <span className="ml-auto text-fs-label text-on-surface-variant">{filtered.length} 种</span>
          </div>
        </div>

        {/* 卡片网格 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-fs-sub text-on-surface-variant">没有符合条件的植物，换个筛选试试。</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((p) => {
                const added = selectedIds.has(p.id);
                return (
                  <div key={p.id} className="flex flex-col overflow-hidden rounded-xl border-neo border-outline-variant/40 bg-surface shadow-card">
                    <div className="relative h-28">
                      {p.thumb ? (
                        <img src={p.thumb} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-primary-container/60 text-fs-title font-medium text-on-primary-container">{p.name.slice(0, 1)}</div>
                      )}
                      {p.isWarning && (
                        <span className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-error px-1.5 py-0.5 text-fs-label font-medium text-white">
                          <TriangleAlert className="h-3 w-3" />{p.restriction === "forbid" ? "禁植" : "警示"}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-3">
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="truncate text-fs-body font-medium text-on-surface">{p.name}</span>
                        <span className="text-fs-label text-on-surface-variant">{layerLabel(p.layer)}</span>
                      </div>
                      <p className="mt-0.5 truncate font-latin text-fs-label italic text-on-surface-variant/80">{p.latin}</p>
                      <div className="mt-auto pt-2">
                        <button
                          type="button"
                          disabled={added}
                          onClick={() => onAdd(p)}
                          className={`flex w-full items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-fs-label font-medium transition-colors ${
                            added ? "bg-primary-container/60 text-on-primary-container" : "bg-primary text-on-primary hover:bg-primary/90"
                          }`}
                        >
                          {added ? (<><Check className="h-3.5 w-3.5" />已加入</>) : (<><Plus className="h-3.5 w-3.5" />加入</>)}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
