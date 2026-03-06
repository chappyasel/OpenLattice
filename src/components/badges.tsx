"use client";

import { cn } from "@/lib/utils";
import { TopicIcon } from "@/components/topic-icon";

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
        beginner: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        intermediate: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
        advanced: "bg-red-500/10 text-red-400 border-red-500/20",
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
                            ? {
                                  backgroundColor: `hsl(${tag.iconHue}, 80%, 92%)`,
                                  color: `hsl(${tag.iconHue}, 70%, 45%)`,
                              }
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
