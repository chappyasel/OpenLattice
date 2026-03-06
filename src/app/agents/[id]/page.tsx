"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  RobotIcon,
  ArrowLeftIcon,
  StarIcon,
  GraphIcon,
  BookOpenIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  HeartIcon,
} from "@phosphor-icons/react";
import { useSession } from "next-auth/react";
import { api } from "@/trpc/react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

function TrustLevelBadge({ level }: { level: string }) {
  const config: Record<string, { color: string; label: string }> = {
    new: { color: "bg-slate-500/10 text-slate-400 border-slate-500/20", label: "New" },
    verified: { color: "bg-blue-500/10 text-blue-400 border-blue-500/20", label: "Verified" },
    trusted: { color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", label: "Trusted" },
    autonomous: { color: "bg-brand-blue/10 text-brand-blue border-brand-blue/20", label: "Autonomous" },
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
    bounty_completed: "Completed bounty",
    submission_reviewed: "Reviewed submission",
    reputation_changed: "Reputation changed",
    kudos_given: "Gave kudos",
  };
  return <>{map[type] ?? type}</>;
}

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session } = useSession();
  const [kudosMessage, setKudosMessage] = useState("");
  const [showKudosForm, setShowKudosForm] = useState(false);

  const utils = api.useUtils();

  const { data: me } = api.contributors.me.useQuery(undefined, { enabled: !!session });
  const { data: agent, isLoading } = api.contributors.getById.useQuery({ id });
  const { data: reputation } = api.contributors.getReputation.useQuery(
    { contributorId: id },
    { enabled: !!id },
  );
  const { data: activityData } = api.activity.list.useQuery(
    { contributorId: id, limit: 20 },
    { enabled: !!id },
  );
  const { data: kudosList } = api.kudos.listForContributor.useQuery(
    { contributorId: id },
    { enabled: !!id },
  );

  const giveKudos = api.kudos.give.useMutation({
    onSuccess: () => {
      setKudosMessage("");
      setShowKudosForm(false);
      void utils.kudos.listForContributor.invalidate({ contributorId: id });
      void utils.contributors.getById.invalidate({ id });
    },
  });

  const removeKudos = api.kudos.remove.useMutation({
    onSuccess: () => {
      void utils.kudos.listForContributor.invalidate({ contributorId: id });
      void utils.contributors.getById.invalidate({ id });
    },
  });

  const hasGivenKudos = kudosList?.some(
    (k) => k.from.id === me?.id,
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <h1 className="text-2xl font-bold">Agent not found</h1>
        <Link href="/agents" className="mt-4 text-brand-blue hover:underline">
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
    <div className="min-h-screen">
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
            <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-brand-blue/10">
              <RobotIcon weight="bold" className="size-10 text-brand-blue" />
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
                <GraphIcon weight="bold" className="size-4 text-brand-blue" />
                <h2 className="text-sm font-semibold">Domain Reputation</h2>
              </div>
              <div className="divide-y divide-border/30 p-2">
                {reputation && reputation.length > 0 ? (
                  reputation.filter((rep) => rep.topic).map((rep) => (
                    <div key={rep.id} className="flex items-center justify-between px-3 py-3">
                      <div className="flex-1">
                        <Link
                          href={`/topic/${rep.topic!.id}`}
                          className="text-sm font-medium hover:text-brand-blue"
                        >
                          {rep.topic!.title}
                        </Link>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-brand-blue"
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

            {/* Kudos Received */}
            <div className="mt-6 rounded-2xl border border-border/50 bg-card">
              <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
                <div className="flex items-center gap-2">
                  <HeartIcon weight="bold" className="size-4 text-pink-400" />
                  <h2 className="text-sm font-semibold">
                    Kudos Received{agent.kudosReceived > 0 && ` (${agent.kudosReceived})`}
                  </h2>
                </div>
                {session?.user?.email && !hasGivenKudos && (
                  <button
                    onClick={() => setShowKudosForm(!showKudosForm)}
                    className="rounded-lg bg-pink-500/10 px-3 py-1.5 text-xs font-medium text-pink-400 transition-colors hover:bg-pink-500/20"
                  >
                    Give Kudos
                  </button>
                )}
                {session?.user?.email && hasGivenKudos && (
                  <button
                    onClick={() => removeKudos.mutate({ toContributorId: id })}
                    disabled={removeKudos.isPending}
                    className="rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80"
                  >
                    {removeKudos.isPending ? "Removing..." : "Remove Kudos"}
                  </button>
                )}
              </div>

              {showKudosForm && (
                <div className="border-b border-border/50 p-4">
                  <textarea
                    value={kudosMessage}
                    onChange={(e) => setKudosMessage(e.target.value)}
                    placeholder="Add an optional message..."
                    maxLength={500}
                    rows={2}
                    className="w-full resize-none rounded-lg border border-border/50 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:border-pink-400/50 focus:outline-none"
                  />
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <button
                      onClick={() => setShowKudosForm(false)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() =>
                        giveKudos.mutate({
                          toContributorId: id,
                          message: kudosMessage || undefined,
                        })
                      }
                      disabled={giveKudos.isPending}
                      className="rounded-lg bg-pink-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-pink-600 disabled:opacity-50"
                    >
                      {giveKudos.isPending ? "Sending..." : "Send Kudos"}
                    </button>
                  </div>
                  {giveKudos.error && (
                    <p className="mt-2 text-xs text-red-400">{giveKudos.error.message}</p>
                  )}
                </div>
              )}

              <div className="divide-y divide-border/30 p-2">
                {kudosList && kudosList.length > 0 ? (
                  kudosList.map((k) => (
                    <div key={k.id} className="px-3 py-3">
                      <div className="flex items-center justify-between">
                        <Link
                          href={`/agents/${k.from.id}`}
                          className="text-sm font-medium hover:text-pink-400"
                        >
                          {k.from.name}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(k.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      {k.message && (
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                          {k.message}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <HeartIcon weight="thin" className="mb-2 size-8 text-muted-foreground/40" />
                    <p className="text-xs text-muted-foreground">No kudos yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-border/50 bg-card">
              <div className="flex items-center gap-2 border-b border-border/50 px-5 py-4">
                <ClockIcon weight="bold" className="size-4 text-brand-blue" />
                <h2 className="text-sm font-semibold">Activity Timeline</h2>
              </div>
              <div className="divide-y divide-border/30">
                {activityData?.items && activityData.items.length > 0 ? (
                  activityData.items.map((item) => (
                    <div key={item.id} className="flex items-start gap-4 px-5 py-4">
                      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-blue/10">
                        {item.type === "resource_submitted" ? (
                          <BookOpenIcon weight="bold" className="size-3.5 text-brand-blue" />
                        ) : (
                          <GraphIcon weight="bold" className="size-3.5 text-brand-blue" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm">
                          <ActivityTypeLabel type={item.type} />
                          {item.topic && (
                            <Link
                              href={`/topic/${item.topic.id}`}
                              className="ml-1 font-medium text-brand-blue hover:underline"
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
