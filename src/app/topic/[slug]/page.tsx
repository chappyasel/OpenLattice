"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  BookOpenIcon,
  GraphIcon,
  RobotIcon,
  LinkIcon,
  StarIcon,
} from "@phosphor-icons/react";
import { api } from "@/trpc/react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { cn } from "@/lib/utils";
import {
  DifficultyBadge,
  ResourceTypeBadge,
  TagBadge,
} from "@/components/badges";
import { Breadcrumb } from "@/components/breadcrumb";

type Tab = "resources" | "subtopics";

export default function TopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [activeTab, setActiveTab] = useState<Tab>("resources");

  const { data: topic, isLoading } = api.topics.getBySlug.useQuery({ slug });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <h1 className="text-2xl font-bold">Topic not found</h1>
        <Link href="/" className="mt-4 text-brand-blue hover:underline">
          ← Back to home
        </Link>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ComponentType<any>; count?: number }[] = [
    { id: "resources", label: "Resources", icon: BookOpenIcon, count: topic.topicResources?.length },
    { id: "subtopics", label: "Subtopics", icon: GraphIcon, count: topic.childTopics?.length },
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
                        className="shrink-0 rounded-lg border border-border p-2 text-muted-foreground hover:border-brand-blue hover:text-brand-blue"
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

        {/* Subtopics tab */}
        {activeTab === "subtopics" && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {topic.childTopics && topic.childTopics.length > 0 ? (
              topic.childTopics.map((child) => (
                <Link
                  key={child.id}
                  href={`/topic/${child.id}`}
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
