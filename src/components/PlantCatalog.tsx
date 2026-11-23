"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { ChevronDown, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { PlantCard } from "@/components/PlantCard";
import { CatalogChatColumn } from "@/components/catalog/CatalogChatColumn";
import type { PlantName } from "@/components/chat/use-chat";
import { layerLabel } from "@/lib/types";
import type { LayerKey, PlantLite, SafetyFilter } from "@/lib/types";
import { LIGHT_NEED, WATER_NEED, SOIL_PH } from "@/lib/plant-enums";
import { useDragWidth } from "@/lib/use-drag-width";
import { LIGHT_LABEL, WATER_LABEL, PH_LABEL, DRAIN_LABEL, LAYER_LABEL } from "@/lib/ai-search-labels";
import type { AiExtra } from "@/lib/ai-search-labels";
import type { AiSearchResult } from "@/components/catalog/AiSearchPanel";

const AiSearchPanel = dynamic(
  () => import("@/components/catalog/AiSearchPanel").then(m => m.AiSearchPanel),
  { ssr: false, loading: () => <div className="h-[var(--size-catalog-ai)] rounded-xl bg-primary-container/50" /> },
);

// 详情弹层按需加载：radix Dialog 等依赖不进首屏 JS
const PlantDetailModal = dynamic(
  () => import("@/components/PlantDetailModal").then(m => m.PlantDetailModal),
  { ssr: false },
);

type SingleVal = string | "all";
const PAGE_SIZE = 12;

interface FilterState {
  search: string;
  category: SingleVal;
  layer: SingleVal;
  tags: string[];
  light: SingleVal;
  water: SingleVal;
  soilPh: SingleVal;
  safety: SafetyFilter | "safe";
  mastery: "all" | "mastered" | "unmastered";
  extra: AiExtra;
}

function lightOk(need: string | undefined, v: string) {
  return need === v || (need === "sun_to_semi" && (v === "sun" || v === "semi"));
}
function phOk(ph: string | undefined, v: string) {
  return ph === "any" || ph === v || (ph === "acid_to_neutral" && (v === "acid" || v === "neutral"));
}

