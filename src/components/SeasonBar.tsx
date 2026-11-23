import type { SeasonInterest } from '@/lib/types';

const SEASONS: { key: keyof SeasonInterest; label: string }[] = [
  { key: 'spring', label: '春' },
  { key: 'summer', label: '夏' },
  { key: 'autumn', label: '秋' },
  { key: 'winter', label: '冬' },
];

export function SeasonBar({
  interest,
  peakSeason,
}: {
  interest: SeasonInterest;
  peakSeason: string;
}) {
  const max = Math.max(interest.spring, interest.summer, interest.autumn, interest.winter, 1);
  return (
    <div>
      <div className="grid h-16 grid-cols-4 items-end gap-1.5">
        {SEASONS.map(({ key, label }) => {
          const v = interest[key];
          const isPeak = key === peakSeason;
          return (
            <div key={key} className="flex h-full flex-col items-center gap-1">
              <div
                className="mt-auto w-full rounded-t-md bg-primary"
                style={{
                  height: `${Math.max(Math.round((v / max) * 100), 8)}%`,
                  opacity: isPeak ? 1 : 0.4,
                }}
              />
              <span className="text-fs-label text-on-surface-variant">{label}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-1 text-fs-label text-on-surface-variant/70">四季景观价值（柱条示意）</p>
    </div>
  );
}
