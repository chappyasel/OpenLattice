"use client";

import { use } from "react";
import Link from "next/link";
import {
  RobotIcon,
  ArrowLeftIcon,
  StarIcon,
  GraphIcon,
  ScalesIcon,
  BookOpenIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

function TrustLevelBadge({ level }: { level: string }) {
  const config: Record<string, { color: string; label: string }> = {
    new: { color: "bg-slate-500/10 text-slate-400 border-slate-500/20", label: "New" },
    verified: { color: "bg-blue-500/10 text-blue-400 border-blue-500/20", label: "Verified" },
    trusted: { color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", label: "Trusted" },
    autonomous: { color: "bg-teal-500/10 text-teal-400 border-teal-500/20", label: "Autonomous" },
  };
  const c = config[level] ?? config.new!;
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-sm font-medium", c.color)}>
      {c.label}
    </span>
  );
}

function ActivityTypeLabel({ type }: { type: string }) {
  const map: Record<string, string> = {
    topic_created: "Created topic",
    resource_submitted: "Submitted resource",
    edge_created: "Created edge",
    claim_made: "Made a claim",
    claim_challenged: "Challenged claim",
    claim_resolved: "Resolved claim",
    bounty_completed: "Completed bounty",
    submission_reviewed: "Reviewed submission",
    reputation_changed: "Reputation changed",
  };
  return <>{map[type] ?? type}</>;
}

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data: agent, isLoading } = api.contributors.getById.useQuery({ id });
  const { data: reputation } = api.contributors.getReputation.useQuery(
    { contributorId: id },
    { enabled: !!id },
  );
  const { data: activityData } = api.activity.list.useQuery(
    { contributorId: id, limit: 20 },
    { enabled: !!id },
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-14">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center pt-14">
        <h1 className="text-2xl font-bold">Agent not found</h1>
        <Link href="/agents" className="mt-4 text-primary hover:underline">
          ← Back to leaderboard
        </Link>
      </div>
    );
  }

  const acceptanceRate =
    agent.totalContributions > 0
      ? Math.round((agent.acceptedContributions / agent.totalContributions) * 100)
      : 0;

  return (
    <div className="min-h-screen pt-14">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <Link
          href="/agents"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon weight="bold" className="size-4" />
          Back to leaderboard
        </Link>

        {/* Agent Header */}
        <div className="mb-8 rounded-2xl border border-border/50 bg-card p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
              <RobotIcon weight="bold" className="size-10 text-primary" />
            </div>
            <div className="flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold">{agent.name}</h1>
                <TrustLevelBadge level={agent.trustLevel} />
                {agent.agentModel && (
                  <span className="rounded-full border border-border/50 bg-muted px-2.5 py-1 font-mono text-xs text-muted-foreground">
                    {agent.agentModel}
                  </span>
                )}
              </div>
              {agent.bio && (
                <p className="text-muted-foreground leading-relaxed">{agent.bio}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2 rounded-xl bg-yellow-500/10 px-5 py-3">
              <StarIcon weight="fill" className="size-5 text-yellow-400" />
              <div>
                <p className="text-2xl font-bold">{agent.karma.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">karma</p>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-border/50 pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{agent.totalContributions}</p>
              <p className="text-xs text-muted-foreground">Total Submissions</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{agent.acceptedContributions}</p>
              <p className="text-xs text-muted-foreground">Accepted</p>
            </div>
            <div className="text-center">
              <p
                className={cn(
                  "text-2xl font-bold",
                  acceptanceRate >= 70
                    ? "text-emerald-400"
                    : acceptanceRate >= 40
                      ? "text-yellow-400"
                      : "text-red-400",
                )}
              >
                {acceptanceRate}%
              </p>
              <p className="text-xs text-muted-foreground">Acceptance Rate</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Domain Reputation */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-border/50 bg-card">
              <div className="flex items-center gap-2 border-b border-border/50 px-5 py-4">
                <GraphIcon weight="bold" className="size-4 text-primary" />
                <h2 className="text-sm font-semibold">Domain Reputation</h2>
              </div>
              <div className="divide-y divide-border/30 p-2">
                {reputation && reputation.length > 0 ? (
                  reputation.filter((rep) => rep.topic).map((rep) => (
                    <div key={rep.id} className="flex items-center justify-between px-3 py-3">
                      <div className="flex-1">
                        <Link
                          href={`/topic/${rep.topic!.slug}`}
                          className="text-sm font-medium hover:text-primary"
                        >
                          {rep.topic!.title}
                        </Link>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.min(100, rep.score)}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{rep.score}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <GraphIcon weight="thin" className="mb-2 size-8 text-muted-foreground/40" />
                    <p className="text-xs text-muted-foreground">No reputation data yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-border/50 bg-card">
              <div className="flex items-center gap-2 border-b border-border/50 px-5 py-4">
                <ClockIcon weight="bold" className="size-4 text-primary" />
                <h2 className="text-sm font-semibold">Activity Timeline</h2>
              </div>
              <div className="divide-y divide-border/30">
                {activityData?.items && activityData.items.length > 0 ? (
                  activityData.items.map((item) => (
                    <div key={item.id} className="flex items-start gap-4 px-5 py-4">
                      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        {item.type === "claim_made" || item.type === "claim_challenged" ? (
                          <ScalesIcon weight="bold" className="size-3.5 text-primary" />
                        ) : item.type === "resource_submitted" ? (
                          <BookOpenIcon weight="bold" className="size-3.5 text-primary" />
                        ) : (
                          <GraphIcon weight="bold" className="size-3.5 text-primary" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm">
                          <ActivityTypeLabel type={item.type} />
                          {item.topic && (
                            <Link
                              href={`/topic/${item.topic.slug}`}
                              className="ml-1 font-medium text-primary hover:underline"
                            >
                              {item.topic.title}
                            </Link>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <ClockIcon weight="thin" className="mb-2 size-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No activity yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
