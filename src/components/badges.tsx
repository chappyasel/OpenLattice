"use client";

import Link from "next/link";
import { RobotIcon, UserIcon, SealCheckIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { TopicIcon } from "@/components/topic-icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type BadgeSize = "sm" | "default";

const sizeClasses: Record<BadgeSize, string> = {
    sm: "px-2.5 py-0.5 text-[11px]",
    default: "px-3 py-0.5 text-xs",
};

const baseBadge = "inline-flex items-center rounded-full border font-semibold";

export function DifficultyBadge({
    difficulty,
    size = "default",
}: {
    difficulty: string;
    size?: BadgeSize;
}) {
    const colors: Record<string, string> = {
        beginner: "bg-emerald-500/15 text-emerald-600 border-emerald-500/25 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20",
        intermediate: "bg-amber-500/15 text-amber-600 border-amber-500/25 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/20",
        advanced: "bg-red-500/15 text-red-600 border-red-500/25 dark:text-red-400 dark:bg-red-500/10 dark:border-red-500/20",
    };
    return (
        <span
            className={cn(
                baseBadge,
                sizeClasses[size],
                "capitalize",
                colors[difficulty] ?? "bg-muted text-muted-foreground border-border",
            )}
        >
            {difficulty}
        </span>
    );
}

export function TagBadge({
    tag,
    size = "default",
}: {
    tag: { name: string; icon?: string | null; iconHue?: number | null };
    size?: BadgeSize;
}) {
    return (
        <span
            className={cn(
                baseBadge,
                sizeClasses[size],
                "gap-1.5 border-border/50 bg-muted text-muted-foreground pl-0.5",
            )}
        >
            {tag.icon && (
                <span
                    className="inline-flex items-center justify-center rounded-full p-px"
                    style={
                        tag.iconHue != null
                            ? ({
                                  "--icon-bg": `hsl(${tag.iconHue} 80% 92%)`,
                                  "--icon-bg-dark": `hsl(${tag.iconHue} 50% 18%)`,
                                  "--icon-fg": `hsl(${tag.iconHue} 70% 45%)`,
                                  "--icon-fg-dark": `hsl(${tag.iconHue} 70% 72%)`,
                                  backgroundColor: "var(--icon-bg)",
                                  color: "var(--icon-fg)",
                              } as React.CSSProperties)
                            : undefined
                    }
                >
                    <TopicIcon
                        icon={tag.icon}
                        hue={tag.iconHue}
                        size="sm"
                        className="!bg-transparent"
                    />
                </span>
            )}
            {tag.name}
        </span>
    );
}

export function ResourceTypeBadge({ type, size = "default" }: { type: string; size?: BadgeSize }) {
    const colors: Record<string, string> = {
        paper: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        article: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
        video: "bg-red-500/10 text-red-400 border-red-500/20",
        tool: "bg-purple-500/10 text-purple-400 border-purple-500/20",
        course: "bg-orange-500/10 text-orange-400 border-orange-500/20",
        dataset: "bg-green-500/10 text-green-400 border-green-500/20",
        other: "bg-muted text-muted-foreground border-border",
    };
    return (
        <span
            className={cn(baseBadge, sizeClasses[size], "capitalize", colors[type] ?? colors.other)}
        >
            {type}
        </span>
    );
}

interface ContributorData {
    id: string;
    name: string;
    isAgent: boolean;
    agentModel?: string | null;
    trustLevel: string;
    karma: number;
    totalContributions: number;
    acceptedContributions: number;
}

const trustColors: Record<string, string> = {
    new: "text-zinc-400",
    verified: "text-blue-400",
    trusted: "text-emerald-400",
    autonomous: "text-purple-400",
};

export function ContributorBadge({
    contributor,
    size = "default",
}: {
    contributor: ContributorData;
    size?: BadgeSize;
}) {
    const Icon = contributor.isAgent ? RobotIcon : UserIcon;
    const rate =
        contributor.totalContributions > 0
            ? Math.round(
                  (contributor.acceptedContributions /
                      contributor.totalContributions) *
                      100,
              )
            : null;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Link
                    href={`/agents/${contributor.id}`}
                    className={cn(
                        baseBadge,
                        sizeClasses[size],
                        "gap-1 border-border/50 bg-muted/60 text-muted-foreground hover:bg-muted transition-colors cursor-pointer",
                    )}
                >
                    <Icon weight="bold" className="size-3" />
                    {contributor.name}
                </Link>
            </TooltipTrigger>
            <TooltipContent className="max-w-56">
                <div className="flex flex-col gap-1 py-0.5">
                    {contributor.agentModel && (
                        <p className="text-[11px] text-muted-foreground">
                            {contributor.agentModel}
                        </p>
                    )}
                    <div className="flex items-center gap-2 text-[11px]">
                        <span className={cn("capitalize font-medium", trustColors[contributor.trustLevel])}>
                            {contributor.trustLevel}
                        </span>
                        <span>{contributor.karma} karma</span>
                        {rate !== null && <span>{rate}% accepted</span>}
                    </div>
                </div>
            </TooltipContent>
        </Tooltip>
    );
}

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
