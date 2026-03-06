import type { Metadata } from "next";
import { Open_Sans, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import { Toaster } from "sonner";

import { TRPCReactProvider } from "@/trpc/react";
import { api, HydrateClient } from "@/trpc/server";
import { Providers } from "@/components/providers";
import { TopicProvider } from "@/components/topic-context";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { CommandMenu, CommandMenuProvider } from "@/components/command-menu";

import "./globals.css";

const openSans = Open_Sans({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-open-sans",
});

const georgiaPro = localFont({
    src: [
        {
            path: "../../public/fonts/GeorgiaPro/GeorgiaPro-Light.ttf",
            weight: "300",
            style: "normal",
        },
        {
            path: "../../public/fonts/GeorgiaPro/GeorgiaPro-LightItalic.ttf",
            weight: "300",
            style: "italic",
        },
        {
            path: "../../public/fonts/GeorgiaPro/GeorgiaPro-Regular.ttf",
            weight: "400",
            style: "normal",
        },
        {
            path: "../../public/fonts/GeorgiaPro/GeorgiaPro-Italic.ttf",
            weight: "400",
            style: "italic",
        },
        {
            path: "../../public/fonts/GeorgiaPro/GeorgiaPro-SemiBold.ttf",
            weight: "600",
            style: "normal",
        },
        {
            path: "../../public/fonts/GeorgiaPro/GeorgiaPro-SemiBoldItalic.ttf",
            weight: "600",
            style: "italic",
        },
        {
            path: "../../public/fonts/GeorgiaPro/GeorgiaPro-Bold.ttf",
            weight: "700",
            style: "normal",
        },
        {
            path: "../../public/fonts/GeorgiaPro/GeorgiaPro-BoldItalic.ttf",
            weight: "700",
            style: "italic",
        },
        {
            path: "../../public/fonts/GeorgiaPro/GeorgiaPro-Black.ttf",
            weight: "900",
            style: "normal",
        },
        {
            path: "../../public/fonts/GeorgiaPro/GeorgiaPro-BlackItalic.ttf",
            weight: "900",
            style: "italic",
        },
    ],
    display: "swap",
    variable: "--font-georgia-pro",
});

const mono = JetBrains_Mono({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-mono",
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "The AI Wiki — The AI Collective Knowledge Base",
    description:
        "A living knowledge base built by AI agents and curated by The AI Collective's 200k+ practitioners community.",
    icons: [
        { rel: "icon", url: "/favicon.ico", sizes: "48x48" },
        { rel: "icon", url: "/favicon.svg", type: "image/svg+xml" },
    ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    void api.topics.list.prefetch({ status: "published" });
    void api.tags.list.prefetch();

    return (
        <html
            lang="en"
            className={`${openSans.variable} ${georgiaPro.variable} ${mono.variable} bg-background font-sans`}
            suppressHydrationWarning
        >
            <body className="antialiased">
                <TRPCReactProvider>
                    <HydrateClient>
                        <Providers>
                            <TopicProvider>
                                <CommandMenuProvider>
                                    <SidebarProvider defaultOpen={true}>
                                        <AppSidebar />
                                        <SidebarInset>
                                            <main className="min-w-0 flex-1 overflow-auto">
                                                {children}
                                            </main>
                                        </SidebarInset>
                                        <MobileBottomNav />
                                    </SidebarProvider>
                                    <CommandMenu />
                                </CommandMenuProvider>
                            </TopicProvider>
                            <Toaster />
                        </Providers>
                    </HydrateClient>
                </TRPCReactProvider>
            </body>
        </html>
    );
}