function runFilter(plants: PlantLite[], s: FilterState, masteredSet: Set<string>, hasMastery: boolean) {
  const q = s.search.trim().toLowerCase();
  return plants.filter(p => {
    if (s.category !== "all" && p.category !== s.category) return false;
    if (s.layer !== "all" && p.layer !== s.layer as LayerKey) return false;
    if (s.tags.length && !s.tags.some(t => p.tagGroups.includes(t))) return false;
    if (s.light !== "all" && !lightOk(p.light, s.light)) return false;
    if (s.water !== "all" && p.water !== s.water) return false;
    if (s.soilPh !== "all" && !phOk(p.soilPh, s.soilPh)) return false;
    if (s.safety === "warning" && !p.isWarning) return false;
    if (s.safety === "safe" && p.isWarning) return false;
    if (s.safety === "safeForChildren" && !p.safeForChildren) return false;
    if (s.safety === "forbid" && p.restriction !== "forbid") return false;
    if (hasMastery && s.mastery === "mastered" && !masteredSet.has(p.id)) return false;
    if (hasMastery && s.mastery === "unmastered" && masteredSet.has(p.id)) return false;
    if (s.extra.functionTags.length && !s.extra.functionTags.some(t => p.functionTags.includes(t))) return false;
    if (s.extra.regionTags.length && !s.extra.regionTags.some(t => p.regionTags.includes(t))) return false;
    if (s.extra.soilDrainage === "well" && !(p.soilDrainage === "well" || p.soilDrainage === "any")) return false;
    if (q) {
      const hay = [p.name, p.latin, ...p.alias, ...p.functionTags].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-fs-label font-medium transition-colors ${active ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"}`}>
      {children}
    </button>
  );
}

function NavItem({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex w-full items-center justify-between rounded-md px-3 py-1.5 text-fs-label transition-colors ${active ? "bg-primary-container/70 font-medium text-foreground" : "text-on-surface-variant hover:bg-surface-container"}`}>
      {active && <span className="absolute left-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-full bg-primary" aria-hidden />}
      <span>{label}</span>
      <span className="text-fs-label text-on-surface-variant/70">{count}</span>
    </button>
  );
}

function Group({ id, label, open, onToggle, children }: { id: string; label: string; open: boolean; onToggle: (id: string) => void; children: React.ReactNode }) {
  return (
    <div className="border-b-neo border-outline-variant/60 py-2 last:border-b-0">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between px-1 py-1 text-fs-label font-medium text-on-surface">
        {label}
        <ChevronDown className={`h-3.5 w-3.5 text-on-surface-variant transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && <div className="mt-1.5 space-y-2 px-1">{children}</div>}
    </div>
  );
}

export function PlantCatalog(
  {
    plants,
    filters,
    masteredIds,
    loggedIn
  }: {
    plants: PlantLite[];
    filters: { categories: string[]; layers: { key: LayerKey; label: string }[] };
    masteredIds?: string[];
    loggedIn?: boolean;
  }
) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<SingleVal>("all");
  const [layer, setLayer] = useState<SingleVal>("all");
  const [tags, setTags] = useState<string[]>([]);
  const [light, setLight] = useState<SingleVal>("all");
  const [water, setWater] = useState<SingleVal>("all");
  const [soilPh, setSoilPh] = useState<SingleVal>("all");
  const [safety, setSafety] = useState<SafetyFilter | "safe">("all");
  const [mastery, setMastery] = useState<"all" | "mastered" | "unmastered">("all");
  const [sort, setSort] = useState<"default" | "name" | "unmastered">("default");
  const [extra, setExtra] = useState<AiExtra>({ functionTags: [], regionTags: [] });
  const [aiBanner, setAiBanner] = useState<{ desc: string[]; unrecognized: number } | null>(null);
  const [selected, setSelected] = useState<PlantLite | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [panelOpen, setPanelOpen] = useState(false);
  const [groups, setGroups] = useState<Record<string, boolean>>({ cat: true, habit: true, safety: true });
  // 连通大面板的分栏宽度（筛选 / AI 讲解），拖动可调、持久化
  const [filterW, startFilterDrag] = useDragWidth(280, 220, 420, "zjxj:catalog:filter-w");
  const [aiW, startAiDrag] = useDragWidth(340, 280, 480, "zjxj:catalog:ai-w");
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const masteredSet = useMemo(() => new Set(masteredIds ?? []), [masteredIds]);
  const hasMastery = masteredIds !== undefined;

  // 图鉴内嵌问答窄栏：点卡片「AI 讲解」带入该植物上下文（每株植物新开会话）
  const [explainPlant, setExplainPlant] = useState<PlantName | null>(null);
  const chatPlants = useMemo<PlantName[]>(
    () => plants.map(p => ({ id: p.id, name: p.name, latin: p.latin })),
    [plants]
  );

  const state: FilterState = { search, category, layer, tags, light, water, soilPh, safety, mastery, extra };

  const filtered = useMemo(() => {
    let list = runFilter(plants, state, masteredSet, hasMastery);
    if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
    else if (sort === "unmastered") list = [...list].sort((a, b) => Number(masteredSet.has(a.id)) - Number(masteredSet.has(b.id)));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plants, search, category, layer, tags, light, water, soilPh, safety, mastery, extra, sort, masteredSet, hasMastery]);

  useEffect(() => setVisibleCount(PAGE_SIZE), [filtered]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || visibleCount >= filtered.length) return;
    const ob = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) setVisibleCount(c => Math.min(c + PAGE_SIZE, filtered.length));
    }, { rootMargin: "600px" });
    ob.observe(el);
    return () => ob.disconnect();
  }, [visibleCount, filtered.length]);

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    plants.forEach(p => m.set(p.category, (m.get(p.category) ?? 0) + 1));
    return m;
  }, [plants]);
  const layerCounts = useMemo(() => {
    const m = new Map<string, number>();
    plants.forEach(p => m.set(p.layer, (m.get(p.layer) ?? 0) + 1));
    return m;
  }, [plants]);

  const activeTags: { key: string; label: string; remove: () => void }[] = [];
  if (search.trim()) activeTags.push({ key: "q", label: `搜索：${search.trim()}`, remove: () => setSearch("") });
  if (category !== "all") activeTags.push({ key: "cat", label: `分类：${category}`, remove: () => setCategory("all") });
  if (layer !== "all") activeTags.push({ key: "layer", label: `层级：${layerLabel(layer as LayerKey)}`, remove: () => setLayer("all") });
  tags.forEach(t => activeTags.push({ key: `tag:${t}`, label: t, remove: () => setTags(prev => prev.filter(x => x !== t)) }));
  if (light !== "all") activeTags.push({ key: "light", label: `光照：${LIGHT_LABEL[light] ?? light}`, remove: () => setLight("all") });
  if (water !== "all") activeTags.push({ key: "water", label: `水分：${WATER_LABEL[water] ?? water}`, remove: () => setWater("all") });
  if (soilPh !== "all") activeTags.push({ key: "ph", label: `土壤：${PH_LABEL[soilPh] ?? soilPh}`, remove: () => setSoilPh("all") });
  if (safety !== "all") {
    const label = safety === "safe" ? "仅无警示" : safety === "warning" ? "仅警示植物" : safety === "safeForChildren" ? "仅儿童区可用" : "仅禁植清单";
    activeTags.push({ key: "safety", label, remove: () => setSafety("all") });
  }
  if (hasMastery && mastery !== "all") activeTags.push({ key: "mastery", label: mastery === "mastered" ? "已掌握" : "未掌握", remove: () => setMastery("all") });
  extra.functionTags.forEach(t => activeTags.push({ key: `fn:${t}`, label: t, remove: () => setExtra(e => ({ ...e, functionTags: e.functionTags.filter(x => x !== t) })) }));
  extra.regionTags.forEach(t => activeTags.push({ key: `rg:${t}`, label: `区域：${t}`, remove: () => setExtra(e => ({ ...e, regionTags: e.regionTags.filter(x => x !== t) })) }));
  if (extra.soilDrainage) activeTags.push({ key: "drain", label: `排水：${DRAIN_LABEL[extra.soilDrainage] ?? extra.soilDrainage}`, remove: () => setExtra(e => ({ ...e, soilDrainage: undefined })) });

  const clearAll = () => {
    setSearch(""); setCategory("all"); setLayer("all"); setTags([]);
    setLight("all"); setWater("all"); setSoilPh("all");
    setSafety("all"); setMastery("all");
    setExtra({ functionTags: [], regionTags: [] });
    setAiBanner(null);
  };

  const applyAi = (r: AiSearchResult) => {
    const c = r.conditions as Record<string, unknown>;
    setCategory(typeof c.category === "string" ? c.category : "all");
    setLayer(typeof c.layer === "string" ? c.layer : "all");
    setLight(typeof c.light === "string" ? c.light : "all");
    setWater(typeof c.water === "string" ? c.water : "all");
    setSoilPh(typeof c.soilPh === "string" ? c.soilPh : "all");
    if (Array.isArray(c.tagGroups)) setTags(c.tagGroups as string[]);
    if (c.isWarning === true) setSafety("warning");
    else if (c.isWarning === false) setSafety("safe");
    if (typeof c.keyword === "string") setSearch(c.keyword);
    setExtra({
      functionTags: Array.isArray(c.functionTags) ? c.functionTags as string[] : [],
      regionTags: Array.isArray(c.regionTags) ? c.regionTags as string[] : [],
      soilDrainage: typeof c.soilDrainage === "string" ? c.soilDrainage : undefined,
    });
    setAiBanner({ desc: r.description, unrecognized: r.unrecognized?.length ?? 0 });
    setPanelOpen(false);
  };

  const clearAi = () => {
    setAiBanner(null);
    clearAll();
  };

  const suggestions = useMemo(() => {
    if (filtered.length > 0 || activeTags.length === 0) return [];
    const out: { label: string; gain: number }[] = [];
    const resets: [string, string, Partial<FilterState>][] = [
      ["q", "搜索", { search: "" }],
      ["cat", "分类", { category: "all" }],
      ["layer", "层级", { layer: "all" }],
      ["light", "光照", { light: "all" }],
      ["water", "水分", { water: "all" }],
      ["ph", "土壤", { soilPh: "all" }],
      ["safety", "安全", { safety: "all" }],
      ["mastery", "掌握状态", { mastery: "all" }],
      ["drain", "排水", { extra: { ...extra, soilDrainage: undefined } }],
      ["fn", "功能标签", { extra: { ...extra, functionTags: [] } }],
      ["rg", "区域", { extra: { ...extra, regionTags: [] } }],
    ];
    for (const [key, label, patch] of resets) {
      if (!activeTags.some(t => t.key === key || t.key.startsWith(`${key}:`))) continue;
      const n = runFilter(plants, { ...state, ...patch }, masteredSet, hasMastery).length;
      if (n > 0) out.push({ label, gain: n });
    }
    if (tags.length > 1) {
      const n = runFilter(plants, { ...state, tags: [] }, masteredSet, hasMastery).length;
      if (n > 0) out.push({ label: "功能组标签", gain: n });
    }
    return out.sort((a, b) => b.gain - a.gain).slice(0, 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered.length, activeTags.length, plants, state, masteredSet, hasMastery]);

  const toggleGroup = (id: string) => setGroups(g => ({ ...g, [id]: !g[id] }));

  const dividerCls =
    "hidden w-1 shrink-0 cursor-col-resize bg-outline-variant/30 transition-colors hover:bg-primary/40 lg:block";

  return (
    <div className="flex w-full flex-col">
      <button
        type="button"
        onClick={() => setPanelOpen(o => !o)}
        className="mb-4 flex w-full items-center justify-between rounded-xl border-neo border-outline-variant bg-surface px-4 py-3 text-fs-sub font-medium text-on-surface shadow-card lg:hidden">
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-foreground" />
          筛选{activeTags.length > 0 ? `（已选 ${activeTags.length} 项）` : ""}
        </span>
        <ChevronDown className={`h-4 w-4 text-on-surface-variant transition-transform ${panelOpen ? "" : "-rotate-90"}`} />
      </button>

      <div
        className="lg:flex lg:h-[var(--size-panel-vh)] lg:overflow-hidden lg:rounded-xl lg:bg-surface lg:shadow-card"
        style={{ "--filter-w": `${filterW}px`, "--ai-w": `${aiW}px` } as React.CSSProperties}>
        <aside
          className={`${panelOpen ? "block" : "hidden"} mb-6 lg:mb-0 lg:block lg:w-(--filter-w) lg:shrink-0 lg:border-r-neo lg:border-outline-variant/20`}>
          <div className="rounded-xl border-neo border-outline-variant bg-surface shadow-card lg:flex lg:h-full lg:flex-col lg:rounded-none lg:border-0 lg:shadow-none">
            <div className="flex shrink-0 items-center gap-2 border-b-neo border-outline-variant px-4 py-3">
              <SlidersHorizontal className="h-4 w-4 text-foreground" />
              <span className="text-fs-sub font-medium text-on-surface">植物筛选</span>
              <span className="ml-auto rounded-full bg-primary-container px-2 py-0.5 text-fs-label font-medium text-on-primary-container">{filtered.length} 种</span>
            </div>
            <div className="max-h-[var(--size-panel-dvh-catalog)] space-y-3 overflow-y-auto px-3 py-3 lg:max-h-none lg:min-h-0 lg:flex-1">
              <AiSearchPanel loggedIn={!!loggedIn} onApply={applyAi} />

              <Group id="cat" label="分类导航" open={groups.cat} onToggle={toggleGroup}>
                <div className="space-y-0.5">
                  <NavItem active={category === "all"} label="全部分类" count={plants.length} onClick={() => setCategory("all")} />
                  {filters.categories.map(c => (
                    <NavItem key={c} active={category === c} label={c} count={categoryCounts.get(c) ?? 0} onClick={() => setCategory(category === c ? "all" : c)} />
                  ))}
                </div>
                <div className="space-y-0.5 border-t-neo border-outline-variant/60 pt-2">
                  <NavItem active={layer === "all"} label="全部层级" count={plants.length} onClick={() => setLayer("all")} />
                  {filters.layers.map(l => (
                    <NavItem key={l.key} active={layer === l.key} label={l.label} count={layerCounts.get(l.key) ?? 0} onClick={() => setLayer(layer === l.key ? "all" : l.key)} />
                  ))}
                </div>
              </Group>

              <Group id="habit" label="生长习性" open={groups.habit} onToggle={toggleGroup}>
                <div>
                  <p className="mb-1.5 text-fs-label text-on-surface-variant">光照</p>
                  <div className="flex flex-wrap gap-1.5">
                    {LIGHT_NEED.map(v => <Chip key={v} active={light === v} onClick={() => setLight(light === v ? "all" : v)}>{LIGHT_LABEL[v]}</Chip>)}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-fs-label text-on-surface-variant">水分</p>
                  <div className="flex flex-wrap gap-1.5">
                    {WATER_NEED.map(v => <Chip key={v} active={water === v} onClick={() => setWater(water === v ? "all" : v)}>{WATER_LABEL[v]}</Chip>)}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-fs-label text-on-surface-variant">土壤酸碱度</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SOIL_PH.filter(v => v !== "any").map(v => <Chip key={v} active={soilPh === v} onClick={() => setSoilPh(soilPh === v ? "all" : v)}>{PH_LABEL[v]}</Chip>)}
                  </div>
                </div>
              </Group>

              <Group id="safety" label="安全与状态" open={groups.safety} onToggle={toggleGroup}>
                <div className="flex flex-wrap gap-1.5">
                  <Chip active={safety === "safe"} onClick={() => setSafety(safety === "safe" ? "all" : "safe")}>仅看安全植物</Chip>
                  <Chip active={safety === "warning"} onClick={() => setSafety(safety === "warning" ? "all" : "warning")}>仅警示植物</Chip>
                  <Chip active={safety === "forbid"} onClick={() => setSafety(safety === "forbid" ? "all" : "forbid")}>仅禁植清单</Chip>
                  <Chip active={safety === "safeForChildren"} onClick={() => setSafety(safety === "safeForChildren" ? "all" : "safeForChildren")}>仅儿童区可用</Chip>
                </div>
                {hasMastery && (
                  <div className="flex flex-wrap gap-1.5 border-t-neo border-outline-variant/60 pt-2">
                    <Chip active={mastery === "all"} onClick={() => setMastery("all")}>全部掌握状态</Chip>
                    <Chip active={mastery === "mastered"} onClick={() => setMastery("mastered")}>已掌握</Chip>
                    <Chip active={mastery === "unmastered"} onClick={() => setMastery("unmastered")}>未掌握</Chip>
                  </div>
                )}
              </Group>

              <div className="rounded-lg bg-surface-container/70 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-fs-label font-medium text-on-surface">已选 {activeTags.length} 项</p>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-fs-label text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface">
                    <RotateCcw className="h-3 w-3" />
                    重置全部
                  </button>
                </div>
                {activeTags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {activeTags.map(t => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={t.remove}
                        className="flex items-center gap-1 rounded-full bg-primary-container px-2.5 py-1 text-fs-label font-medium text-on-primary-container transition-opacity hover:opacity-80">
                        {t.label}
                        <X className="h-3 w-3" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        <div
          aria-hidden
          role="separator"
          onPointerDown={e => startFilterDrag(e, 1)}
          aria-label="拖动调整筛选栏宽度"
          className={dividerCls} />

        <div className="min-w-0 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
          <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-4 lg:py-3">
          {aiBanner && (
            <div className="mb-4 rounded-xl border-neo border-primary/30 bg-primary-container/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-fs-sub font-medium text-on-surface">AI 理解为：{aiBanner.desc.join("；")}</p>
                  {aiBanner.unrecognized > 0 && (
                    <p className="mt-1 text-fs-label text-on-surface-variant">有 {aiBanner.unrecognized} 个条件我没能理解，已自动忽略</p>
                  )}
                  <p className="mt-1 text-fs-label text-on-surface-variant">可在左侧筛选栏手动微调</p>
                </div>
                <button
                  type="button"
                  onClick={clearAi}
                  className="shrink-0 rounded-md border-neo border-outline-variant bg-surface px-3 py-1.5 text-fs-label font-medium text-on-surface-variant transition-colors hover:bg-surface-container">
                  一键清除
                </button>
              </div>
            </div>
          )}

          <div className="mb-4 flex items-center justify-between gap-2">
            <p className="text-fs-sub text-on-surface-variant">
              共 <span className="font-medium text-on-surface">{filtered.length}</span> 种
              {filtered.length !== plants.length ? `（全部 ${plants.length} 种）` : ""}
            </p>
            <select
              value={sort}
              onChange={e => setSort(e.target.value as "default" | "name" | "unmastered")}
              className="rounded-md border-none bg-surface-container px-3 py-2 text-fs-sub text-on-surface focus:outline-none focus:ring-2 focus:ring-ink">
              <option value="default">默认排序</option>
              <option value="name">按名称 A-Z</option>
              {hasMastery ? <option value="unmastered">未掌握优先</option> : null}
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl bg-surface p-10 shadow-card">
              <p className="text-fs-sub text-on-surface-variant">没有符合条件的植物</p>
              {suggestions.length > 0 && (
                <p className="text-fs-label text-on-surface-variant">
                  条件可能过窄，试试放宽：{suggestions.map(s => `去掉「${s.label}」（可多 ${s.gain} 种）`).join("；")}
                </p>
              )}
              <button
                type="button"
                onClick={clearAll}
                className="rounded-md border-neo border-outline-variant bg-surface px-4 py-2 text-fs-sub font-medium text-on-surface transition-colors hover:bg-surface-container">
                重置筛选
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
              {filtered.slice(0, visibleCount).map(p => (
                <PlantCard
                  key={p.id}
                  plant={p}
                  onOpen={setSelected}
                  onExplain={(pl) => setExplainPlant({ id: pl.id, name: pl.name, latin: pl.latin })}
                  mastered={masteredIds?.includes(p.id)}
                />
              ))}
            </div>
          )}
          {visibleCount < filtered.length && <div ref={sentinelRef} className="h-1" aria-hidden />}
          </div>
        </div>

        <div
          aria-hidden
          role="separator"
          onPointerDown={e => startAiDrag(e, -1)}
          aria-label="拖动调整AI讲解栏宽度"
          className="hidden w-1 shrink-0 cursor-col-resize bg-outline-variant/30 transition-colors hover:bg-primary/40 xl:block" />

        <aside className="hidden min-w-0 xl:block xl:w-(--ai-w) xl:shrink-0 xl:border-l-neo xl:border-outline-variant/20">
          <div className="flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <CatalogChatColumn activePlant={explainPlant} plantsLite={chatPlants} signedIn={!!loggedIn} flush />
            </div>
          </div>
        </aside>
      </div>

      {selected && (
        <PlantDetailModal
          plant={selected}
          onClose={() => setSelected(null)}
          list={filtered}
          onSelect={setSelected}
        />
      )}
    </div>
  );
}
