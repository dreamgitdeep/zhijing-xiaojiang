"use client";

import { useEffect, useState, type FormEvent } from "react";
import { BookMarked, Eye, EyeOff, GraduationCap, KeyRound, Loader2, X } from "lucide-react";
import type { AuthResult } from "@/lib/auth-service";
import { AUTH_COPY } from "@/config/auth-copy";

const inputCls =
    "w-full rounded-lg border-neo border-ink bg-surface px-4 py-3 text-fs-sub text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2";

interface AuthPanelProps {
    open: boolean;
    onClose: () => void;
}

export function AuthPanel({ open, onClose }: AuthPanelProps) {
    const [tab, setTab] = useState<"login" | "register">("login");
    const [role, setRole] = useState<"student" | "teacher">("student");
    const [showPassword, setShowPassword] = useState(false);
    const [showReset, setShowReset] = useState(false);
    const [loginState, setLoginState] = useState<AuthResult>({});
    const [registerState, setRegisterState] = useState<AuthResult>({});
    const [resetState, setResetState] = useState<AuthResult>({});
    const [loginPending, setLoginPending] = useState(false);
    const [registerPending, setRegisterPending] = useState(false);
    const [resetPending, setResetPending] = useState(false);

    async function postAuth(url: string, payload: Record<string, unknown>): Promise<AuthResult> {
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            return (await res.json()) as AuthResult;
        } catch {
            return { error: AUTH_COPY.networkError };
        }
    }

    async function submitLogin(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setLoginPending(true);
        const result = await postAuth("/api/auth/login", {
            identifier: fd.get("identifier"),
            password: fd.get("password"),
            remember: fd.get("remember") !== null
        }).finally(() => setLoginPending(false));
        setLoginState(result);
        if (result.ok) location.href = result.role === "teacher" ? "/admin" : "/learning";
    }

    async function submitRegister(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setRegisterPending(true);
        const result = await postAuth("/api/auth/register", {
            role: fd.get("role"),
            name: fd.get("name"),
            email: fd.get("email"),
            password: fd.get("password"),
            account: fd.get("account") ?? undefined,
            studentNo: fd.get("studentNo") ?? undefined,
            classCode: fd.get("classCode") ?? undefined,
            inviteCode: fd.get("inviteCode") ?? undefined
        }).finally(() => setRegisterPending(false));
        setRegisterState(result);
        if (result.ok) location.href = result.role === "teacher" ? "/admin" : "/learning";
    }

    async function submitReset(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setResetPending(true);
        const result = await postAuth("/api/auth/reset", {
            identifier: fd.get("identifier"),
            code: fd.get("code"),
            password: fd.get("password")
        }).finally(() => setResetPending(false));
        setResetState(result);
    }

    useEffect(() => {
        if (!open) {
            setTab("login");
            setShowReset(false);
        }
    }, [open]);

    useEffect(() => {
        if (resetState.ok) {
            const t = setTimeout(() => setShowReset(false), 1600);
            return () => clearTimeout(t);
        }
    }, [resetState]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
            <button
                type="button"
                aria-label={AUTH_COPY.closeAria}
                onClick={onClose}
                className="absolute inset-0 animate-[fade-in_.2s_ease-out] cursor-default bg-black/45"
            />
            <div className="relative w-[var(--size-modal-sm)] max-w-full animate-[rise-in_.3s_ease-out] rounded-2xl bg-surface p-8 shadow-dialog">
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border-neo border-ink bg-surface-container-high text-on-surface transition-colors hover:bg-error/10 hover:text-error"
                    aria-label={AUTH_COPY.closeAria}
                >
                    <X className="h-4.5 w-4.5" />
                </button>

                <div className="mt-4 grid grid-cols-2 rounded-lg border-neo border-ink bg-surface-container p-1">
                    {(["login", "register"] as const).map(key => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setTab(key)}
                            className={`rounded-md px-4 py-2 text-fs-sub font-medium transition-all ${
                                tab === key
                                    ? "bg-primary text-on-primary shadow-card"
                                    : "text-on-surface-variant hover:text-on-surface"
                            }`}
                        >
                            {key === "login" ? AUTH_COPY.tabs.login : AUTH_COPY.tabs.register}
                        </button>
                    ))}
                </div>

                {tab === "login" ? (
                    <form onSubmit={submitLogin} className="mt-7 space-y-4">
                        <div>
                            <label htmlFor="login-identifier" className="mb-1.5 block text-fs-sub font-medium text-on-surface">
                                {AUTH_COPY.login.identifierLabel}
                            </label>
                            <input
                                id="login-identifier"
                                name="identifier"
                                required
                                autoComplete="username"
                                placeholder={AUTH_COPY.login.identifierPlaceholder}
                                className={inputCls}
                            />
                        </div>
                        <div>
                            <label htmlFor="login-password" className="mb-1.5 block text-fs-sub font-medium text-on-surface">
                                {AUTH_COPY.login.passwordLabel}
                            </label>
                            <div className="relative">
                                <input
                                    id="login-password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    autoComplete="current-password"
                                    placeholder={AUTH_COPY.login.passwordPlaceholder}
                                    className={`${inputCls} pr-11`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 transition-colors hover:text-on-surface-variant"
                                    aria-label={showPassword ? AUTH_COPY.login.hidePasswordAria : AUTH_COPY.login.showPasswordAria}
                                >
                                    {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center justify-between text-fs-sub">
                            <label className="flex cursor-pointer items-center gap-2 text-on-surface-variant">
                                <input type="checkbox" name="remember" className="h-4 w-4 rounded accent-primary" defaultChecked />
                                {AUTH_COPY.login.remember}
                            </label>
                            <button
                                type="button"
                                onClick={() => setShowReset(true)}
                                className="text-on-surface-variant transition-colors hover:text-foreground"
                            >
                                {AUTH_COPY.login.forgot}
                            </button>
                        </div>
                        {loginState.error && (
                            <p className="rounded-lg bg-error/10 px-3 py-2 text-fs-sub text-error">{loginState.error}</p>
                        )}
                        <button
                            type="submit"
                            disabled={loginPending}
                            className="w-full rounded-lg border-neo border-ink bg-primary py-3 text-fs-sub font-medium text-on-primary shadow-card transition-opacity hover:opacity-90 disabled:opacity-60"
                        >
                            {loginPending ? (
                                <Loader2 className="mx-auto h-4.5 w-4.5 animate-spin" />
                            ) : (
                                AUTH_COPY.login.submit
                            )}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={submitRegister} className="mt-7 space-y-4" key={role}>
                        <div>
                            <p className="mb-1.5 text-fs-sub font-medium text-on-surface">{AUTH_COPY.roles.title}</p>
                            <div className="grid grid-cols-2 gap-2">
                                {([
                                    { value: "student", label: AUTH_COPY.roles.student.label, icon: GraduationCap, hint: AUTH_COPY.roles.student.hint },
                                    { value: "teacher", label: AUTH_COPY.roles.teacher.label, icon: BookMarked, hint: AUTH_COPY.roles.teacher.hint }
                                ] as const).map(item => (
                                    <label
                                        key={item.value}
                                        className={`flex cursor-pointer items-center gap-2.5 rounded-lg border-neo px-3 py-2.5 transition-all ${
                                            role === item.value
                                                ? "border-primary bg-primary/5"
                                                : "border-outline-variant/30 bg-surface-container hover:border-outline-variant"
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="role"
                                            value={item.value}
                                            checked={role === item.value}
                                            onChange={() => setRole(item.value)}
                                            className="sr-only"
                                        />
                                        <item.icon
                                            className={`h-4.5 w-4.5 ${role === item.value ? "text-foreground" : "text-on-surface-variant"}`}
                                        />
                                        <span className="leading-tight">
                                            <span
                                                className={`block text-fs-sub font-medium ${
                                                    role === item.value ? "text-foreground" : "text-on-surface"
                                                }`}
                                            >
                                                {item.label}
                                            </span>
                                            <span className="block text-fs-label text-on-surface-variant">{item.hint}</span>
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label htmlFor="reg-name" className="mb-1.5 block text-fs-sub font-medium text-on-surface">
                                {AUTH_COPY.register.nameLabel}
                            </label>
                            <input id="reg-name" name="name" required placeholder={AUTH_COPY.register.namePlaceholder} className={inputCls} />
                        </div>
                        {role === "student" ? (
                            <>
                                <div>
                                    <label htmlFor="reg-student-no" className="mb-1.5 block text-fs-sub font-medium text-on-surface">
                                        {AUTH_COPY.register.studentNoLabel}
                                    </label>
                                    <input
                                        id="reg-student-no"
                                        name="studentNo"
                                        required
                                        placeholder={AUTH_COPY.register.studentNoPlaceholder}
                                        className={inputCls}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="reg-class-code" className="mb-1.5 block text-fs-sub font-medium text-on-surface">
                                        {AUTH_COPY.register.classCodeLabel} <span className="font-normal text-on-surface-variant">{AUTH_COPY.register.classCodeOptional}</span>
                                    </label>
                                    <input
                                        id="reg-class-code"
                                        name="classCode"
                                        placeholder={AUTH_COPY.register.classCodePlaceholder}
                                        className={inputCls}
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <div>
                                    <label htmlFor="reg-account" className="mb-1.5 block text-fs-sub font-medium text-on-surface">
                                        {AUTH_COPY.register.accountLabel}
                                    </label>
                                    <input
                                        id="reg-account"
                                        name="account"
                                        required
                                        placeholder={AUTH_COPY.register.accountPlaceholder}
                                        className={inputCls}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="reg-invite-code" className="mb-1.5 block text-fs-sub font-medium text-on-surface">
                                        {AUTH_COPY.register.inviteCodeLabel}
                                    </label>
                                    <input
                                        id="reg-invite-code"
                                        name="inviteCode"
                                        required
                                        placeholder={AUTH_COPY.register.inviteCodePlaceholder}
                                        className={inputCls}
                                    />
                                </div>
                            </>
                        )}
                        <div>
                            <label htmlFor="reg-email" className="mb-1.5 block text-fs-sub font-medium text-on-surface">
                                {AUTH_COPY.register.emailLabel}
                            </label>
                            <input
                                id="reg-email"
                                name="email"
                                type="email"
                                required
                                placeholder={AUTH_COPY.register.emailPlaceholder}
                                className={inputCls}
                            />
                        </div>
                        <div>
                            <label htmlFor="reg-password" className="mb-1.5 block text-fs-sub font-medium text-on-surface">
                                {AUTH_COPY.register.passwordLabel}
                            </label>
                            <input
                                id="reg-password"
                                name="password"
                                type="password"
                                required
                                minLength={6}
                                autoComplete="new-password"
                                placeholder={AUTH_COPY.register.passwordPlaceholder}
                                className={inputCls}
                            />
                        </div>
                        {registerState.error && (
                            <p className="rounded-lg bg-error/10 px-3 py-2 text-fs-sub text-error">{registerState.error}</p>
                        )}
                        <button
                            type="submit"
                            disabled={registerPending}
                            className="w-full rounded-lg border-neo border-ink bg-primary py-3 text-fs-sub font-medium text-on-primary shadow-card transition-opacity hover:opacity-90 disabled:opacity-60"
                        >
                            {registerPending ? (
                                <Loader2 className="mx-auto h-4.5 w-4.5 animate-spin" />
                            ) : (
                                AUTH_COPY.register.submit
                            )}
                        </button>
                    </form>
                )}

                <p className="mt-5 text-center text-fs-label text-on-surface-variant/70">
                    {tab === "login" ? AUTH_COPY.agreement.login : AUTH_COPY.agreement.register}
                </p>
            </div>

            {showReset && (
                <div className="absolute inset-0 z-10 flex items-center justify-center p-5">
                    <button
                        type="button"
                        aria-label={AUTH_COPY.closeAria}
                        onClick={() => setShowReset(false)}
                        className="absolute inset-0 animate-[fade-in_.2s_ease-out] cursor-default bg-black/45"
                    />
                    <div className="relative w-[var(--size-pane-md)] max-w-full animate-[rise-in_.3s_ease-out] rounded-2xl bg-surface p-8 shadow-dialog">
                        <button
                            type="button"
                            onClick={() => setShowReset(false)}
                            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
                            aria-label={AUTH_COPY.closeAria}
                        >
                            <X className="h-4.5 w-4.5" />
                        </button>
                        <div className="mb-5 flex items-center gap-2.5">
                            <span className="flex h-10 w-10 items-center justify-center rounded-lg border-neo border-ink bg-primary text-on-primary">
                                <KeyRound className="h-5 w-5" />
                            </span>
                            <div>
                                <h3 className="text-fs-card font-medium text-on-surface">{AUTH_COPY.reset.title}</h3>
                                <p className="text-fs-label text-on-surface-variant">{AUTH_COPY.reset.subtitle}</p>
                            </div>
                        </div>
                        {resetState.ok ? (
                            <p className="rounded-lg bg-success/10 px-4 py-3 text-fs-sub text-success">
                                {AUTH_COPY.reset.success}
                            </p>
                        ) : (
                            <form onSubmit={submitReset} className="space-y-4">
                                <div>
                                    <label htmlFor="reset-identifier" className="mb-1.5 block text-fs-sub font-medium text-on-surface">
                                        {AUTH_COPY.reset.identifierLabel}
                                    </label>
                                    <input id="reset-identifier" name="identifier" required placeholder={AUTH_COPY.reset.identifierPlaceholder} className={inputCls} />
                                </div>
                                <div>
                                    <label htmlFor="reset-code" className="mb-1.5 block text-fs-sub font-medium text-on-surface">
                                {AUTH_COPY.reset.codeLabel}
                                    </label>
                                    <input id="reset-code" name="code" required placeholder={AUTH_COPY.reset.codePlaceholder} className={inputCls} />
                                    <p className="mt-1.5 text-fs-label text-on-surface-variant">
                                        {AUTH_COPY.reset.codeHint}
                                    </p>
                                </div>
                                <div>
                                    <label htmlFor="reset-password" className="mb-1.5 block text-fs-sub font-medium text-on-surface">
                                        {AUTH_COPY.reset.passwordLabel}
                                    </label>
                                    <input
                                        id="reset-password"
                                        name="password"
                                        type="password"
                                        required
                                        minLength={6}
                                        autoComplete="new-password"
                                        placeholder={AUTH_COPY.reset.passwordPlaceholder}
                                        className={inputCls}
                                    />
                                </div>
                                {resetState.error && (
                                    <p className="rounded-lg bg-error/10 px-3 py-2 text-fs-sub text-error">{resetState.error}</p>
                                )}
                                <button
                                    type="submit"
                                    disabled={resetPending}
                                    className="w-full rounded-lg border-neo border-ink bg-primary py-3 text-fs-sub font-medium text-on-primary shadow-card transition-opacity hover:opacity-90 disabled:opacity-60"
                                >
                                    {resetPending ? <Loader2 className="mx-auto h-4.5 w-4.5 animate-spin" /> : AUTH_COPY.reset.submit}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
