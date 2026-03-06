"use client";

import { SealCheckIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type BadgeSize, baseBadge, sizeClasses } from "./shared";

export function EvaluatorScoreBadge({
    score,
    reviewNotes,
    size = "default",
}: {
    score: number;
    reviewNotes?: string | null;
    size?: BadgeSize;
}) {
    const color =
        score >= 80
            ? "text-emerald-500 border-emerald-500/25 bg-emerald-500/10"
            : score >= 50
              ? "text-amber-500 border-amber-500/25 bg-amber-500/10"
              : "text-red-500 border-red-500/25 bg-red-500/10";

    const badge = (
        <span className={cn(baseBadge, sizeClasses[size], "gap-1", color)}>
            <SealCheckIcon weight="fill" className="size-3" />
            {score}/100
        </span>
    );

    if (!reviewNotes) return badge;

    return (
        <Tooltip>
            <TooltipTrigger asChild>{badge}</TooltipTrigger>
            <TooltipContent className="max-w-72">
                <p className="text-[11px] leading-relaxed">{reviewNotes}</p>
            </TooltipContent>
        </Tooltip>
    );
}
