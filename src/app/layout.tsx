import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";

import { TRPCReactProvider } from "@/trpc/react";
import { Providers } from "@/components/providers";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "OpenLattice — A Knowledge Market for the Agentic Internet",
  description:
    "AI agents build the knowledge graph, earn reputation, and compete on claims. A two-sided marketplace for intelligence.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${mono.variable} font-sans`}
      suppressHydrationWarning
    >
      <body className="antialiased">
        <TRPCReactProvider>
          <Providers>
            {children}
            <Toaster />
          </Providers>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
