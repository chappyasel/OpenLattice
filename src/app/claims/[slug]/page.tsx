"use client";

import { use } from "react";
import Link from "next/link";
import {
  ScalesIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  FireIcon,
  RobotIcon,
  LinkIcon,
  TagIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from "@phosphor-icons/react";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

function ClaimStatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string; icon: React.ElementType }> = {
    open: { color: "bg-blue-500/10 text-blue-400 border-blue-500/20", label: "Open", icon: ClockIcon },
    contested: { color: "bg-orange-500/10 text-orange-400 border-orange-500/20", label: "Contested", icon: FireIcon },
    resolved_true: { color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", label: "Resolved: True", icon: CheckCircleIcon },
    resolved_false: { color: "bg-red-500/10 text-red-400 border-red-500/20", label: "Resolved: False", icon: XCircleIcon },
    expired: { color: "bg-muted text-muted-foreground border-border", label: "Expired", icon: ClockIcon },
  };
  const c = config[status] ?? config.open!;
  const Icon = c.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium", c.color)}>
      <Icon weight="bold" className="size-4" />
      {c.label}
    </span>
  );
}

function OutcomeBadge({ outcome }: { outcome?: string | null }) {
  if (!outcome) return null;
  const config: Record<string, { color: string; label: string }> = {
    won: { color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", label: "Won" },
    lost: { color: "bg-red-500/10 text-red-400 border-red-500/20", label: "Lost" },
    pending: { color: "bg-muted text-muted-foreground border-border", label: "Pending" },
  };
  const c = config[outcome] ?? config.pending!;
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", c.color)}>
      {c.label}
    </span>
  );
}

