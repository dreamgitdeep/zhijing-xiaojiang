"use client";

import { useEffect, useRef, useState } from "react";

const HERO_BG = "/images/hero/hero-bg.webp";
const BLOOM_IMG = "/images/hero/bloom.webp";

export function HeroMask() {
    const stageRef = useRef<HTMLDivElement | null>(null);
    const layerRef = useRef<HTMLDivElement | null>(null);
    const [interacted, setInteracted] = useState(false);

    useEffect(() => {
        const stage = stageRef.current;
        const layer = layerRef.current;
        if (!stage || !layer) return;

        let raf = 0;
        let running = true;
        let px = 0.5;
        let py = 0.42;
        let tx = px;
        let ty = py;
        let following = false;
        let t = 0;

        const apply = () => {
            layer.style.setProperty("--mx", `${Math.round(px * stage.clientWidth)}px`);
            layer.style.setProperty("--my", `${Math.round(py * stage.clientHeight)}px`);
        };

        const tick = () => {
            if (!running) return;
            if (!following) {
                t += 0.006;
                tx = 0.5 + 0.34 * Math.cos(t);
                ty = 0.46 + 0.26 * Math.sin(t * 1.35);
            }
            px += (tx - px) * 0.12;
            py += (ty - py) * 0.12;
            apply();
            raf = requestAnimationFrame(tick);
        };

        const onMove = (e: PointerEvent) => {
            const rect = stage.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            if (x < 0 || x > 1 || y < 0 || y > 1) return;
            following = true;
            tx = Math.min(1, Math.max(0, x));
            ty = Math.min(1, Math.max(0, y));
            setInteracted(true);
        };
        const onLeave = () => {
            following = false;
        };

        const fine = window.matchMedia("(pointer: fine)").matches;
        if (fine) {
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerleave", onLeave);
        }

        apply();
        raf = requestAnimationFrame(tick);
        return () => {
            running = false;
            cancelAnimationFrame(raf);
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerleave", onLeave);
        };
    }, []);

    return (
        <div ref={stageRef} className="absolute inset-0 overflow-hidden">
            <div
                role="img"
                aria-label="植景小匠 · 首页底图"
                className="absolute inset-0 h-full w-full"
                style={{
                    backgroundColor: "var(--color-primary-container)",
                    backgroundImage: `url("${HERO_BG}")`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                }}
            />
            <div
                ref={layerRef}
                className="absolute inset-0"
                style={
                    {
                        "--mx": "50%",
                        "--my": "42%",
                        WebkitMaskImage: "radial-gradient(circle var(--spotlight-r) at var(--mx) var(--my), var(--neo-ink) 97%, transparent 100%)",
                        maskImage: "radial-gradient(circle var(--spotlight-r) at var(--mx) var(--my), var(--neo-ink) 97%, transparent 100%)",
                    } as React.CSSProperties
                }
            >
                <img src={BLOOM_IMG} alt="繁花植景" className="absolute inset-0 h-full w-full object-cover" />
            </div>
            <div className="absolute bottom-10 left-10 z-10 max-w-md rounded-xl border-neo border-ink bg-surface px-5 py-4 text-on-surface shadow-card">
                <p className="text-fs-sub font-medium">
                    {interacted ? "移到哪，哪里的植物就繁花似锦" : "移动鼠标，穿过社区绿化，看见繁花植景"}
                </p>
            </div>
        </div>
    );
}
