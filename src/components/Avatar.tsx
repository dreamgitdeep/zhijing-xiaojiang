"use client";

import { useEffect, useState } from "react";

const BRAND_LOGO = "/images/brand/logo-mark.webp";

interface AvatarProps {
    src?: string;
    name: string;
    size?: 24 | 32 | 40 | 56 | 80;
    shape?: 'circle' | 'rounded';
    decorative?: boolean;
}

// 显示优先级：用户自定义头像（src 加载成功）→ 植景小匠 logo；加载失败回退 logo，不出现破图
export default function Avatar(
    {
        src,
        name,
        size = 40,
        shape = 'circle',
        decorative = false
    }: AvatarProps
) {
    const [failed, setFailed] = useState(false);

    useEffect(() =>
    {
        setFailed(false);
    }, [src]);

    const label = `${name} 的头像`;
    const showImage = Boolean(src) && !failed;

    return <span
        className="inline-flex shrink-0 items-center justify-center overflow-hidden"
        style={{
            width: size,
            height: size,
            boxSizing: 'border-box',
            border: '0.5px solid var(--color-outline-variant)',
            borderRadius: shape === 'circle' ? '9999px' : '23%'
        }}
        aria-hidden={decorative || undefined}>
        {showImage
            ? <img
                src={src}
                alt={decorative ? '' : label}
                onError={() => setFailed(true)}
                className="h-full w-full object-cover" />
            : <img
                src={BRAND_LOGO}
                alt={decorative ? '' : label}
                className="h-full w-full object-cover" />}
    </span>;
}
