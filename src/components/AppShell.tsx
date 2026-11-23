"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
    Check,
    Loader2,
    LogOut,
    Menu,
    MessageSquarePlus,
    Palette,
    RefreshCw,
    Settings,
    X
} from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { NAV_STUDENT, NAV_TEACHER, SITE, UPDATE_MODAL, USER_MENU } from "@/config/site";
import Avatar from "./Avatar";
import { SettingsModal } from "./SettingsModal";
import { FeedbackModal } from "./FeedbackModal";
import { useDragWidth } from "@/lib/use-drag-width";
export type ShellUser = SessionUser | null;

/** 检查更新弹窗：无云端更新源，展示当前版本并告知已是最新 */
function UpdateModal(
    {
        open,
        onClose
    }: {
        open: boolean;
        onClose: () => void;
    }
) {
    const [done, setDone] = useState(false);

    useEffect(() =>
    {
        if (!open)
            return;
        setDone(false);
        const t = setTimeout(() => setDone(true), 900);
        return () => clearTimeout(t);
    }, [open]);

    if (!open)
        return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
            <button
                type="button"
                aria-label={UPDATE_MODAL.closeAria}
                onClick={onClose}
                className="absolute inset-0 animate-[fade-in_.2s_ease-out] cursor-default bg-black/45 backdrop-blur-sm" />
            <div className="relative w-[var(--size-modal-xs)] max-w-full animate-[rise-in_.3s_ease-out] rounded-2xl bg-surface p-7 text-center shadow-dialog">
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-high text-on-surface transition-colors hover:bg-error/10 hover:text-error"
                    aria-label={UPDATE_MODAL.closeAriaShort}>
                    <X className="h-4.5 w-4.5" />
                </button>
                {done ? <>
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                        <Check className="h-6 w-6 text-success" />
                    </div>
                    <p className="mt-3 text-fs-card font-medium text-on-surface">{UPDATE_MODAL.latest}</p>
                    <p className="mt-1 text-fs-label text-on-surface-variant">{SITE.name} v{SITE.version}</p>
                </> : <>
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-container">
                        <Loader2 className="h-6 w-6 animate-spin text-foreground" />
                    </div>
                    <p className="mt-3 text-fs-card font-medium text-on-surface">{UPDATE_MODAL.checking}</p>
                    <p className="mt-1 text-fs-label text-on-surface-variant">{UPDATE_MODAL.currentVersion} v{SITE.version}</p>
                </>}
            </div>
        </div>
    );
}

