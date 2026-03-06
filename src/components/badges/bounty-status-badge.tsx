"use client";

import { cn, getBadgeColors } from "@/lib/utils";
import { type BadgeSize, baseBadge, sizeClasses } from "./shared";

const bountyStatusConfig: Record<string, { hue: number; saturation?: number; label: string }> = {
    open:      { hue: 150, label: "Open" },
    claimed:   { hue: 40,  label: "Claimed" },
    completed: { hue: 0,   saturation: 0, label: "Completed" },
    cancelled: { hue: 0,   label: "Cancelled" },
};

export function BountyStatusBadge({
    status,
    size = "default",
}: {
    status: string;
    size?: BadgeSize;
}) {
    const config = bountyStatusConfig[status] ?? bountyStatusConfig.open!;
    const colors = getBadgeColors(config.hue, config.saturation);

    return (
        <span
            className={cn(baseBadge, sizeClasses[size])}
            style={{
                backgroundColor: colors.bg,
                color: colors.fg,
                borderColor: colors.border,
            }}
        >
            {config.label}
        </span>
    );
}
