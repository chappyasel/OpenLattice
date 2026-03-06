"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ActivityIcon,
  RobotIcon,
  GraphIcon,
  BookOpenIcon,
  TreasureChestIcon,
  StarIcon,
  FunnelIcon,
  CheckCircleIcon,
  ArrowBendDownRightIcon,
} from "@phosphor-icons/react";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";

type ActivityType =
  | "topic_created"
  | "resource_submitted"
  | "edge_created"
  | "bounty_completed"
  | "submission_reviewed"
  | "reputation_changed";

const activityConfig: Record<
  ActivityType,
  { label: string; icon: React.ComponentType<any>; color: string; bg: string }
> = {
  topic_created: { label: "Topic Created", icon: GraphIcon, color: "text-blue-400", bg: "bg-blue-500/10" },
  resource_submitted: { label: "Resource Submitted", icon: BookOpenIcon, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  edge_created: { label: "Edge Created", icon: GraphIcon, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  bounty_completed: { label: "Bounty Completed", icon: TreasureChestIcon, color: "text-yellow-400", bg: "bg-yellow-500/10" },
  submission_reviewed: { label: "Submission Reviewed", icon: CheckCircleIcon, color: "text-brand-blue", bg: "bg-brand-blue/10" },
  reputation_changed: { label: "Reputation Changed", icon: StarIcon, color: "text-yellow-400", bg: "bg-yellow-500/10" },
};

const typeOptions: { value: ActivityType | "all"; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "topic_created", label: "Topics" },
  { value: "resource_submitted", label: "Resources" },
  { value: "bounty_completed", label: "Bounties" },
];

export default function ActivityPage() {
  const [typeFilter, setTypeFilter] = useState<ActivityType | "all">("all");

  const { data, isLoading } = api.activity.list.useQuery({
    type: typeFilter !== "all" ? typeFilter : undefined,
    limit: 50,
  });

  const items = data?.items ?? [];

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-2">
            <ActivityIcon weight="bold" className="size-6 text-brand-blue" />
            <h1 className="text-3xl font-bold tracking-tight">Activity Feed</h1>
          </div>
          <p className="text-muted-foreground">
            Real-time log of everything happening in the knowledge market.
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <FunnelIcon weight="bold" className="size-4 text-muted-foreground" />
          {typeOptions.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTypeFilter(value)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                typeFilter === value
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[22px] top-0 bottom-0 w-px bg-border/50" />

          <div className="space-y-1">
            {isLoading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="flex animate-pulse items-start gap-4 pl-0 py-4">
                    <div className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full bg-muted" />
                    <div className="flex-1 pt-2">
                      <div className="mb-2 h-4 w-1/2 rounded bg-muted" />
                      <div className="h-3 w-3/4 rounded bg-muted" />
                    </div>
                  </div>
                ))
              : items.map((item, idx) => {
                  const config = activityConfig[item.type as ActivityType];
                  const Icon = config?.icon ?? ActivityIcon;
                  const color = config?.color ?? "text-muted-foreground";
                  const bg = config?.bg ?? "bg-muted";

                  // Show date separator
                  const prevItem = items[idx - 1];
                  const nextItem = items[idx + 1];
                  const showDate =
                    idx === 0 ||
                    (prevItem &&
                      new Date(item.createdAt).toDateString() !==
                        new Date(prevItem.createdAt).toDateString());

                  // Topic thread grouping: check if this item continues a thread
                  const prevTopicId = prevItem?.topic?.id;
                  const currTopicId = item.topic?.id;
                  const nextTopicId = nextItem?.topic?.id;

                  const isContinuingThread = !showDate && !!currTopicId && currTopicId === prevTopicId;
                  const threadContinuesAfter = !!currTopicId && currTopicId === nextTopicId;

                  return (
                    <div key={item.id}>
                      {showDate && (
                        <div className="relative z-10 my-4 ml-14 text-xs font-medium text-muted-foreground">
                          {format(new Date(item.createdAt), "MMMM d, yyyy")}
                        </div>
                      )}

                      {/* Thread connector label between consecutive same-topic items */}
                      {isContinuingThread && (
                        <div className="ml-14 mb-1 flex items-center gap-1.5 text-[10px] text-muted-foreground/60 select-none">
                          <ArrowBendDownRightIcon weight="bold" className="size-3" />
                          <span>continuing on</span>
                          <Link
                            href={`/topic/${item.topic!.id}`}
                            className="font-medium text-brand-blue/60 hover:text-brand-blue transition-colors"
                          >
                            {item.topic!.title}
                          </Link>
                        </div>
                      )}

                      <div className="flex items-start gap-4 py-3">
                        <div
                          className={cn(
                            "relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full border border-border",
                            bg,
                          )}
                        >
                          <Icon weight="bold" className={cn("size-4", color)} />
                        </div>

                        <div
                          className={cn(
                            "flex-1 min-w-0 rounded-xl border bg-card p-4 hover:border-border transition-colors",
                            isContinuingThread || threadContinuesAfter
                              ? "border-l-2 border-l-brand-blue/30 border-border/30"
                              : "border-border/30",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                {item.contributor && (
                                  <Link
                                    href={`/leaderboard/${item.contributor.id}`}
                                    className="flex items-center gap-1.5 text-sm font-semibold hover:text-brand-blue"
                                  >
                                    <RobotIcon weight="bold" className="size-3.5" />
                                    {item.contributor.name}
                                  </Link>
                                )}
                                <span className={cn("text-xs font-medium rounded-full px-2 py-0.5 border", config?.bg, color, "border-current/20")}>
                                  {config?.label ?? item.type}
                                </span>
                              </div>

                              <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2 break-words">
                                {item.description}
                              </p>

                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                {item.topic && (
                                  <Link
                                    href={`/topic/${item.topic.id}`}
                                    className="flex items-center gap-1 text-xs text-brand-blue hover:underline"
                                  >
                                    <GraphIcon weight="bold" className="size-3" />
                                    {item.topic.title}
                                  </Link>
                                )}
                              </div>
                            </div>

                            <time className="shrink-0 text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(item.createdAt), {
                                addSuffix: true,
                              })}
                            </time>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
          </div>

          {!isLoading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ActivityIcon weight="thin" className="mb-3 size-12 text-muted-foreground/40" />
              <p className="text-muted-foreground">No activity yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
