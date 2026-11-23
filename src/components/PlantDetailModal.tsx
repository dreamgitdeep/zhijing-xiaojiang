'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Droplets,
  LoaderCircle,
  Mountain,
  PencilLine,
  Sun,
  ThermometerSnowflake,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { SeasonBar } from '@/components/SeasonBar';
import { layerLabel, type ImageCreditInfo, type Plant, type PlantLite } from '@/lib/types';

const RISK_LEVEL: Record<string, string> = {
  severe: '重度',
  high: '较高',
  moderate: '中等',
  low: '轻微',
};

/** 模块级详情缓存：同一会话内重复打开/前后翻页不重复请求 */
const detailCache = new Map<string, Plant>();

function SectionTitle({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <p
      className={`mb-2 flex items-center gap-1 text-fs-label font-medium uppercase tracking-wide ${
        danger ? 'text-error' : 'text-on-surface-variant'
      }`}
    >
      {children}
    </p>
  );
}

function Field({
  label,
  value,
  icon: Icon,
}: {
  label?: string;
  value?: string | null;
  icon?: LucideIcon;
}) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-fs-sub">
      {Icon ? (
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-on-surface-variant" />
      ) : (
        <dt className="w-14 shrink-0 text-on-surface-variant">{label}</dt>
      )}
      <dd className="text-on-surface">{value}</dd>
    </div>
  );
}

const LICENSE_LABEL: Record<string, string> = {
  cc0: 'CC0',
  'cc-by': 'CC BY',
  'cc-by-nc': 'CC BY-NC',
  'cc-by-sa': 'CC BY-SA',
};

function CreditLine({ label, c }: { label: string; c: ImageCreditInfo }) {
  if (!c) return null;
  const who = [c.photographer && c.photographer !== 'see-photo-page' ? c.photographer : null, c.attribution]
    .filter(Boolean)
    .join(' · ');
  const license = c.license ? LICENSE_LABEL[c.license] ?? c.license.toUpperCase() : null;
  return (
    <p>
      {label}：{who || '见原页面'}
      {license ? `（${license}）` : ''}
      {c.pageUrl && (
        <>
          {' · '}
          <a href={c.pageUrl} target="_blank" rel="noreferrer" className="text-foreground underline-offset-2 hover:underline">
            原始页面
          </a>
        </>
      )}
    </p>
  );
}

