"use client";

import { use } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FolderIcon,
  GraphIcon,
  TreasureChestIcon,
  TreeStructureIcon,
  UsersIcon,
  ClockIcon,
} from "@phosphor-icons/react";
import { api } from "@/trpc/react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Breadcrumb } from "@/components/breadcrumb";
import { TopicIcon } from "@/components/topic-icon";
import { DifficultyBadge } from "@/components/badges";
import { formatDistanceToNow } from "date-fns";

interface TreeTopic {
  id: string;
  title: string;
  parentTopicId: string | null;
  depth: number;
  icon: string | null;
  iconHue: number | null;
  status: string;
  freshnessScore: number;
  contributorCount: number;
  sourceCount: number;
  sortOrder: number;
}

function TopicTreeNode({
  topic,
  childrenMap,
  depth,
}: {
  topic: TreeTopic;
  childrenMap: Map<string | null, TreeTopic[]>;
  depth: number;
}) {
  const children = childrenMap.get(topic.id) ?? [];
  return (
    <div>
      <Link
        href={`/topic/${topic.id}`}
        className="group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent"
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        <TopicIcon icon={topic.icon} iconHue={topic.iconHue} size={16} />
        <span className="flex-1 font-medium group-hover:text-brand-blue">
          {topic.title}
        </span>
        {topic.sourceCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {topic.sourceCount} sources
          </span>
        )}
      </Link>
      {children.map((child) => (
        <TopicTreeNode
          key={child.id}
          topic={child}
          childrenMap={childrenMap}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

export default function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  const { data, isLoading } = api.collections.getTree.useQuery({ slug });
  const { data: stats } = api.collections.getStats.useQuery({ slug });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <p className="font-serif text-[8rem] font-bold leading-none tracking-tight text-stone-200">
          404
        </p>
        <h1 className="mt-2 font-serif text-2xl font-semibold text-stone-800">
          Collection not found
        </h1>
        <Link
          href="/"
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Back to home
        </Link>
      </div>
    );
  }

  const { collection, topics } = data;

  // Build tree
  const childrenMap = new Map<string | null, TreeTopic[]>();
  for (const t of topics) {
    const parentId = t.parentTopicId ?? null;
    if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
    childrenMap.get(parentId)!.push(t);
  }
  const rootTopics = childrenMap.get(null) ?? [];

  const totalContributors = new Set(
    topics.filter((t) => t.contributorCount > 0).map((t) => t.id),
  ).size;

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <Breadcrumb
          segments={[
            { label: "Home", href: "/" },
            { label: collection.name },
          ]}
        />

        {/* Collection Header */}
        <div className="mb-8 rounded-2xl border border-border/50 bg-card p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div
              className="flex size-14 shrink-0 items-center justify-center rounded-2xl"
              style={{
                backgroundColor: collection.iconHue
                  ? `hsl(${collection.iconHue}, 60%, 95%)`
                  : undefined,
              }}
            >
              <FolderIcon weight="bold" className="size-7 text-brand-blue" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                {collection.name}
              </h1>
              {collection.description && (
                <p className="mt-2 text-muted-foreground leading-relaxed">
                  {collection.description}
                </p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-border/50 pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{stats?.topicCount ?? topics.length}</p>
              <p className="text-xs text-muted-foreground">Topics</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{rootTopics.length}</p>
              <p className="text-xs text-muted-foreground">Root Topics</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{totalContributors}</p>
              <p className="text-xs text-muted-foreground">With Contributors</p>
            </div>
          </div>
        </div>

        {/* Topic Tree */}
        <div className="rounded-2xl border border-border/50 bg-card">
          <div className="flex items-center gap-2 border-b border-border/50 px-5 py-4">
            <TreeStructureIcon weight="bold" className="size-4 text-brand-blue" />
            <h2 className="text-sm font-semibold">Topic Tree</h2>
            <span className="ml-auto text-xs text-muted-foreground">
              {topics.length} topics
            </span>
          </div>
          <div className="p-2">
            {rootTopics.length > 0 ? (
              rootTopics.map((topic) => (
                <TopicTreeNode
                  key={topic.id}
                  topic={topic}
                  childrenMap={childrenMap}
                  depth={0}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <GraphIcon
                  weight="thin"
                  className="mb-3 size-12 text-muted-foreground/40"
                />
                <p className="text-sm text-muted-foreground">
                  No topics in this collection yet
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
