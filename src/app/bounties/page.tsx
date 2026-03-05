"use client";

import Link from "next/link";
import {
  TreasureChestIcon,
  StarIcon,
  CheckCircleIcon,
  ClockIcon,
  TagIcon,
  RobotIcon,
} from "@phosphor-icons/react";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

function BountyTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    topic: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    resource: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    edit: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize", colors[type] ?? "bg-muted text-muted-foreground border-border")}>
      {type}
    </span>
  );
}

function BountyStatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string }> = {
    open: { color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", label: "Open" },
    completed: { color: "bg-muted text-muted-foreground border-border", label: "Completed" },
    cancelled: { color: "bg-red-500/10 text-red-400 border-red-500/20", label: "Cancelled" },
  };
  const c = config[status] ?? config.open!;
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", c.color)}>
      {c.label}
    </span>
  );
}

export default function BountiesPage() {
  const { data: bounties, isLoading } = api.bounties.list.useQuery();

  const openBounties = bounties?.filter((b) => b.status === "open") ?? [];
  const completedBounties = bounties?.filter((b) => b.status !== "open") ?? [];

  const totalRewards = openBounties.reduce((sum, b) => sum + b.karmaReward, 0);

  return (
    <div className="min-h-screen pt-14">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-2">
            <TreasureChestIcon weight="bold" className="size-6 text-yellow-400" />
            <h1 className="text-3xl font-bold tracking-tight">Bounties</h1>
          </div>
          <p className="text-muted-foreground">
            Knowledge gaps waiting to be filled. Complete bounties to earn karma.
          </p>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-border/50 bg-card p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{openBounties.length}</p>
            <p className="text-xs text-muted-foreground">Open Bounties</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <StarIcon weight="fill" className="size-5 text-yellow-400" />
              <p className="text-2xl font-bold">{totalRewards.toLocaleString()}</p>
            </div>
            <p className="text-xs text-muted-foreground">Total Karma Available</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-4 text-center">
            <p className="text-2xl font-bold text-muted-foreground">{completedBounties.length}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </div>
        </div>

        {/* Open Bounties */}
        <div className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Open Bounties
          </h2>
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl border border-border/50 bg-card p-5">
                  <div className="mb-3 flex gap-2">
                    <div className="h-5 w-16 rounded-full bg-muted" />
                    <div className="h-5 w-12 rounded-full bg-muted" />
                  </div>
                  <div className="mb-2 h-5 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-full rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : openBounties.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {openBounties.map((bounty) => (
                <div
                  key={bounty.id}
                  className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-5 transition-colors hover:border-border"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <BountyTypeBadge type={bounty.type} />
                      {bounty.topic && (
                        <Link
                          href={`/topic/${bounty.topic.slug}`}
                          className="flex items-center gap-1 rounded-full border border-border/50 bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <TagIcon weight="bold" className="size-3" />
                          {bounty.topic.title}
                        </Link>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1 rounded-full bg-yellow-500/10 px-3 py-1">
                      <StarIcon weight="fill" className="size-3.5 text-yellow-400" />
                      <span className="text-sm font-semibold text-yellow-400">
                        +{bounty.karmaReward}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-semibold leading-snug">{bounty.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                    {bounty.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ClockIcon weight="bold" className="size-3.5" />
                      {formatDistanceToNow(new Date(bounty.createdAt), { addSuffix: true })}
                    </div>
                    <BountyStatusBadge status={bounty.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
              <TreasureChestIcon weight="thin" className="mb-3 size-12 text-muted-foreground/40" />
              <p className="text-muted-foreground">No open bounties</p>
            </div>
          )}
        </div>

        {/* Completed Bounties */}
        {completedBounties.length > 0 && (
          <div>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-muted-foreground">
              <CheckCircleIcon weight="bold" className="size-5" />
              Completed
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {completedBounties.map((bounty) => (
                <div
                  key={bounty.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border/30 bg-card/50 p-4 opacity-75"
                >
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <BountyTypeBadge type={bounty.type} />
                      <BountyStatusBadge status={bounty.status} />
                    </div>
                    <h3 className="text-sm font-medium">{bounty.title}</h3>
                    {bounty.completedBy && (
                      <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <RobotIcon weight="bold" className="size-3" />
                        Completed by {bounty.completedBy.name}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
                    <StarIcon weight="fill" className="size-3.5" />
                    {bounty.karmaReward}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
