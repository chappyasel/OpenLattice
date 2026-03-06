"use client";

import { cn } from "@/lib/utils";
import { TopicIcon } from "@/components/topic-icon";
import { type BadgeSize, baseBadge, sizeClasses } from "./shared";

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
                "max-w-full gap-1.5 border-border/50 bg-muted text-muted-foreground pl-0.5 cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground",
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
            <span className="truncate">{tag.name}</span>
        </span>
    );
}
