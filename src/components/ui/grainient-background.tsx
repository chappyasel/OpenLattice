"use client";

import dynamic from "next/dynamic";

const Grainient = dynamic(() => import("@/components/reactbits/grainient"), {
  ssr: false,
});

export function GrainientBackground({
  children,
}: {
  children?: React.ReactNode;
}) {
  const overlay = (
    <div
      className="pointer-events-none fixed inset-0"
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
        color1="#f5f5f4"
        color2="#0076db"
        color3="#ff640d"
      />
    </div>
  );

  if (!children) return overlay;

  return (
    <div className="min-h-screen">
      {overlay}
      <div className="relative flex min-h-screen items-center justify-center p-4">
        {children}
      </div>
    </div>
  );
}
