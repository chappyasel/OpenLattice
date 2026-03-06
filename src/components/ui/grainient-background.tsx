"use client";

import { useTheme } from "next-themes";
import Grainient from "@/components/reactbits/grainient";

export function GrainientBackground() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0"
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
