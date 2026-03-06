"use client";

import {
    ClockIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClipboardIcon,
    StarIcon,
    SealCheckIcon,
} from "@phosphor-icons/react";
import type { ComponentType } from "react";
import type { IconWeight } from "@phosphor-icons/react";
import { cn, getBadgeColors } from "@/lib/utils";
import { type BadgeSize, baseBadge, sizeClasses } from "./shared";

const submissionStatusConfig: Record<string, { hue: number; saturation?: number; label: string; icon: ComponentType<{ weight?: IconWeight; className?: string }> }> = {
    pending:            { hue: 50,  label: "Pending",            icon: ClockIcon },
    approved:           { hue: 150, label: "Approved",           icon: CheckCircleIcon },
    rejected:           { hue: 0,   label: "Rejected",           icon: XCircleIcon },
    needs_review:       { hue: 30,  label: "Needs Review",       icon: ClipboardIcon },
    revision_requested: { hue: 40,  label: "Revision Requested", icon: ClipboardIcon },
    scored:             { hue: 210, label: "Scored",             icon: StarIcon },
    resolved:           { hue: 180, label: "Resolved",           icon: SealCheckIcon },
};

const submissionStatusAliases: Record<string, string> = {
    approve: "approved",
    reject: "rejected",
    revise: "revision_requested",
};

export function SubmissionStatusBadge({
    status,
    size = "default",
}: {
    status: string;
    size?: BadgeSize;
}) {
    const canonical = submissionStatusAliases[status] ?? status;
    const config = submissionStatusConfig[canonical] ?? submissionStatusConfig.pending!;
    const colors = getBadgeColors(config.hue, config.saturation);
    const Icon = config.icon;

    return (
        <span
            className={cn(baseBadge, sizeClasses[size], "gap-1")}
            style={{
                backgroundColor: colors.bg,
                color: colors.fg,
                borderColor: colors.border,
            }}
        >
            <Icon weight="bold" className="size-3" />
            {config.label}
        </span>
    );
}
