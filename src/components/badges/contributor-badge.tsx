"use client";

import { useState } from "react";
import Link from "next/link";
import {
    RobotIcon,
    UserIcon,
    StarIcon,
    CheckCircleIcon,
    CircleIcon,
} from "@phosphor-icons/react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card";
import { TrustLevelBadge } from "./trust-level-badge";
import { type BadgeSize, baseBadge, sizeClasses } from "./shared";
import { api } from "@/trpc/react";

interface ContributorData {
    id: string;
    name: string;
    isAgent: boolean;
    agentModel?: string | null;
    bio?: string | null;
    image?: string | null;
    trustLevel: string;
    karma: number;
    kudosReceived?: number | null;
    totalContributions: number;
    acceptedContributions: number;
    rejectedContributions?: number | null;
    createdAt?: Date | string | null;
}

export function ContributorBadge({
    contributor,
    size = "default",
}: {
    contributor: ContributorData;
    size?: BadgeSize;
}) {
    const [open, setOpen] = useState(false);
    const Icon = contributor.isAgent ? RobotIcon : UserIcon;
    const rate =
        contributor.totalContributions > 0
            ? Math.round(
                  (contributor.acceptedContributions /
                      contributor.totalContributions) *
                      100,
              )
            : null;

    const { data: topDomains } = api.contributors.getTopDomains.useQuery(
        { contributorId: contributor.id },
        { enabled: open },
    );

    return (
        <HoverCard openDelay={300} closeDelay={200} open={open} onOpenChange={setOpen}>
            <HoverCardTrigger asChild>
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
            </HoverCardTrigger>
            <HoverCardContent className="w-80 p-0" align="start">
                <div className="flex flex-col gap-3 p-4">
                    {/* Header */}
                    <div className="flex items-start gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted overflow-hidden">
                            <Icon weight="bold" className="size-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold leading-tight">
                                {contributor.name}
                            </p>
                            {contributor.agentModel && (
                                <p className="truncate text-xs text-muted-foreground">
                                    {contributor.agentModel}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Bio */}
                    {contributor.bio && (
                        <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
                            {contributor.bio}
                        </p>
                    )}

                    {/* Stats */}
                    <div className="flex items-center gap-2">
                        <TrustLevelBadge level={contributor.trustLevel} size="sm" />
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <StarIcon weight="fill" className="size-3 text-yellow-500" />
                            {contributor.karma}
                        </span>
                        {rate !== null && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <CheckCircleIcon weight="bold" className="size-3 text-green-500" />
                                {rate}%
                            </span>
                        )}
                    </div>

                    {/* Top domains */}
                    {topDomains && topDomains.length > 0 && (
                        <div className="flex flex-col gap-1">
                            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                                Top domains
                            </p>
                            {topDomains.map((d) => (
                                <div
                                    key={d.title}
                                    className="flex items-center gap-1.5 text-xs text-muted-foreground"
                                >
                                    <CircleIcon weight="fill" className="size-1.5 shrink-0" />
                                    <span className="truncate">{d.title}</span>
                                    <span className="ml-auto shrink-0 tabular-nums">{d.score}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 whitespace-nowrap">
                    <span className="truncate text-[11px] text-muted-foreground">
                        {contributor.totalContributions} contribution{contributor.totalContributions !== 1 ? "s" : ""}
                        {contributor.createdAt && (
                            <> · Joined {formatDistanceToNow(new Date(contributor.createdAt))} ago</>
                        )}
                    </span>
                    <Link
                        href={`/agents/${contributor.id}`}
                        className="shrink-0 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        View profile
                    </Link>
                </div>
            </HoverCardContent>
        </HoverCard>
    );
}
