"use client";

import { useMemo } from "react";
import {
  ArrowLeftIcon,
  CaretRightIcon,
  LinkIcon,
  StarIcon,
  RobotIcon,
  GraphIcon,
  BookOpenIcon,
  UserIcon,
} from "@phosphor-icons/react";
import { api } from "@/trpc/react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { DifficultyBadge, ResourceTypeBadge, TagBadge } from "@/components/badges";
import { MarkdownRenderer } from "@/components/markdown-renderer";

interface TopicWikiViewProps {
  slug: string;
  onNavigate: (slug: string) => void;
  onClose: () => void;
  allTopics: Array<{ id: string; title: string; parentTopicId: string | null }>;
}

export function TopicWikiView({ slug, onNavigate, onClose, allTopics }: TopicWikiViewProps) {
  const { data: topic, isLoading } = api.topics.getBySlug.useQuery({ slug });
  const { data: activityData } = api.activity.list.useQuery(
    { topicId: topic?.id ?? "", limit: 100 },
    { enabled: !!topic?.id },
  );
  const { data: neighbors } = api.topics.getNeighbors.useQuery(
    { topicId: topic?.id ?? "" },
    { enabled: !!topic?.id },
  );

  // Build breadcrumbs by walking parentTopicId chain
  const breadcrumbs = useMemo(() => {
    if (!topic) return [];
    const topicMap = new Map(allTopics.map((t) => [t.id, t]));
    const crumbs: Array<{ id: string; title: string }> = [];
    let current = topicMap.get(topic.parentTopicId ?? "");
    while (current) {
      crumbs.unshift({ id: current.id, title: current.title });
      current = topicMap.get(current.parentTopicId ?? "");
    }
    return crumbs;
  }, [topic, allTopics]);

  // Deduplicate contributors from activity
  const contributors = useMemo(() => {
    if (!activityData?.items) return [];
    const seen = new Map<string, { id: string; name: string; type: string; isAgent: boolean }>();
    for (const item of activityData.items) {
      if (item.contributor && !seen.has(item.contributor.id)) {
        seen.set(item.contributor.id, {
          id: item.contributor.id,
          name: item.contributor.name,
          type: item.type,
          isAgent: item.contributor.isAgent,
        });
      }
    }
    return [...seen.values()];
  }, [activityData]);

  // Related topics from neighbors
  const relatedTopics = useMemo(() => {
    if (!neighbors || !topic) return [];
    const related: Array<{ id: string; title: string; relation: string }> = [];
    for (const edge of neighbors.sourceEdges) {
      if (edge.targetTopic) {
        related.push({
          id: edge.targetTopic.id,
          title: edge.targetTopic.title,
          relation: edge.relationType,
        });
      }
    }
    for (const edge of neighbors.targetEdges) {
      if (edge.sourceTopic) {
        related.push({
          id: edge.sourceTopic.id,
          title: edge.sourceTopic.title,
          relation: edge.relationType,
        });
      }
    }
    return related;
  }, [neighbors, topic]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <p className="text-sm">Topic not found</p>
        <button onClick={onClose} className="text-xs text-brand-blue hover:underline">
          Back to graph
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* Breadcrumbs */}
        <div className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1 text-brand-blue hover:underline"
          >
            <ArrowLeftIcon weight="bold" className="size-3.5" />
            Graph
          </button>
          {breadcrumbs.map((crumb) => (
            <span key={crumb.id} className="inline-flex items-center gap-1.5">
              <CaretRightIcon weight="bold" className="size-3 text-muted-foreground/50" />
              <button
                onClick={() => onNavigate(crumb.id)}
                className="hover:text-foreground hover:underline"
              >
                {crumb.title}
              </button>
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <CaretRightIcon weight="bold" className="size-3 text-muted-foreground/50" />
            <span className="font-medium text-foreground">{topic.title}</span>
          </span>
        </div>

        {/* Header */}
        <div className="mb-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <DifficultyBadge difficulty={topic.difficulty} />
            {topic.topicTags?.map(({ tag }) => (
              <TagBadge key={tag.id} tag={tag} />
            ))}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{topic.title}</h1>
        </div>

        {/* Summary */}
        {topic.summary && (
          <p className="mb-8 text-lg leading-relaxed text-muted-foreground">
            {topic.summary}
          </p>
        )}

        {/* Content */}
        {topic.content && (
          <div className="mb-10">
            <MarkdownRenderer
              content={topic.content}
              onInternalLinkClick={onNavigate}
            />
          </div>
        )}

        {/* Resources */}
        {topic.topicResources && topic.topicResources.length > 0 && (
          <div className="mb-10">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
              <BookOpenIcon weight="bold" className="size-5" />
              Resources
              <span className="text-sm font-normal text-muted-foreground">
                ({topic.topicResources.length})
              </span>
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {topic.topicResources.map(({ resource, relevanceScore }) => (
                <div
                  key={resource.id}
                  className="flex flex-col gap-2 rounded-xl border border-border/50 bg-card p-4 transition-colors hover:border-border"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="mb-1.5 flex items-center gap-2">
                        <ResourceTypeBadge type={resource.type} />
                        {relevanceScore && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <StarIcon weight="fill" className="size-3 text-yellow-400" />
                            {(relevanceScore * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold leading-snug">{resource.name}</h3>
                    </div>
                    {resource.url && (
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded-lg border border-border p-1.5 text-muted-foreground hover:border-brand-blue hover:text-brand-blue"
                      >
                        <LinkIcon weight="bold" className="size-3.5" />
                      </a>
                    )}
                  </div>
                  {resource.summary && (
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {resource.summary}
                    </p>
                  )}
                  {resource.submittedById && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <RobotIcon weight="bold" className="size-3" />
                      Submitted by agent
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contributors */}
        {contributors.length > 0 && (
          <div className="mb-10">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
              <UserIcon weight="bold" className="size-5" />
              Contributors
              <span className="text-sm font-normal text-muted-foreground">
                ({contributors.length})
              </span>
            </h2>
            <div className="flex flex-wrap gap-2">
              {contributors.map((c) => (
                <div
                  key={c.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-card px-3 py-1.5 text-xs"
                >
                  {c.isAgent ? (
                    <RobotIcon weight="bold" className="size-3 text-brand-blue" />
                  ) : (
                    <UserIcon weight="bold" className="size-3 text-muted-foreground" />
                  )}
                  <span className="font-medium">{c.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Related topics */}
        {relatedTopics.length > 0 && (
          <div className="mb-10">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
              <GraphIcon weight="bold" className="size-5" />
              Related Topics
            </h2>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {relatedTopics.map((rt) => (
                <button
                  key={rt.id}
                  onClick={() => onNavigate(rt.id)}
                  className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-3 text-left transition-colors hover:border-border"
                >
                  <GraphIcon weight="bold" className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{rt.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">{rt.relation}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Subtopics */}
        {topic.childTopics && topic.childTopics.length > 0 && (
          <div className="mb-10">
            <h2 className="mb-4 text-xl font-semibold">Subtopics</h2>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {topic.childTopics.map((child) => (
                <button
                  key={child.id}
                  onClick={() => onNavigate(child.id)}
                  className="flex flex-col gap-1.5 rounded-xl border border-border/50 bg-card p-4 text-left transition-colors hover:border-border"
                >
                  <DifficultyBadge difficulty={child.difficulty} />
                  <p className="text-sm font-semibold">{child.title}</p>
                  {child.summary && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{child.summary}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
