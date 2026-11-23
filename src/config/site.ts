import {
  Bell,
  BookOpen,
  ClipboardList,
  LayoutDashboard,
  MessageCircleQuestion,
  PencilRuler,
  Users
} from "lucide-react";

/** 站点品牌信息：全站名称/院校/课程/版本号唯一来源 */
export const SITE = {
  name: "植景小匠",
  school: "上海农林职业学院",
  course: "植物造景课程",
  logo: "/images/brand/logo-mark.webp",
  version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0"
};

export interface NavItem {
  href: string;
  label: string;
  icon: typeof BookOpen;
}

/** 学生端导航（顺序即展示顺序） */
export const NAV_STUDENT: NavItem[] = [
  { href: "/learning", label: "学习管理", icon: LayoutDashboard },
  { href: "/catalog", label: "植物图鉴", icon: BookOpen },
  { href: "/chat", label: "智能问答", icon: MessageCircleQuestion },
  { href: "/design", label: "植景设计", icon: PencilRuler },
  { href: "/notifications", label: "消息通知", icon: Bell }
];

/** 教师端导航（顺序即展示顺序） */
export const NAV_TEACHER: NavItem[] = [
  { href: "/admin", label: "概览", icon: LayoutDashboard },
  { href: "/admin-plants", label: "植物数据", icon: BookOpen },
  { href: "/admin-students", label: "学情看板", icon: Users },
  { href: "/admin/design-tasks", label: "任务管理", icon: ClipboardList }
];

/** 侧栏底部用户菜单文案 */
export const USER_MENU = {
  settings: "设置",
  appearance: "外观",
  themeDark: "深色",
  themeLight: "浅色",
  feedback: "意见反馈",
  checkUpdate: "检查更新",
  logout: "退出登录",
  login: "登录",
  roleTeacher: "教师",
  roleStudent: "学生",
  accountMenuAria: "的账号菜单",
  unreadMessageAria: "条未读消息",
  navOpenAria: "打开导航",
  navCloseAria: "关闭导航",
  sidebarDragAria: "拖动调整侧栏宽度"
};

/** 检查更新弹窗文案 */
export const UPDATE_MODAL = {
  closeAria: "关闭检查更新",
  closeAriaShort: "关闭",
  latest: "已是最新版本",
  checking: "正在检查更新…",
  currentVersion: "当前版本"
};

/** 首页文案 */
export const HOME_COPY = {
  enter: "进入应用"
};

/** 简单占位符模板：`共 {count} 种植物` + { count: 3 } → `共 3 种植物` */
export function formatTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) => (key in vars ? String(vars[key]) : m));
}