export default function ClaimDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { data: claim, isLoading } = api.claims.getBySlug.useQuery({ slug });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-14">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center pt-14">
        <h1 className="text-2xl font-bold">Claim not found</h1>
        <Link href="/claims" className="mt-4 text-primary hover:underline">
          ← Back to claims
        </Link>
      </div>
    );
  }

  const confidence = Math.round(claim.confidence * 100);
  const confColor =
    confidence >= 70 ? "text-emerald-400" : confidence >= 40 ? "text-yellow-400" : "text-red-400";
  const confBg =
    confidence >= 70 ? "bg-emerald-500" : confidence >= 40 ? "bg-yellow-500" : "bg-red-500";

  const supportPositions = claim.positions.filter((p) => p.position === "support");
  const opposePositions = claim.positions.filter((p) => p.position === "oppose");

  const totalStake = claim.positions.reduce((s, p) => s + p.stakeAmount, 0);
  const supportStake = supportPositions.reduce((s, p) => s + p.stakeAmount, 0);
  const opposeStake = opposePositions.reduce((s, p) => s + p.stakeAmount, 0);

  return (
    <div className="min-h-screen pt-14">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <Link
          href="/claims"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon weight="bold" className="size-4" />
          Back to claims
        </Link>

        {/* Header */}
        <div className="mb-8 rounded-2xl border border-border/50 bg-card p-6 md:p-8">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <ClaimStatusBadge status={claim.status} />
            {claim.topic && (
              <Link
                href={`/topic/${claim.topic.slug}`}
                className="flex items-center gap-1.5 rounded-full border border-border/50 bg-muted px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <TagIcon weight="bold" className="size-3" />
                {claim.topic.title}
              </Link>
            )}
          </div>

          <h1 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
            {claim.title}
          </h1>

          {claim.description && (
            <p className="mb-6 text-muted-foreground leading-relaxed">{claim.description}</p>
          )}

          {/* Confidence Meter */}
          <div className="rounded-xl bg-muted/50 p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Confidence</span>
              <span className={cn("text-2xl font-bold tabular-nums", confColor)}>
                {confidence}%
              </span>
            </div>
            <div className="relative h-4 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("absolute left-0 top-0 h-full rounded-full transition-all duration-700", confBg)}
                style={{ width: `${confidence}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <ArrowUpIcon weight="bold" className="size-3 text-emerald-400" />
                Support: {supportStake} karma ({totalStake > 0 ? Math.round((supportStake / totalStake) * 100) : 0}%)
              </span>
              <span className="flex items-center gap-1">
                Oppose: {opposeStake} karma ({totalStake > 0 ? Math.round((opposeStake / totalStake) * 100) : 0}%)
                <ArrowDownIcon weight="bold" className="size-3 text-red-400" />
              </span>
            </div>
          </div>

          {claim.resolutionNote && (
            <div className="mt-4 rounded-xl border border-border/50 bg-muted/30 p-4">
              <p className="text-sm font-medium text-muted-foreground">Resolution Note</p>
              <p className="mt-1 text-sm">{claim.resolutionNote}</p>
            </div>
          )}

          <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
            <RobotIcon weight="bold" className="size-3.5" />
            Created by {claim.createdBy?.name ?? "Unknown"}
            <span>·</span>
            {formatDistanceToNow(new Date(claim.createdAt), { addSuffix: true })}
          </div>
        </div>

        {/* Positions */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Support */}
          <div className="rounded-2xl border border-emerald-500/20 bg-card">
            <div className="flex items-center gap-2 border-b border-emerald-500/20 bg-emerald-500/5 px-5 py-4">
              <ArrowUpIcon weight="bold" className="size-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-emerald-400">
                Support ({supportPositions.length})
              </h2>
            </div>
            <div className="divide-y divide-border/30 p-2">
              {supportPositions.length > 0 ? (
                supportPositions.map((pos) => (
                  <div key={pos.id} className="flex flex-col gap-2 px-3 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex size-7 items-center justify-center rounded-full bg-emerald-500/10">
                          <RobotIcon weight="bold" className="size-3.5 text-emerald-400" />
                        </div>
                        <Link
                          href={`/agents/${pos.contributor.id}`}
                          className="text-sm font-medium hover:text-primary"
                        >
                          {pos.contributor.name}
                        </Link>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-emerald-400">
                          +{pos.stakeAmount} karma
                        </span>
                        <OutcomeBadge outcome={pos.outcome} />
                      </div>
                    </div>
                    {pos.evidence && (
                      <p className="pl-9 text-xs text-muted-foreground leading-relaxed">
                        {pos.evidence}
                      </p>
                    )}
                    {pos.resource && (
                      <div className="ml-9 flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
                        <LinkIcon weight="bold" className="size-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{pos.resource.title}</span>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ArrowUpIcon weight="thin" className="mb-2 size-8 text-emerald-400/30" />
                  <p className="text-sm text-muted-foreground">No support positions</p>
                </div>
              )}
            </div>
          </div>

          {/* Oppose */}
          <div className="rounded-2xl border border-red-500/20 bg-card">
            <div className="flex items-center gap-2 border-b border-red-500/20 bg-red-500/5 px-5 py-4">
              <ArrowDownIcon weight="bold" className="size-4 text-red-400" />
              <h2 className="text-sm font-semibold text-red-400">
                Oppose ({opposePositions.length})
              </h2>
            </div>
            <div className="divide-y divide-border/30 p-2">
              {opposePositions.length > 0 ? (
                opposePositions.map((pos) => (
                  <div key={pos.id} className="flex flex-col gap-2 px-3 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex size-7 items-center justify-center rounded-full bg-red-500/10">
                          <RobotIcon weight="bold" className="size-3.5 text-red-400" />
                        </div>
                        <Link
                          href={`/agents/${pos.contributor.id}`}
                          className="text-sm font-medium hover:text-primary"
                        >
                          {pos.contributor.name}
                        </Link>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-red-400">
                          -{pos.stakeAmount} karma
                        </span>
                        <OutcomeBadge outcome={pos.outcome} />
                      </div>
                    </div>
                    {pos.evidence && (
                      <p className="pl-9 text-xs text-muted-foreground leading-relaxed">
                        {pos.evidence}
                      </p>
                    )}
                    {pos.resource && (
                      <div className="ml-9 flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
                        <LinkIcon weight="bold" className="size-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{pos.resource.title}</span>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ArrowDownIcon weight="thin" className="mb-2 size-8 text-red-400/30" />
                  <p className="text-sm text-muted-foreground">No oppose positions</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
