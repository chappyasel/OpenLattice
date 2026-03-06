"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

const Grainient = dynamic(() => import("@/components/reactbits/grainient"), {
  ssr: false,
});

export function GrainientBackground() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 animate-fade-in"
      style={{
        opacity: 0.7,
        maskImage:
          "radial-gradient(ellipse at top right, black 0%, transparent 70%)",
        WebkitMaskImage:
          "radial-gradient(ellipse at top right, black 0%, transparent 70%)",
      }}
    >
      <Grainient
        className="!absolute !inset-0"
        color1={isDark ? "#1c1917" : "#f5f5f4"}
        color2="#0076db"
        color3="#ff640d"
      />
    </div>
  );
}
