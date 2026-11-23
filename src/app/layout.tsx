import type { Metadata } from "next";
import { Noto_Sans_SC, Space_Grotesk } from "next/font/google";
import { Inspector } from "react-dev-inspector";
import "./globals.css";

const grotesk = Space_Grotesk({
    subsets: ["latin"],
    weight: ["400", "500", "700"],
    variable: "--font-grotesk",
    display: "swap"
});

const notoSans = Noto_Sans_SC({
    subsets: ["latin"],
    weight: ["400", "500", "700", "900"],
    variable: "--font-noto",
    display: "swap"
});

export const metadata: Metadata = {
    title: {
        default: "植景小匠 · 植物造景",
        template: "%s | 植景小匠"
    },
    description: "植景小匠 —— 上海农林职业学院《植物造景》课程教学应用：植物图鉴、练习与智能问答。"
};

export default function RootLayout(
    {
        children
    }: Readonly<{
        children: React.ReactNode;
    }>
) {
    const isDev = process.env.COZE_PROJECT_ENV === "DEV";

    return (
        <html lang="zh-CN" className={`${grotesk.variable} ${notoSans.variable}`} suppressHydrationWarning>
            <head>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `try{if(localStorage.getItem("zjxj:theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}`
                    }} />
            </head>
            <body className="min-h-screen antialiased">
                {isDev && <Inspector />}
                {children}
            </body>
        </html>
    );
}
