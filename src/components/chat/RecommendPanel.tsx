"use client";

import { useState } from "react";
import { ChevronDown, Image as ImageIcon, Link2, Loader2, Sparkles, Sprout } from "lucide-react";
import type { ChatController } from "./use-chat";

/** 推荐图片：加载失败时回退为植物名首字占位，避免破损图标 */
function ResImg({ img, plantName, fallbackChar }: { img: { url: string; alt: string }; plantName: string; fallbackChar: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className="flex h-20 w-28 items-center justify-center rounded-lg bg-primary-container/60 text-fs-title font-medium text-on-primary-container shadow-card">
        {fallbackChar}
      </span>
    );
  }
  return (
    <img
      src={img.url}
      alt={img.alt || plantName}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-20 w-28 rounded-lg object-cover shadow-card transition-transform hover:scale-[1.03]"
    />
  );
}

/** 可折叠分区：点击标题收起/展开，CSS grid-rows 过渡，reduced-motion 时关闭动画 */
function Section({
  title,
  icon,
  count,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="overflow-hidden rounded-lg border-neo border-outline-variant/20 bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-surface-container"
      >
        <span className="flex min-w-0 items-center gap-1.5 text-fs-label font-medium text-on-surface">
          {icon}
          {title}
          {typeof count === "number" && <span className="text-on-surface-variant/80">（{count}）</span>}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-on-surface-variant transition-transform duration-300 motion-reduce:transition-none ${open ? "" : "-rotate-90"}`} />
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="px-3 pb-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * 可复用推荐面板：相关推荐 / 造景效果图 / 相关链接 三个可折叠分区，面板内部滚动。
 * 数据全部经 props（chat controller）注入；无内容的分区不渲染（不显空壳）。
 */
export function RecommendPanel({ chat, flush = false }: { chat: ChatController; flush?: boolean }) {
  const { resources, resourceImgs, renderImgs, generating, renderNotice, generateRender, streaming } = chat;

  const hasImages = Boolean(resources) && resourceImgs.length > 0;
  const hasLinks = Boolean(resources) && resources!.links.length > 0;
  const canRender = Boolean(resources);

  return (
    <div className={flush ? "flex h-full min-h-0 flex-col overflow-hidden" : "flex flex-col overflow-hidden rounded-xl bg-surface shadow-card lg:max-h-[var(--size-panel-vh-chat)]"}>
      <div className="flex items-center justify-between gap-2 border-b-neo border-outline-variant/20 px-4 py-3">
        <p className="flex min-w-0 items-center gap-1.5 truncate text-fs-label font-medium text-on-surface-variant">
          <Sprout className="h-3.5 w-3.5 shrink-0 text-foreground" />
          相关推荐
          {resources && <span className="truncate text-on-surface">· {resources.plantName}</span>}
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {streaming ? (
          <p className="rounded-lg bg-surface-container px-3 py-4 text-center text-fs-label leading-relaxed text-on-surface-variant">
            正在回答，相关问题推荐稍后更新…
          </p>
        ) : resources ? (
          <>
            {hasImages && (
              <Section title="相关推荐" icon={<ImageIcon className="h-3.5 w-3.5 text-foreground" />} count={resourceImgs.length}>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {resourceImgs.map((img) => (
                    <a
                      key={img.local ? `local-${resources.plantId}` : img.url}
                      href={img.local ? `/catalog?plantId=${resources.plantId}` : img.url}
                      target={img.local ? undefined : "_blank"}
                      rel={img.local ? undefined : "noreferrer"}
                      className="shrink-0"
                    >
                      <ResImg img={img} plantName={resources.plantName} fallbackChar={resources.plantName.charAt(0)} />
                    </a>
                  ))}
                </div>
              </Section>
            )}

            {canRender && (
              <Section title="造景效果图" icon={<Sparkles className="h-3.5 w-3.5 text-foreground" />}>
                {renderImgs[resources.plantId] ? (
                  <a href={renderImgs[resources.plantId]} target="_blank" rel="noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={renderImgs[resources.plantId]}
                      alt={`${resources.plantName} 造景效果图`}
                      className="w-full rounded-lg object-cover shadow-card transition-transform hover:scale-[1.01]"
                    />
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => generateRender(resources.plantId)}
                    disabled={generating}
                    className="flex items-center gap-1.5 rounded-full bg-primary-container/70 px-3 py-1.5 text-fs-label font-medium text-on-primary-container transition-colors hover:bg-primary-container disabled:opacity-60"
                  >
                    {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {generating ? "效果图生成中，约需半分钟…" : "生成造景效果图"}
                  </button>
                )}
                {renderNotice && <p className="mt-1.5 text-fs-label text-error">{renderNotice}</p>}
              </Section>
            )}

            {hasLinks && (
              <Section title="相关链接" icon={<Link2 className="h-3.5 w-3.5 text-foreground" />} count={resources.links.length}>
                <ul className="space-y-1.5">
                  {resources.links.map((l) => (
                    <li key={l.url}>
                      <a href={l.url} target="_blank" rel="noreferrer" className="group block">
                        <span className="text-fs-label font-medium text-foreground group-hover:underline">{l.title}</span>
                        {l.snippet && <span className="ml-2 text-fs-label text-on-surface-variant/80">{l.snippet.slice(0, 60)}</span>}
                      </a>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {!hasImages && !hasLinks && !canRender && (
              <p className="rounded-lg bg-surface-container px-3 py-4 text-center text-fs-label leading-relaxed text-on-surface-variant">
                暂无该植物的相关推荐内容。
              </p>
            )}
          </>
        ) : (
          <p className="rounded-lg bg-surface-container px-3 py-4 text-center text-fs-label leading-relaxed text-on-surface-variant">
            问问具体植物，这里会出现相关推荐、造景效果图与参考链接。
          </p>
        )}
      </div>
    </div>
  );
}
