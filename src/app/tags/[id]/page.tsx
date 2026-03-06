"use client";

import { use } from "react";
import Link from "next/link";
import {
  BookOpenIcon,
  LinkIcon,
  GraphIcon,
} from "@phosphor-icons/react";
import { api } from "@/trpc/react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { TopicIcon } from "@/components/topic-icon";
import { DifficultyBadge, ResourceTypeBadge } from "@/components/badges";
import { Breadcrumb } from "@/components/breadcrumb";

export default function TagPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: tag, isLoading } = api.tags.getById.useQuery({ id });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!tag) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <h1 className="text-2xl font-bold">Tag not found</h1>
        <Link href="/" className="mt-4 text-brand-blue hover:underline">
          ← Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <Breadcrumb segments={[{ label: "Home", href: "/" }, { label: tag.name }]} />

        {/* Header */}
        <div className="mb-8 rounded-2xl border border-border/50 bg-card p-6 md:p-8">
          <div className="mb-3 flex items-center gap-3">
            {tag.icon && <TopicIcon icon={tag.icon} hue={tag.iconHue} size="lg" />}
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              {tag.name}
            </h1>
          </div>
          {tag.description && (
            <p className="text-muted-foreground leading-relaxed">{tag.description}</p>
          )}
        </div>

        {/* Topics */}
        {tag.topicTags.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <GraphIcon weight="bold" className="size-5" />
              Topics
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                {tag.topicTags.length}
              </span>
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tag.topicTags.map(({ topic }) => (
                <Link
                  key={topic.id}
                  href={`/topic/${topic.id}`}
                  className="flex flex-col gap-2 rounded-xl border border-border/50 bg-card p-5 transition-colors hover:border-border"
                >
                  <div className="flex items-center gap-2">
                    {topic.icon && <TopicIcon icon={topic.icon} hue={topic.iconHue} size="sm" />}
                    <DifficultyBadge difficulty={topic.difficulty} />
                  </div>
                  <h3 className="font-semibold">{topic.title}</h3>
                  {topic.summary && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{topic.summary}</p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Resources */}
        {tag.resourceTags.length > 0 && (
          <div>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <BookOpenIcon weight="bold" className="size-5" />
              Resources
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                {tag.resourceTags.length}
              </span>
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {tag.resourceTags.map(({ resource }) => (
                <div
                  key={resource.id}
                  className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-5 transition-colors hover:border-border"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="mb-2">
                        <ResourceTypeBadge type={resource.type} />
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
                </div>
              ))}
            </div>
          </div>
        )}

        {tag.topicTags.length === 0 && tag.resourceTags.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
            <BookOpenIcon weight="thin" className="mb-3 size-12 text-muted-foreground/40" />
            <p className="text-muted-foreground">No topics or resources tagged yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
