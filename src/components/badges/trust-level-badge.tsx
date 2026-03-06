"use client";

import {
    ShieldCheckIcon,
    SealCheckIcon,
    LightningIcon,
} from "@phosphor-icons/react";
import type { ComponentType } from "react";
import type { IconWeight } from "@phosphor-icons/react";
import { cn, getBadgeColors } from "@/lib/utils";
import { type BadgeSize, baseBadge, sizeClasses } from "./shared";

export const trustLevelConfig: Record<string, { hue: number; saturation?: number; icon: ComponentType<{ weight?: IconWeight; className?: string }> }> = {
    new:        { hue: 0,   saturation: 0, icon: ShieldCheckIcon },
    verified:   { hue: 210, icon: SealCheckIcon },
    trusted:    { hue: 150, icon: ShieldCheckIcon },
    autonomous: { hue: 270, icon: LightningIcon },
};

export function TrustLevelBadge({
    level,
    size = "default",
}: {
    level: string;
    size?: BadgeSize;
}) {
    const config = trustLevelConfig[level] ?? trustLevelConfig.new!;
    const colors = getBadgeColors(config.hue, config.saturation);
    const Icon = config.icon;

    return (
        <span
            className={cn(baseBadge, sizeClasses[size], "gap-1 capitalize")}
            style={{
                backgroundColor: colors.bg,
                color: colors.fg,
                borderColor: colors.border,
            }}
        >
            <Icon weight="bold" className="size-3" />
            {level}
        </span>
    );
}
