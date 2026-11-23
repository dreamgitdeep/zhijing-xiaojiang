import type { ReactNode } from "react";

interface PageHeaderProps {
  /** 页面标题（来自 src/config/pages.ts） */
  title: string;
  /** 标题下说明，可为动态内容 */
  description?: ReactNode;
  /** 右侧操作区（按钮等） */
  actions?: ReactNode;
  /** 外层间距微调 */
  className?: string;
}

/** 页面头部：标题+说明+操作区，组件内无业务文案 */
export function PageHeader({ title, description, actions, className = "mb-6" }: PageHeaderProps) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-4 ${className}`}>
      <div>
        <h1 className="text-fs-title font-medium text-on-surface">{title}</h1>
        {description && <p className="mt-1 text-fs-sub text-on-surface-variant">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