export function PlantDetailModal({
  plant,
  onClose,
  list = [],
  onSelect,
}: {
  plant: PlantLite;
  onClose: () => void;
  list?: PlantLite[];
  onSelect?: (p: PlantLite) => void;
}) {
  const [view, setView] = useState<'full' | 'close'>('full');
  const [detail, setDetail] = useState<Plant | null>(() => detailCache.get(plant.id) ?? null);
  const [failed, setFailed] = useState(false);
  useEffect(() => setView('full'), [plant.id]);

  useEffect(() => {
    const cached = detailCache.get(plant.id);
    if (cached) {
      setDetail(cached);
      setFailed(false);
      return;
    }
    let alive = true;
    setDetail(null);
    setFailed(false);
    fetch(`/api/plants/${plant.id}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<Plant>;
      })
      .then((d) => {
        if (!alive) return;
        detailCache.set(plant.id, d);
        setDetail(d);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [plant.id]);

  const idx = list.findIndex((p) => p.id === plant.id);
  const prev = idx > 0 ? list[idx - 1] : null;
  const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogTitle className="sr-only">{plant.name}</DialogTitle>

        {!detail ? (
          <div className="flex min-h-[var(--size-min-lg)] flex-col items-center justify-center gap-3 p-10">
            {failed ? (
              <>
                <p className="text-fs-sub text-on-surface-variant">详情加载失败，请关闭后重试</p>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md bg-surface-container px-4 py-2 text-fs-sub font-medium text-on-surface transition-colors hover:bg-surface-container-high"
                >
                  关闭
                </button>
              </>
            ) : (
              <>
                <LoaderCircle className="h-6 w-6 animate-spin text-foreground" aria-hidden />
                <p className="text-fs-sub text-on-surface-variant">正在加载「{plant.name}」详情…</p>
              </>
            )}
          </div>
        ) : (
          <DetailBody
            detail={detail}
            view={view}
            setView={setView}
            onClose={onClose}
            prev={prev}
            next={next}
            onSelect={onSelect}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailBody({
  detail: plant,
  view,
  setView,
  onClose,
  prev,
  next,
  onSelect,
}: {
  detail: Plant;
  view: 'full' | 'close';
  setView: (v: 'full' | 'close') => void;
  onClose: () => void;
  prev: PlantLite | null;
  next: PlantLite | null;
  onSelect?: (p: PlantLite) => void;
}) {
  const w = plant.warning;
  const credit = plant.imageCredit;
  const orn = [
    plant.ornamentalPart ? `观赏部位：${plant.ornamentalPart}` : null,
    plant.color ? `花色/叶色：${plant.color}` : null,
    plant.phenology.text ? `花期：${plant.phenology.text}` : null,
  ]
    .filter(Boolean)
    .join('。');

  return (
    <>
      <div className="relative h-60 overflow-hidden">
        <Image
          src={view === 'full' ? plant.images.full : plant.images.close}
          alt={`${plant.name}${view === 'full' ? '全株' : '花叶特写'}`}
          fill
          sizes="(max-width: 768px) 100vw, 672px"
          className="object-cover"
        />
        <div className="absolute right-3 top-3 flex gap-2">
          {(['full', 'close'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setView(k)}
              className={`rounded-full bg-black/40 px-3 py-1.5 text-fs-label text-white backdrop-blur-sm transition-colors hover:bg-black/55 ${
                view === k ? 'ring-1 ring-white/70' : ''
              }`}
            >
              {k === 'full' ? '全株' : '花叶特写'}
            </button>
          ))}
        </div>
        {plant.isWarning && (
          <span className="absolute left-14 top-3 flex items-center gap-1 rounded-full bg-error px-3 py-1.5 text-fs-label font-medium text-white">
            <TriangleAlert className="h-3.5 w-3.5" />
            {w?.restriction === 'forbid' ? `禁植 · ${w?.riskType || '警示植物'}` : w?.riskType || '警示植物'}
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/55"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid max-h-[var(--size-modal-vh-half)] gap-6 overflow-y-auto p-6 md:grid-cols-2">
        <div className="space-y-5">
          <div>
            <h2 className="text-fs-section font-medium text-on-surface">{plant.name}</h2>
            {plant.latin && (
              <p className="mt-0.5 font-latin text-fs-sub italic text-on-surface-variant">{plant.latin}</p>
            )}
          </div>
          <div>
            <SectionTitle>基础信息</SectionTitle>
            <dl className="space-y-1.5">
              <Field label="别名" value={plant.alias?.length ? plant.alias.join('、') : null} />
              <Field label="科属" value={plant.taxon} />
              <Field label="生活型" value={plant.lifeForm} />
              <Field label="株高" value={plant.height?.text} />
              <Field label="应用层" value={layerLabel(plant.layer)} />
            </dl>
          </div>
          <div>
            <SectionTitle>生态习性</SectionTitle>
            <dl className="space-y-1.5">
              <Field icon={Sun} value={plant.light.text} />
              <Field icon={Droplets} value={plant.water.text} />
              <Field icon={Mountain} value={plant.soil.text} />
              <Field icon={ThermometerSnowflake} value={plant.hardiness.text} />
            </dl>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <SectionTitle>观赏特性</SectionTitle>
            <p className="text-fs-sub leading-relaxed text-on-surface">{orn}</p>
            {plant.phenology.seasonInterest && (
              <div className="mt-3">
                <SeasonBar
                  interest={plant.phenology.seasonInterest}
                  peakSeason={plant.phenology.peakSeason}
                />
              </div>
            )}
          </div>
          <div>
            <SectionTitle>应用配置</SectionTitle>
            <p className="text-fs-sub leading-relaxed text-on-surface">
              {plant.usage?.length ? `${plant.usage.join('；')}。` : '暂无配置建议。'}
            </p>
            {plant.notes && (
              <p className="mt-2 text-fs-label leading-relaxed text-on-surface-variant">
                配置提示：{plant.notes}
              </p>
            )}
          </div>
          {w && (
            <div>
              <SectionTitle danger>
                <TriangleAlert className="h-3.5 w-3.5" />
                安全警示（教学必读）
              </SectionTitle>
              <div className="space-y-1.5 rounded-lg border-l-4 border-error bg-error/5 p-3 text-fs-sub">
                {w.restriction === 'forbid' && (
                  <p className="font-medium text-error">
                    禁植植物 —— {w.banReason || '社区花园禁止使用，设计选种时须排除'}
                  </p>
                )}
                <p>
                  <span className="text-on-surface-variant">风险类型：</span>
                  {w.riskType}
                  {w.riskLevel && RISK_LEVEL[w.riskLevel] ? `（${RISK_LEVEL[w.riskLevel]}）` : ''}
                </p>
                <p>
                  <span className="text-on-surface-variant">有毒部位：</span>
                  {w.riskPart}
                </p>
                <p>
                  <span className="text-on-surface-variant">中毒表现：</span>
                  {w.symptom}
                </p>
                <p>
                  <span className="text-on-surface-variant">教学提示：</span>
                  {w.teachUse}
                </p>
              </div>
            </div>
          )}
        </div>

        {(plant.source || credit) && (
          <div className="md:col-span-2">
            <SectionTitle>数据与图片来源</SectionTitle>
            <div className="space-y-1 rounded-lg bg-surface-container/60 p-3 text-fs-label text-on-surface-variant">
              {plant.source && <p>资料来源：{plant.source}</p>}
              {credit?.full && <CreditLine label="全株图" c={credit.full} />}
              {credit?.close && <CreditLine label="花叶特写" c={credit.close} />}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t-neo border-outline-variant/20 px-6 py-4">
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!prev}
            onClick={() => prev && onSelect?.(prev)}
            className="flex items-center gap-1 rounded-md px-3 py-2 text-fs-sub text-on-surface-variant transition-colors hover:bg-surface-container disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            上一种
          </button>
          <button
            type="button"
            disabled={!next}
            onClick={() => next && onSelect?.(next)}
            className="flex items-center gap-1 rounded-md px-3 py-2 text-fs-sub text-on-surface-variant transition-colors hover:bg-surface-container disabled:opacity-40"
          >
            下一种
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/plant-quiz?plantId=${plant.id}`}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-fs-sub font-medium text-on-primary transition-opacity hover:opacity-90"
          >
            <PencilLine className="h-4 w-4" />
            开始练习此植物
          </Link>
        </div>
      </div>
    </>
  );
}
