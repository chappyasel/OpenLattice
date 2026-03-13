"use client";

import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon } from "@phosphor-icons/react";
import { api } from "@/trpc/react";

interface TopicNavigationProps {
  topicId: string;
  parentTopicId: string | null;
}

export function TopicNavigation({ topicId, parentTopicId }: TopicNavigationProps) {
  const { data: siblings } = api.topics.listTree.useQuery(
    { parentTopicId: parentTopicId ?? undefined },
    { staleTime: 5 * 60 * 1000 },
  );

  if (!siblings || siblings.length <= 1) return null;

  const currentIndex = siblings.findIndex((t) => t.id === topicId);
  if (currentIndex === -1) return null;

  const prev = currentIndex > 0 ? siblings[currentIndex - 1] : null;
  const next = currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : null;

  if (!prev && !next) return null;

  return (
    <div className="mt-8 flex items-stretch gap-4">
      {prev ? (
        <Link
          href={`/topic/${prev.id}`}
          className="flex flex-1 items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent"
        >
          <ArrowLeftIcon weight="bold" className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Previous</p>
            <p className="truncate text-sm font-medium">{prev.title}</p>
          </div>
        </Link>
      ) : (
        <div className="flex-1" />
      )}
      {next ? (
        <Link
          href={`/topic/${next.id}`}
          className="flex flex-1 items-center justify-end gap-3 rounded-xl border border-border bg-card p-4 text-right transition-colors hover:bg-accent"
        >
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Next</p>
            <p className="truncate text-sm font-medium">{next.title}</p>
          </div>
          <ArrowRightIcon weight="bold" className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      ) : (
        <div className="flex-1" />
      )}
    </div>
  );
}
