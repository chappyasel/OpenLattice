"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  BookOpenIcon,
  ScalesIcon,
  GraphIcon,
  RobotIcon,
  ArrowLeftIcon,
  LinkIcon,
  StarIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  FireIcon,
} from "@phosphor-icons/react";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const colors: Record<string, string> = {
    beginner: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    intermediate: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    advanced: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium capitalize",
        colors[difficulty] ?? "bg-muted text-muted-foreground border-border",
      )}
    >
      {difficulty}
    </span>
  );
}

function ResourceTypeBadge({ type }: { type: string }) {
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
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
        colors[type] ?? colors.other,
      )}
    >
      {type}
    </span>
  );
}

function ClaimStatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string; icon: React.ComponentType<any> }> = {
    open: { color: "bg-blue-500/10 text-blue-400 border-blue-500/20", label: "Open", icon: ClockIcon },
    contested: { color: "bg-orange-500/10 text-orange-400 border-orange-500/20", label: "Contested", icon: FireIcon },
    resolved_true: { color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", label: "Resolved True", icon: CheckCircleIcon },
    resolved_false: { color: "bg-red-500/10 text-red-400 border-red-500/20", label: "Resolved False", icon: XCircleIcon },
    expired: { color: "bg-muted text-muted-foreground border-border", label: "Expired", icon: ClockIcon },
  };
  const c = config[status] ?? config.open!;
  const Icon = c.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", c.color)}>
      <Icon weight="bold" className="size-3" />
      {c.label}
    </span>
  );
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 70
      ? "bg-emerald-500"
      : pct >= 40
        ? "bg-yellow-500"
        : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-muted-foreground">{pct}%</span>
    </div>
  );
}

type Tab = "resources" | "claims" | "subtopics";

export default function TopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [activeTab, setActiveTab] = useState<Tab>("resources");

  const { data: topic, isLoading } = api.topics.getBySlug.useQuery({ slug });
  const { data: claims } = api.claims.getByTopic.useQuery(
    { topicId: topic?.id ?? "" },
    { enabled: !!topic?.id },
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-14">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center pt-14">
        <h1 className="text-2xl font-bold">Topic not found</h1>
        <Link href="/explore" className="mt-4 text-primary hover:underline">
          ← Back to explore
        </Link>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ComponentType<any>; count?: number }[] = [
    { id: "resources", label: "Resources", icon: BookOpenIcon, count: topic.topicResources?.length },
    { id: "claims", label: "Claims", icon: ScalesIcon, count: claims?.length },
    { id: "subtopics", label: "Subtopics", icon: GraphIcon, count: topic.childTopics?.length },
  ];

  return (
    <div className="min-h-screen pt-14">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        {/* Back */}
        <Link
          href="/explore"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon weight="bold" className="size-4" />
          Back to explore
        </Link>

        {/* Header */}
        <div className="mb-8 rounded-2xl border border-border/50 bg-card p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <DifficultyBadge difficulty={topic.difficulty} />
                {topic.topicTags?.map(({ tag }) => (
                  <span
                    key={tag.id}
                    className="rounded-full border border-border/50 bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
              <h1 className="mb-3 text-3xl font-bold tracking-tight md:text-4xl">
                {topic.title}
              </h1>
              {topic.summary && (
                <p className="text-muted-foreground leading-relaxed">{topic.summary}</p>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl border border-border/50 bg-card p-1">
          {tabs.map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
                activeTab === id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon weight="bold" className="size-4" />
              {label}
              {count !== undefined && count > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-xs",
                    activeTab === id ? "bg-primary-foreground/20" : "bg-muted",
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Resources tab */}
        {activeTab === "resources" && (
          <div className="grid gap-4 md:grid-cols-2">
            {topic.topicResources && topic.topicResources.length > 0 ? (
              topic.topicResources.map(({ resource, relevanceScore }) => (
                <div
                  key={resource.id}
                  className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-5 transition-colors hover:border-border"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <ResourceTypeBadge type={resource.type} />
                        {relevanceScore && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <StarIcon weight="fill" className="size-3 text-yellow-400" />
                            {(relevanceScore * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold leading-snug">{resource.name}</h3>
                    </div>
                    {resource.url && (
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded-lg border border-border p-2 text-muted-foreground hover:border-primary hover:text-primary"
                      >
                        <LinkIcon weight="bold" className="size-4" />
                      </a>
                    )}
                  </div>
                  {resource.summary && (
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                      {resource.summary}
                    </p>
                  )}
                  {resource.submittedById && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <RobotIcon weight="bold" className="size-3" />
                      Submitted by agent
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="col-span-2 flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
                <BookOpenIcon weight="thin" className="mb-3 size-12 text-muted-foreground/40" />
                <p className="text-muted-foreground">No resources yet</p>
              </div>
            )}
          </div>
        )}

        {/* Claims tab */}
        {activeTab === "claims" && (
          <div className="grid gap-4">
            {claims && claims.length > 0 ? (
              claims.map((claim) => (
                <Link
                  key={claim.id}
                  href={`/claims/${claim.slug}`}
                  className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-5 transition-colors hover:border-border"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold leading-snug">{claim.title}</h3>
                    <ClaimStatusBadge status={claim.status} />
                  </div>
                  <ConfidenceBar confidence={claim.confidence ?? 0} />
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {claim.status === "resolved_true" && (
                      <CheckCircleIcon weight="bold" className="size-4 text-emerald-400" />
                    )}
                    {claim.status === "resolved_false" && (
                      <XCircleIcon weight="bold" className="size-4 text-red-400" />
                    )}
                    <span>{claim.positions.length} positions</span>
                    <span>·</span>
                    <span>{claim.createdBy?.name ?? "Unknown"}</span>
                  </div>
                </Link>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
                <ScalesIcon weight="thin" className="mb-3 size-12 text-muted-foreground/40" />
                <p className="text-muted-foreground">No claims yet</p>
              </div>
            )}
          </div>
        )}

        {/* Subtopics tab */}
        {activeTab === "subtopics" && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {topic.childTopics && topic.childTopics.length > 0 ? (
              topic.childTopics.map((child) => (
                <Link
                  key={child.id}
                  href={`/topic/${child.slug}`}
                  className="flex flex-col gap-2 rounded-xl border border-border/50 bg-card p-5 transition-colors hover:border-border"
                >
                  <div className="flex items-center justify-between">
                    <DifficultyBadge difficulty={child.difficulty} />
                    <GraphIcon weight="bold" className="size-4 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold">{child.title}</h3>
                  {child.summary && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{child.summary}</p>
                  )}
                </Link>
              ))
            ) : (
              <div className="col-span-3 flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
                <GraphIcon weight="thin" className="mb-3 size-12 text-muted-foreground/40" />
                <p className="text-muted-foreground">No subtopics yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
