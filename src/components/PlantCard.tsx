import { useState } from 'react';
import { Check, ChevronRight, Flower2, Sparkles, TriangleAlert } from 'lucide-react';
import type { PlantLite } from '@/lib/types';
import { layerLabel } from '@/lib/types';

const TAG_TONES = [
  'bg-primary-container text-on-primary-container',
  'bg-water-container text-on-water-container',
  'bg-blossom-container text-on-blossom-container',
  'bg-sun-container text-on-sun-container',
];

export function PlantCard({
  plant,
  onOpen,
  onExplain,
  mastered,
}: {
  plant: PlantLite;
  onOpen: (p: PlantLite) => void;
  onExplain?: (p: PlantLite) => void;
  mastered?: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const tags = Array.from(
    new Set([plant.category, layerLabel(plant.layer), ...(plant.tagGroups ?? [])].filter(Boolean)),
  );
  const show = tags.slice(0, 2);
  const more = tags.length - show.length;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(plant)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(plant);
        }
      }}
      className="lift group flex cursor-pointer flex-col overflow-hidden rounded-xl bg-surface text-left shadow-card"
    >
      <div className="relative h-40">
        {plant.thumb && !imgFailed ? (
          <img
            src={plant.thumb}
            alt={plant.name}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary-container/60">
            <span className="text-fs-title font-medium text-on-primary-container">{plant.name.slice(0, 1)}</span>
          </div>
        )}
        {mastered && (
          <span className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-success px-2 py-0.5 text-fs-label font-medium text-white">
            <Check className="h-3 w-3" />
            已掌握
          </span>
        )}
        {plant.isWarning && (
          <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-error px-2 py-0.5 text-fs-label font-medium text-white">
            <TriangleAlert className="h-3 w-3" />
            {plant.restriction === 'forbid' ? '禁植' : '警示'}
          </span>
        )}
      </div>
      <div className="p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-medium text-on-surface">{plant.name}</h3>
          {plant.latin && (
            <span className="truncate font-latin text-fs-label italic text-on-surface-variant">{plant.latin}</span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {show.map((t, i) => (
            <span
              key={`${t}-${i}`}
              className={`rounded-full px-2 py-0.5 text-fs-label ${TAG_TONES[i % TAG_TONES.length]}`}
            >
              {t}
            </span>
          ))}
          {more > 0 && (
            <span className="rounded-full bg-surface-container px-2 py-0.5 text-fs-label text-on-surface-variant">
              +{more}
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-fs-label text-on-surface-variant">
          <span className="flex min-w-0 items-center gap-1">
            <Flower2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{plant.phenologyText || layerLabel(plant.layer)}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {onExplain && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onExplain(plant);
                }}
                className="inline-flex items-center gap-1 rounded-full bg-primary-container px-2.5 py-1 font-medium text-on-primary-container transition-opacity hover:opacity-85"
              >
                <Sparkles className="h-3 w-3" />
                AI 讲解
              </button>
            )}
            <ChevronRight className="h-4 w-4 text-on-surface-variant/50 transition-colors group-hover:text-foreground" />
          </span>
        </div>
      </div>
    </div>
  );
}
