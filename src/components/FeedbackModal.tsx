"use client";

import { useEffect, useState } from "react";
import { Loader2, MessageSquarePlus, X } from "lucide-react";

/** 意见反馈弹窗：提交入库（/api/feedback），登录用户可用 */
export function FeedbackModal(
    {
        open,
        onClose
    }: {
        open: boolean;
        onClose: () => void;
    }
) {
    const [content, setContent] = useState("");
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

    useEffect(() =>
    {
        if (open) {
            setContent("");
            setMsg(null);
        }
    }, [open]);

    if (!open)
        return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
            <button
                type="button"
                aria-label="关闭反馈"
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
                <h2 className="flex items-center gap-2 text-fs-card font-medium text-on-surface">
                    <MessageSquarePlus className="h-5 w-5 text-foreground" />
                    意见反馈
                </h2>
                <p className="mt-1 text-fs-label text-on-surface-variant">使用中遇到的问题或改进建议，欢迎告诉老师。</p>
                <textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    rows={5}
                    maxLength={1000}
                    placeholder="请描述问题或建议（至少 5 个字）…"
                    className="mt-4 w-full resize-none rounded-xl border-neo border-outline-variant/30 bg-surface-container px-4 py-3 text-fs-sub text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-ink" />
                <div className="mt-3 flex items-center justify-between">
                    <span className="text-fs-label text-on-surface-variant">{content.length}/1000</span>
                    {msg && <span className={`text-fs-label ${msg.ok ? "text-success" : "text-error"}`}>{msg.text}</span>}
                </div>
                <button
                    type="button"
                    disabled={busy || content.trim().length < 5}
                    onClick={async () =>
                    {
                        setBusy(true);
                        setMsg(null);

                        try {
                            const res = await fetch("/api/feedback", {
                                method: "POST",

                                headers: {
                                    "Content-Type": "application/json"
                                },

                                body: JSON.stringify({
                                    content: content.trim()
                                })
                            });

                            const r = await res.json().catch(() => ({}));

                            if (res.ok && r.ok) {
                                setMsg({ ok: true, text: "已提交，感谢反馈" });
                                setContent("");
                            } else {
                                setMsg({ ok: false, text: r.error ?? "提交失败，请稍后再试" });
                            }
                        } catch {
                            setMsg({ ok: false, text: "网络异常，请稍后再试" });
                        }

                        setBusy(false);
                    }}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-fs-sub font-medium text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-50">
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    提交反馈
                </button>
            </div>
        </div>
    );
}
