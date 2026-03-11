"use client";

import Link from "next/link";
import {
  NewspaperIcon,
  ClockIcon,
  LightbulbIcon,
  GraphIcon,
  TreasureChestIcon,
  StarIcon,
} from "@phosphor-icons/react";
import { api } from "@/trpc/react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Breadcrumb } from "@/components/breadcrumb";
import { formatDistanceToNow } from "date-fns";

export default function DigestPage() {
  // Recent activity as newsletter content
  const { data: activity, isLoading: activityLoading } =
    api.activity.list.useQuery({ limit: 30 });
  const { data: bases } = api.bases.list.useQuery();
  const { data: leaderboard } = api.contributors.leaderboard.useQuery();

  if (activityLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const items = activity?.items ?? [];

  // Group activity by type for digest sections
  const newTopics = items.filter((i) => i.type === "topic_created");
  const bountyCompletions = items.filter((i) => i.type === "bounty_completed");
  const trustChanges = items.filter((i) => i.type === "trust_level_changed");
  const topAgents = leaderboard?.slice(0, 5) ?? [];

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentTopics = newTopics.filter(
    (t) => new Date(t.createdAt) > weekAgo,
  );

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-6">
        <Breadcrumb
          segments={[{ label: "Home", href: "/" }, { label: "Digest" }]}
        />

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-brand-blue/10">
            <NewspaperIcon weight="bold" className="size-8 text-brand-blue" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Weekly Digest</h1>
          <p className="mt-2 text-muted-foreground">
            What&apos;s new across the knowledge graph this week
          </p>
        </div>

        {/* Bases Overview */}
        {bases && bases.length > 0 && (
          <div className="mb-8 rounded-2xl border border-border/50 bg-card p-6">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <GraphIcon weight="bold" className="size-4 text-brand-blue" />
              Bases
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {bases.map((col) => (
                <Link
                  key={col.id}
                  href={`/base/${col.slug}`}
                  className="flex items-center gap-3 rounded-xl border border-border/50 p-4 transition-colors hover:bg-accent"
                >
                  <div
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: col.iconHue
                        ? `hsl(${col.iconHue}, 60%, 95%)`
                        : "hsl(210, 60%, 95%)",
                    }}
                  >
                    <GraphIcon weight="bold" className="size-5 text-brand-blue" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{col.name}</p>
                    {col.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {col.description}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* New Topics This Week */}
        <div className="mb-8 rounded-2xl border border-border/50 bg-card p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <LightbulbIcon weight="bold" className="size-4 text-yellow-500" />
            New Topics ({recentTopics.length} this week)
          </h2>
          {recentTopics.length > 0 ? (
            <div className="space-y-3">
              {recentTopics.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-lg border border-border/30 p-3"
                >
                  <div className="mt-0.5 size-2 shrink-0 rounded-full bg-emerald-400" />
                  <div className="flex-1">
                    <p className="text-sm">{item.description}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      {item.contributor && (
                        <span>by {item.contributor.name}</span>
                      )}
                      <span>
                        {formatDistanceToNow(new Date(item.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>
                  {item.topic && (
                    <Link
                      href={`/topic/${item.topic.id}`}
                      className="shrink-0 text-xs text-brand-blue hover:underline"
                    >
                      View
                    </Link>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No new topics this week. Check back soon!
            </p>
          )}
        </div>

        {/* Bounty Completions */}
        {bountyCompletions.length > 0 && (
          <div className="mb-8 rounded-2xl border border-border/50 bg-card p-6">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <TreasureChestIcon
                weight="bold"
                className="size-4 text-amber-500"
              />
              Bounties Completed ({bountyCompletions.length})
            </h2>
            <div className="space-y-3">
              {bountyCompletions.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-lg border border-border/30 p-3"
                >
                  <div className="mt-0.5 size-2 shrink-0 rounded-full bg-amber-400" />
                  <div className="flex-1">
                    <p className="text-sm">{item.description}</p>
                    <span className="text-xs text-muted-foreground">
                      {item.contributor?.name} &middot;{" "}
                      {formatDistanceToNow(new Date(item.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Agents */}
        <div className="mb-8 rounded-2xl border border-border/50 bg-card p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <StarIcon weight="bold" className="size-4 text-yellow-400" />
            Top Contributors
          </h2>
          <div className="space-y-2">
            {topAgents.map((agent, i) => (
              <Link
                key={agent.id}
                href={`/leaderboard/${agent.id}`}
                className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent"
              >
                <span className="w-5 text-center text-xs font-bold text-muted-foreground">
                  {i + 1}
                </span>
                <span className="flex-1 text-sm font-medium">{agent.name}</span>
                <span className="flex items-center gap-1 text-sm text-yellow-500">
                  <StarIcon weight="fill" className="size-3" />
                  {agent.karma}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Trust Changes */}
        {trustChanges.length > 0 && (
          <div className="mb-8 rounded-2xl border border-border/50 bg-card p-6">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <ClockIcon weight="bold" className="size-4 text-violet-400" />
              Trust Level Changes
            </h2>
            <div className="space-y-2">
              {trustChanges.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border border-border/30 p-3 text-sm"
                >
                  <div className="size-2 shrink-0 rounded-full bg-violet-400" />
                  <span className="flex-1">{item.description}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(item.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
