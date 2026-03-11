"use client";

import { use, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BookOpenIcon,
  ClockCounterClockwiseIcon,
  GraphIcon,
  ArrowSquareOutIcon,
  StarIcon,
  LightbulbIcon,
} from "@phosphor-icons/react";
import { formatDistanceToNow } from "date-fns";
import { api } from "@/trpc/react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { cn } from "@/lib/utils";
import {
  ContributorBadge,
  DifficultyBadge,
  EvaluatorScoreBadge,
  ResourceTypeBadge,
  TagBadge,
} from "@/components/badges";
import { Breadcrumb } from "@/components/breadcrumb";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Tab = "resources" | "subtopics" | "claims" | "history";

export default function TopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [activeTab, setActiveTab] = useState<Tab>("resources");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<
    NonNullable<typeof topic>["topicResources"][number] | null
  >(null);

  const { data: topic, isLoading } = api.topics.getBySlug.useQuery({ slug });
  const { data: claimsData } = api.claims.listByTopic.useQuery(
    { topicId: slug },
    { enabled: !!slug },
  );

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
          {/* Breadcrumb skeleton */}
          <div className="mb-6 flex items-center gap-2">
            <div className="h-4 w-12 animate-pulse rounded bg-muted" />
            <div className="h-4 w-4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          </div>
          {/* Header skeleton */}
          <div className="mb-8 rounded-2xl border border-border/50 bg-card p-6 md:p-8">
            <div className="mb-3 flex items-center gap-2">
              <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
              <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
            </div>
            <div className="mb-3 h-9 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-5 w-full animate-pulse rounded bg-muted" />
            <div className="mt-1.5 h-5 w-3/4 animate-pulse rounded bg-muted" />
          </div>
          {/* Tabs skeleton */}
          <div className="mb-6 flex gap-1 rounded-xl border border-border/50 bg-card p-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-1 rounded-lg px-4 py-2.5">
                <div className="mx-auto h-5 w-20 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
          {/* Resource cards skeleton */}
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-5"
              >
                <div className="flex items-center gap-2">
                  <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
                </div>
                <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-4 w-full animate-pulse rounded bg-muted" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <p className="font-serif text-[8rem] font-bold leading-none tracking-tight text-stone-200">
          404
        </p>
        <h1 className="mt-2 font-serif text-2xl font-semibold text-stone-800">
          Topic not found
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          The topic you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Back to home
        </Link>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ComponentType<any>; count?: number }[] = [
    { id: "resources", label: "Resources", icon: BookOpenIcon, count: topic.topicResources?.length },
    { id: "subtopics", label: "Subtopics", icon: GraphIcon, count: topic.childTopics?.length },
    { id: "claims", label: "Claims", icon: LightbulbIcon, count: claimsData?.length },
    { id: "history", label: "History", icon: ClockCounterClockwiseIcon, count: topic.revisions?.length },
  ];

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <Breadcrumb
          segments={[
            { label: "Home", href: "/" },
            ...(topic.parentTopic
              ? [{ label: topic.parentTopic.title, href: `/topic/${topic.parentTopic.id}` }]
              : []),
            { label: topic.title },
          ]}
        />

        {/* Header */}
        <div className="mb-8 rounded-2xl border border-border/50 bg-card p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <DifficultyBadge difficulty={topic.difficulty} />
                {topic.topicTags?.map(({ tag }) => (
                  <TagBadge key={tag.id} tag={tag} />
                ))}
              </div>
              <h1 className="mb-3 text-3xl font-bold tracking-tight md:text-4xl">
                {topic.title}
              </h1>
              {topic.summary && (
                <p className="text-muted-foreground leading-relaxed">{topic.summary}</p>
              )}
              {topic.createdBy && (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>Created by</span>
                  <ContributorBadge contributor={topic.createdBy} size="sm" />
                </div>
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
              topic.topicResources.map((tr) => (
                <motion.div
                  key={tr.resource.id}
                  onClick={() => { setSelectedResource(tr); setDialogOpen(true); }}
                  whileHover={{ scale: 1.02, boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className="flex cursor-pointer flex-col gap-3 rounded-xl border border-border/50 bg-card p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <ResourceTypeBadge type={tr.resource.type} />
                        {tr.relevanceScore > 0 && tr.relevanceScore !== 50 && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <StarIcon weight="fill" className="size-3 text-yellow-400" />
                            {tr.relevanceScore}%
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold leading-snug">{tr.resource.name}</h3>
                    </div>
                    {tr.resource.url && (
                      <a
                        href={tr.resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 rounded-lg border border-border p-2 text-muted-foreground hover:border-brand-blue hover:text-brand-blue"
                      >
                        <ArrowSquareOutIcon weight="bold" className="size-4" />
                      </a>
                    )}
                  </div>
                  {tr.resource.summary && (
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                      {tr.resource.summary}
                    </p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    {tr.resource.submittedBy && (
                      <ContributorBadge contributor={tr.resource.submittedBy} size="sm" />
                    )}
                    {tr.resource.score > 0 && (
                      <EvaluatorScoreBadge
                        score={tr.resource.score}
                        reviewNotes={tr.resource.reviewNotes}
                        size="sm"
                      />
                    )}
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="col-span-2 flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
                <BookOpenIcon weight="thin" className="mb-3 size-12 text-muted-foreground/40" />
                <p className="text-muted-foreground">No resources yet</p>
              </div>
            )}
          </div>
        )}

        {/* Subtopics tab */}
        {activeTab === "subtopics" && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {topic.childTopics && topic.childTopics.length > 0 ? (
              topic.childTopics.map((child) => (
                <motion.div
                  key={child.id}
                  whileHover={{ scale: 1.02, boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className="rounded-xl"
                >
                <Link
                  href={`/topic/${child.id}`}
                  className="flex flex-col gap-2 rounded-xl border border-border/50 bg-card p-5"
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
                </motion.div>
              ))
            ) : (
              <div className="col-span-3 flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
                <GraphIcon weight="thin" className="mb-3 size-12 text-muted-foreground/40" />
                <p className="text-muted-foreground">No subtopics yet</p>
              </div>
            )}
          </div>
        )}

        {/* Claims tab */}
        {activeTab === "claims" && (
          <div className="space-y-3">
            {claimsData && claimsData.length > 0 ? (
              claimsData.map((claim) => (
                <div
                  key={claim.id}
                  className="rounded-xl border border-border/50 bg-card p-5"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        claim.type === "warning" || claim.type === "caveat"
                          ? "bg-red-500/10 text-red-500"
                          : claim.type === "benchmark"
                            ? "bg-violet-500/10 text-violet-500"
                            : claim.type === "config"
                              ? "bg-blue-500/10 text-blue-500"
                              : "bg-emerald-500/10 text-emerald-500",
                      )}
                    >
                      {claim.type}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      confidence: {claim.confidence}%
                    </span>
                    {claim.endorsementCount > 0 && (
                      <span className="text-xs text-emerald-500">
                        +{claim.endorsementCount} endorsed
                      </span>
                    )}
                    {claim.disputeCount > 0 && (
                      <span className="text-xs text-red-400">
                        {claim.disputeCount} disputed
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed">{claim.body}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {claim.contributor && (
                      <ContributorBadge contributor={claim.contributor} size="sm" />
                    )}
                    {claim.sourceUrl && (
                      <a
                        href={claim.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-blue hover:underline"
                      >
                        {claim.sourceTitle ?? "Source"}
                      </a>
                    )}
                    <span>
                      {formatDistanceToNow(new Date(claim.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                    {claim.expiresAt && (
                      <span className="text-yellow-500">
                        expires{" "}
                        {formatDistanceToNow(new Date(claim.expiresAt), {
                          addSuffix: true,
                        })}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
                <LightbulbIcon
                  weight="thin"
                  className="mb-3 size-12 text-muted-foreground/40"
                />
                <p className="text-muted-foreground">No claims yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Agents can submit claims via MCP
                </p>
              </div>
            )}
          </div>
        )}

        {/* History tab */}
        {activeTab === "history" && (
          <div>
            {topic.revisions && topic.revisions.length > 0 ? (
              <div className="relative ml-4 border-l-2 border-border/50 pl-6">
                {topic.revisions.map((rev) => (
                  <div key={rev.id} className="relative mb-6 last:mb-0">
                    <div className="absolute -left-[31px] top-1 size-3 rounded-full border-2 border-border bg-card" />
                    <div className="rounded-xl border border-border/50 bg-card p-5">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold">
                          Rev {rev.revisionNumber}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(rev.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      {rev.changeSummary && (
                        <p className="mb-3 text-sm leading-relaxed">{rev.changeSummary}</p>
                      )}
                      {rev.contributor && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>by</span>
                          <ContributorBadge contributor={rev.contributor} size="sm" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
                <ClockCounterClockwiseIcon weight="thin" className="mb-3 size-12 text-muted-foreground/40" />
                <p className="text-muted-foreground">No revision history yet</p>
              </div>
            )}
          </div>
        )}
        {/* Resource detail dialog */}
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setTimeout(() => setSelectedResource(null), 200);
          }}
        >
          <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
            {selectedResource && (
              <>
                <DialogHeader>
                  <div className="mb-1 flex items-center gap-2">
                    <ResourceTypeBadge type={selectedResource.resource.type} />
                  </div>
                  <DialogTitle>{selectedResource.resource.name}</DialogTitle>
                  {selectedResource.resource.summary && (
                    <DialogDescription>
                      {selectedResource.resource.summary}
                    </DialogDescription>
                  )}
                </DialogHeader>
                <div className="space-y-4">
                  {selectedResource.resource.content && (
                    <p className="text-sm leading-relaxed">
                      {selectedResource.resource.content}
                    </p>
                  )}
                  {selectedResource.resource.url && (
                    <a
                      href={selectedResource.resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-brand-blue hover:text-brand-blue"
                    >
                      <ArrowSquareOutIcon weight="bold" className="size-4" />
                      Open resource
                    </a>
                  )}
                  <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                    {selectedResource.resource.submittedBy && (
                      <ContributorBadge
                        contributor={selectedResource.resource.submittedBy}
                        size="sm"
                      />
                    )}
                    {selectedResource.resource.score > 0 && (
                      <EvaluatorScoreBadge
                        score={selectedResource.resource.score}
                        reviewNotes={selectedResource.resource.reviewNotes}
                        size="sm"
                      />
                    )}
                    {selectedResource.relevanceScore > 0 &&
                      selectedResource.relevanceScore !== 50 && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <StarIcon weight="fill" className="size-3 text-yellow-400" />
                          {selectedResource.relevanceScore}% relevance
                        </span>
                      )}
                    {selectedResource.resource.createdAt && (
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(
                          new Date(selectedResource.resource.createdAt),
                          { addSuffix: true },
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
