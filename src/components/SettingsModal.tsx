"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { SessionUser } from "@/lib/auth";

const inputCls =
    "h-9 w-full rounded-lg border-neo border-outline-variant/30 bg-surface-container px-3 text-fs-label text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-ink";

/** 账号设置弹窗：资料编辑（学号/邮箱/班级 或 教师账号展示）+ 修改密码，自顶栏账号菜单打开 */
export function SettingsModal(
    {
        user,
        open,
        onClose
    }: {
        user: SessionUser;
        open: boolean;
        onClose: () => void;
    }
) {
    const isTeacher = user.role === "teacher";
    const [editStudentNo, setEditStudentNo] = useState<string | null>(null);
    const [editEmail, setEditEmail] = useState<string | null>(null);
    const [editClassCode, setEditClassCode] = useState<string | null>(null);
    const valStudentNo = editStudentNo ?? user.studentNo ?? "";
    const valEmail = editEmail ?? user.contactEmail ?? "";
    const valClassCode = editClassCode ?? user.classCode ?? "";
    const [profileBusy, setProfileBusy] = useState(false);
    const [profileMsg, setProfileMsg] = useState("");
    const [curPwd, setCurPwd] = useState("");
    const [newPwd, setNewPwd] = useState("");
    const [pwdBusy, setPwdBusy] = useState(false);
    const [pwdMsg, setPwdMsg] = useState("");

    useEffect(() =>
    {
        if (open) {
            setProfileMsg("");
            setPwdMsg("");
        }
    }, [open]);

    if (!open)
        return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
            <button
                type="button"
                aria-label="关闭设置"
                onClick={onClose}
                className="absolute inset-0 animate-[fade-in_.2s_ease-out] cursor-default bg-black/45 backdrop-blur-sm" />
            <div className="relative w-[var(--size-modal-sm)] max-w-full animate-[rise-in_.3s_ease-out] rounded-2xl bg-surface p-7 shadow-dialog">
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-high text-on-surface transition-colors hover:bg-error/10 hover:text-error"
                    aria-label="关闭">
                    <X className="h-4.5 w-4.5" />
                </button>
                <h2 className="text-fs-card font-medium text-on-surface">账号设置</h2>

                <div className="mt-5 space-y-3">
                    <p className="text-fs-label font-medium text-on-surface-variant">基本资料</p>
                    {isTeacher ? <div className="flex justify-between gap-2 text-fs-label">
                        <span className="shrink-0 text-on-surface-variant">教师账号</span>
                        <span className="truncate font-medium text-on-surface">{user.account || "—"}</span>
                    </div> : <label className="flex items-center justify-between gap-2 text-fs-label">
                        <span className="shrink-0 text-on-surface-variant">学号</span>
                        <input
                            value={valStudentNo}
                            onChange={e => setEditStudentNo(e.target.value)}
                            className={`${inputCls} max-w-[var(--size-text-cap)] text-right`} />
                    </label>}
                    <label className="flex items-center justify-between gap-2 text-fs-label">
                        <span className="shrink-0 text-on-surface-variant">绑定邮箱</span>
                        <input
                            value={valEmail}
                            onChange={e => setEditEmail(e.target.value)}
                            placeholder="未绑定"
                            className={`${inputCls} max-w-[var(--size-text-cap)] text-right`} />
                    </label>
                    {!isTeacher && <label className="flex items-center justify-between gap-2 text-fs-label">
                        <span className="shrink-0 text-on-surface-variant">班级邀请码</span>
                        <input
                            value={valClassCode}
                            onChange={e => setEditClassCode(e.target.value)}
                            placeholder="未填写"
                            className={`${inputCls} max-w-[var(--size-text-cap)] text-right`} />
                    </label>}
                    <div className="flex items-center justify-end gap-2">
                        {profileMsg && <span
                            className={`text-fs-label ${profileMsg === "ok" ? "text-success" : "text-error"}`}>
                            {profileMsg === "ok" ? "已保存" : profileMsg}
                        </span>}
                        <button
                            type="button"
                            disabled={profileBusy}
                            onClick={async () =>
                            {
                                setProfileBusy(true);
                                setProfileMsg("");

                                const res = await fetch("/api/auth/profile", {
                                    method: "POST",

                                    headers: {
                                        "Content-Type": "application/json"
                                    },

                                    body: JSON.stringify({
                                        studentNo: valStudentNo.trim(),
                                        contactEmail: valEmail.trim(),
                                        classCode: valClassCode.trim()
                                    })
                                });

                                const r = await res.json();
                                setProfileBusy(false);

                                if (r.ok) {
                                    setProfileMsg("ok");
                                    setTimeout(() => location.reload(), 600);
                                } else {
                                    setProfileMsg(r.error ?? "保存失败");
                                }
                            }}
                            className="rounded-lg bg-primary px-3 py-1.5 text-fs-label font-medium text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-50">保存修改</button>
                    </div>
                </div>

                <div className="mt-6 border-t-neo border-outline-variant/20 pt-5">
                    <p className="mb-2 text-fs-label font-medium text-on-surface-variant">修改密码</p>
                    <div className="space-y-2">
                        <input
                            type="password"
                            value={curPwd}
                            onChange={e => setCurPwd(e.target.value)}
                            placeholder="当前密码"
                            className={inputCls} />
                        <div className="flex gap-2">
                            <input
                                type="password"
                                value={newPwd}
                                onChange={e => setNewPwd(e.target.value)}
                                placeholder="新密码（至少 6 位）"
                                className={`${inputCls} min-w-0 flex-1`} />
                            <button
                                type="button"
                                disabled={pwdBusy}
                                onClick={async () =>
                                {
                                    setPwdBusy(true);
                                    setPwdMsg("");

                                    const res = await fetch("/api/auth/password", {
                                        method: "POST",

                                        headers: {
                                            "Content-Type": "application/json"
                                        },

                                        body: JSON.stringify({
                                            currentPassword: curPwd,
                                            password: newPwd.trim()
                                        })
                                    });

                                    const r = await res.json();
                                    setPwdBusy(false);

                                    if (r.ok) {
                                        setPwdMsg("ok");
                                        setNewPwd("");
                                        setCurPwd("");
                                    } else {
                                        setPwdMsg(r.error ?? "修改失败");
                                    }
                                }}
                                className="shrink-0 rounded-lg bg-primary px-3 text-fs-label font-medium text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-50">保存</button>
                        </div>
                    </div>
                    {pwdMsg && <p
                        className={`mt-1.5 text-fs-label ${pwdMsg === "ok" ? "text-success" : "text-error"}`}>
                        {pwdMsg === "ok" ? "密码已修改，下次登录使用新密码" : pwdMsg}
                    </p>}
                </div>
            </div>
        </div>
    );
}
