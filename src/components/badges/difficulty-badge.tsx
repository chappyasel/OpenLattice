"use client";

import { cn, getBadgeColors } from "@/lib/utils";
import { type BadgeSize, baseBadge, sizeClasses } from "./shared";

const difficultyConfig: Record<string, { hue: number }> = {
    beginner:     { hue: 150 },
    intermediate: { hue: 40 },
    advanced:     { hue: 0 },
};

export function DifficultyBadge({
    difficulty,
    size = "default",
}: {
    difficulty: string;
    size?: BadgeSize;
}) {
    const config = difficultyConfig[difficulty];
    const colors = config ? getBadgeColors(config.hue) : null;

    return (
        <span
            className={cn(
                baseBadge,
                sizeClasses[size],
                "capitalize",
                !colors && "bg-muted text-muted-foreground border-border",
            )}
            style={
                colors
                    ? { backgroundColor: colors.bg, color: colors.fg, borderColor: colors.border }
                    : undefined
            }
        >
            {difficulty}
        </span>
    );
}
