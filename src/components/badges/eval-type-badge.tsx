"use client";

import { cn, getBadgeColors } from "@/lib/utils";
import { type BadgeSize, baseBadge, sizeClasses } from "./shared";

const evalTypeConfig: Record<string, { hue: number; label: string }> = {
    expansion_review: { hue: 190, label: "Expansion Review" },
    resource_score:   { hue: 210, label: "Resource Score" },
};

export function EvalTypeBadge({
    type,
    size = "default",
}: {
    type: string;
    size?: BadgeSize;
}) {
    const config = evalTypeConfig[type];
    const colors = config
        ? getBadgeColors(config.hue)
        : getBadgeColors(0, 0);

    return (
        <span
            className={cn(baseBadge, sizeClasses[size])}
            style={{
                backgroundColor: colors.bg,
                color: colors.fg,
                borderColor: colors.border,
            }}
        >
            {config?.label ?? type}
        </span>
    );
}
