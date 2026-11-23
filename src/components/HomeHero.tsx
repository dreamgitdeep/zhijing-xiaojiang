"use client";
import { useState } from "react";
import { Leaf } from "lucide-react";
import { HeroMask } from "@/components/HeroMask";
import { AuthPanel } from "@/components/AuthPanel";

export interface HomeHeroCopy {
  enter: string;
}

/** 首页舞台：文案全部由父级传入（见 src/config/site.ts HOME_COPY） */
export function HomeHero({ copy }: { copy: HomeHeroCopy }) {
    const [authOpen, setAuthOpen] = useState(false);

    return (
        <main className="relative h-dvh min-h-[var(--size-hero-min)] overflow-hidden">
            <HeroMask />
            <div className="absolute bottom-[var(--inset-hero-copy)] left-1/2 z-10 -translate-x-1/2">
                <button
                    type="button"
                    onClick={() => setAuthOpen(true)}
                    className="enter-btn">
                    <Leaf className="enter-btn-leaf" aria-hidden />
                    <span>{copy.enter}</span>
                </button>
            </div>
            <AuthPanel open={authOpen} onClose={() => setAuthOpen(false)} />
        </main>
    );
}