export function AppShell(
    {
        user,
        floral = true,
        children
    }: {
        user: ShellUser | null;
        floral?: boolean;
        children: React.ReactNode;
    }
) {
    const pathname = usePathname();
    const router = useRouter();
    const [menuOpen, setMenuOpen] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [modal, setModal] = useState<null | "settings" | "feedback" | "update">(null);
    const [dark, setDark] = useState(false);
    const [sidebarW, startSidebarDrag] = useDragWidth(240, 200, 400, "zjxj:sidebar-w");
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() =>
    {
        setDark(document.documentElement.classList.contains("dark"));
    }, []);

    useEffect(() =>
    {
        const close = (e: MouseEvent) =>
        {
            if (menuRef.current && !menuRef.current.contains(e.target as Node))
                setMenuOpen(false);
        };

        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, []);

    const [unread, setUnread] = useState(0);

    useEffect(() =>
    {
        if (!user || user.role !== "student")
            return;
        let alive = true;
        const load = () => fetch("/api/notifications/unread")
            .then(r => r.ok ? r.json() : null)
            .then(d => {
                if (alive && d && typeof d.unread === "number")
                    setUnread(d.unread);
            })
            .catch(() => {});
        load();
        const timer = setInterval(load, 60000);
        return () => {
            alive = false;
            clearInterval(timer);
        };
    }, [user?.id, user?.role]);

    function toggleTheme()
    {
        const next = !dark;
        setDark(next);
        document.documentElement.classList.toggle("dark", next);

        try {
            localStorage.setItem("zjxj:theme", next ? "dark" : "light");
        } catch {
            /* 隐私模式下忽略持久化失败 */
        }
    }

    async function logout()
    {
        await fetch("/api/auth/logout", {
            method: "POST"
        });

        router.push("/");
    }

    const isTeacher = user?.role === "teacher";
    const NAV = isTeacher ? NAV_TEACHER : NAV_STUDENT;
    const homeHref = isTeacher ? "/admin" : "/learning";
    const isActive = (href: string) => href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(href + "/");

    const menuItemCls = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-fs-sub font-medium text-on-surface transition-colors hover:bg-surface-container";

    const sidebarInner = (
        <>
            <div className="px-5 pb-5 pt-6">
                <Link
                    href={homeHref}
                    className="flex items-center gap-3"
                    onClick={() => setDrawerOpen(false)}>
                    <Image
                        src={SITE.logo}
                        alt={SITE.name}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-xl border-neo border-ink bg-white/95" />
                    <div className="min-w-0">
                        <p className="text-fs-section leading-tight text-sidebar-foreground">{SITE.name}</p>
                        <p className="mt-0.5 text-fs-label text-sidebar-foreground/75">v{SITE.version}</p>
                    </div>
                </Link>
            </div>
            <nav className="flex-1 space-y-1.5 overflow-y-auto px-3">
                {NAV.map(item => <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className={`flex h-11 items-center gap-3 rounded-lg px-4 text-fs-body font-medium transition-all ${isActive(item.href) ? "border-neo border-ink bg-primary text-on-primary shadow-card" : "text-sidebar-foreground hover:bg-white/30"}`}>
                    <span className="relative shrink-0">
                        <item.icon className="h-4.5 w-4.5" />
                        {item.href === "/notifications" && unread > 0 && <span
                            className="absolute -right-2.5 -top-2 flex h-[var(--size-badge)] min-w-[var(--size-badge)] items-center justify-center rounded-full border-neo border-ink bg-error px-1 text-fs-label font-medium leading-none text-white"
                            aria-label={`${unread} ${USER_MENU.unreadMessageAria}`}>
                            {unread > 99 ? "99+" : unread}
                        </span>}
                    </span>
                    {item.label}
                </Link>)}
            </nav>
            <div className="relative p-3" ref={menuRef}>
                {user ? <>
                    <button
                        type="button"
                        onClick={() => setMenuOpen(v => !v)}
                        className="flex w-full items-center gap-2.5 rounded-lg border-neo border-ink bg-white/45 px-2 py-2 transition-colors hover:bg-white/60"
                        aria-label={`${user.name} ${USER_MENU.accountMenuAria}`}>
                        <Avatar name={user.name} size={32} decorative />
                        <span className="min-w-0 flex-1 truncate text-left text-fs-sub font-medium text-sidebar-foreground">{user.name}</span>
                    </button>
                    {menuOpen && <div
                        className="absolute bottom-full left-2 right-2 z-50 mb-2 rounded-xl border-neo border-ink bg-surface p-2 shadow-float">
                        <div className="flex items-center gap-3 border-b-neo border-ink px-2 pb-2.5 pt-1.5">
                            <Avatar name={user.name} size={40} />
                            <div className="min-w-0">
                                <p className="truncate text-fs-sub font-medium text-on-surface">{user.name}</p>
                                <p className="text-fs-label text-on-surface-variant">
                                    {isTeacher ? USER_MENU.roleTeacher : [USER_MENU.roleStudent, user.className].filter(Boolean).join(" · ")}
                                </p>
                            </div>
                        </div>
                        <div className="py-1.5">
                            <button type="button" onClick={() => { setMenuOpen(false); setModal("settings"); }} className={menuItemCls}>
                                <Settings className="h-4 w-4 text-on-surface-variant" />
                                {USER_MENU.settings}
                            </button>
                            <button type="button" onClick={toggleTheme} className={menuItemCls} role="switch" aria-checked={dark}>
                                <Palette className="h-4 w-4 text-on-surface-variant" />
                                <span className="flex-1">{USER_MENU.appearance}</span>
                                <span className="text-fs-label text-on-surface-variant">{dark ? USER_MENU.themeDark : USER_MENU.themeLight}</span>
                                <span className={`relative h-5 w-9 rounded-full border-neo border-ink transition-colors ${dark ? "bg-primary" : "bg-surface-container-highest"}`}>
                                    <span className={`absolute top-0.5 h-4 w-4 rounded-full border-0 bg-ink transition-all ${dark ? "left-switch-shift" : "left-0.5"}`} />
                                </span>
                            </button>
                            <button type="button" onClick={() => { setMenuOpen(false); setModal("feedback"); }} className={menuItemCls}>
                                <MessageSquarePlus className="h-4 w-4 text-on-surface-variant" />
                                {USER_MENU.feedback}
                            </button>
                            <button type="button" onClick={() => { setMenuOpen(false); setModal("update"); }} className={menuItemCls}>
                                <RefreshCw className="h-4 w-4 text-on-surface-variant" />
                                {USER_MENU.checkUpdate}
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={logout}
                            className="flex w-full items-center gap-2.5 rounded-lg border-t-neo border-ink px-3 pb-1.5 pt-2.5 text-left text-fs-sub font-medium text-error transition-colors hover:bg-error/10">
                            <LogOut className="h-4 w-4" />
                            {USER_MENU.logout}
                        </button>
                    </div>}
                </> : <Link
                    href="/"
                    className="flex w-full items-center justify-center rounded-lg border-neo border-ink bg-primary px-3 py-2 text-fs-sub font-medium text-on-primary shadow-sm transition-colors hover:bg-primary/90">{USER_MENU.login}</Link>}
            </div>
        </>
    );

    return (
        <div
            className={floral ? "admin-floral-root min-h-screen" : "min-h-screen"}
            style={{ "--sidebar-w": `${sidebarW}px` } as React.CSSProperties}>
            {/* 桌面左侧导航栏：与内容区连通，右缘分隔条可拖动调宽 */}
            <aside className="fixed inset-y-0 left-0 z-40 hidden border-r-neo border-sidebar-border bg-sidebar lg:block" style={{ width: sidebarW }}>
                <div className="flex h-full flex-col">{sidebarInner}</div>
                <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={USER_MENU.sidebarDragAria}
                    onPointerDown={e => startSidebarDrag(e, 1)}
                    className="absolute inset-y-0 right-0 w-1.5 cursor-col-resize transition-colors hover:bg-white/30" />
            </aside>

            {/* 移动端顶栏 + 抽屉 */}
            <header className="sticky top-0 z-40 p-3 lg:hidden">
                <div className="flex h-14 items-center justify-between rounded-2xl bg-primary px-4 shadow-card">
                    <button
                        type="button"
                        onClick={() => setDrawerOpen(true)}
                        aria-label={USER_MENU.navOpenAria}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/10">
                        <Menu className="h-5 w-5" />
                    </button>
                    <Link
                        href={homeHref}
                        className="text-fs-card font-medium text-white">{SITE.name}</Link>
                    <div className="h-9 w-9" aria-hidden />
                </div>
            </header>
            {drawerOpen && <div className="fixed inset-0 z-50 lg:hidden">
                <button
                    type="button"
                    aria-label={USER_MENU.navCloseAria}
                    onClick={() => setDrawerOpen(false)}
                    className="absolute inset-0 animate-[fade-in_.2s_ease-out] cursor-default bg-black/45 backdrop-blur-sm" />
                <div className="absolute bottom-4 left-4 top-4 flex w-72 animate-[drawer-in_.25s_ease-out] flex-col rounded-xl bg-primary shadow-dialog">{sidebarInner}</div>
            </div>}

            <main className="px-6 py-8 lg:ml-(--sidebar-w)">
                <div className="mx-auto max-w-shell">{children}</div>
            </main>

            {user && <SettingsModal user={user} open={modal === "settings"} onClose={() => setModal(null)} />}
            <FeedbackModal open={modal === "feedback"} onClose={() => setModal(null)} />
            <UpdateModal open={modal === "update"} onClose={() => setModal(null)} />
        </div>
    );
}
