"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  MagnifyingGlassIcon,
  CaretRightIcon,
  CaretDownIcon,
  GraphIcon,
  CircleIcon,
} from "@phosphor-icons/react";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";

const GraphViewer = dynamic(
  () => import("@/components/graph-viewer").then((m) => m.GraphViewer),
  { ssr: false },
);

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const colors: Record<string, string> = {
    beginner: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    intermediate: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    advanced: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        colors[difficulty] ?? "bg-muted text-muted-foreground border-border",
      )}
    >
      {difficulty}
    </span>
  );
}

interface TopicWithChildren {
  id: string;
  title: string;
  slug: string;
  difficulty: string;
  parentTopicId: string | null;
  children?: TopicWithChildren[];
}

function TopicTreeItem({
  topic,
  depth = 0,
  onSelect,
  selectedId,
}: {
  topic: TopicWithChildren;
  depth?: number;
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = topic.children && topic.children.length > 0;

  return (
    <div>
      <div
        className={cn(
          "flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors",
          selectedId === topic.id
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onSelect(topic.id)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((p) => !p);
            }}
            className="shrink-0"
          >
            {expanded ? (
              <CaretDownIcon weight="bold" className="size-3" />
            ) : (
              <CaretRightIcon weight="bold" className="size-3" />
            )}
          </button>
        ) : (
          <CircleIcon weight="fill" className="size-2 shrink-0 opacity-40" />
        )}
        <span className="min-w-0 flex-1 truncate text-xs">{topic.title}</span>
      </div>
      {hasChildren && expanded && (
        <div>
          {topic.children!.map((child) => (
            <TopicTreeItem
              key={child.id}
              topic={child}
              depth={depth + 1}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ExplorePage() {
  const [search, setSearch] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { data: graphData } = api.graph.getFullGraph.useQuery();
  const { data: allTopics } = api.topics.list.useQuery({ status: "published" });

  // Build topic tree
  const topicTree = useMemo<TopicWithChildren[]>(() => {
    if (!allTopics) return [];
    const topicMap = new Map<string, TopicWithChildren>(
      allTopics.map((t) => ({
        ...t,
        topicTags: undefined,
        content: undefined,
        summary: undefined,
        sortOrder: undefined,
        status: undefined,
        createdAt: undefined,
        updatedAt: undefined,
      })).map((t) => [t.id, { ...t, children: [] } as TopicWithChildren]),
    );
    const roots: TopicWithChildren[] = [];
    for (const topic of topicMap.values()) {
      if (topic.parentTopicId && topicMap.has(topic.parentTopicId)) {
        topicMap.get(topic.parentTopicId)!.children!.push(topic);
      } else {
        roots.push(topic);
      }
    }
    return roots;
  }, [allTopics]);

  const filteredTopics = useMemo(() => {
    if (!allTopics) return [];
    if (!search) return allTopics;
    const q = search.toLowerCase();
    return allTopics.filter((t) => t.title.toLowerCase().includes(q));
  }, [allTopics, search]);

  const graphNodes = useMemo(() => {
    if (!graphData) return [];
    return graphData.nodes.map((node) => ({
      id: node.id,
      slug: node.slug,
      title: node.title,
      type: "topic" as const,
      connectionCount: graphData.edges.filter(
        (e) => e.sourceTopicId === node.id || e.targetTopicId === node.id,
      ).length + 1,
    }));
  }, [graphData]);

  const graphEdges = useMemo(
    () =>
      graphData?.edges.map((edge) => ({
        id: edge.id,
        sourceTopicId: edge.sourceTopicId,
        targetTopicId: edge.targetTopicId,
        relationType: edge.relationType,
      })) ?? [],
    [graphData],
  );

  const selectedTopic = allTopics?.find((t) => t.id === selectedTopicId);

  return (
    <div className="flex h-screen overflow-hidden pt-14">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="flex w-64 shrink-0 flex-col border-r border-border/50 bg-card">
          <div className="p-3">
            <div className="relative">
              <MagnifyingGlassIcon
                weight="bold"
                className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search topics..."
                className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {search ? (
              filteredTopics.map((topic) => (
                <div
                  key={topic.id}
                  className={cn(
                    "flex cursor-pointer flex-col gap-1 rounded-md px-2 py-2 text-xs transition-colors",
                    selectedTopicId === topic.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                  onClick={() => setSelectedTopicId(topic.id)}
                >
                  <span className="font-medium">{topic.title}</span>
                  <DifficultyBadge difficulty={topic.difficulty} />
                </div>
              ))
            ) : (
              topicTree.map((topic) => (
                <TopicTreeItem
                  key={topic.id}
                  topic={topic}
                  onSelect={setSelectedTopicId}
                  selectedId={selectedTopicId}
                />
              ))
            )}
          </div>

          {selectedTopic && (
            <div className="border-t border-border/50 p-3">
              <div className="rounded-lg bg-background p-3">
                <p className="mb-1 text-xs font-semibold">{selectedTopic.title}</p>
                <DifficultyBadge difficulty={selectedTopic.difficulty} />
                {selectedTopic.summary && (
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-3">
                    {selectedTopic.summary}
                  </p>
                )}
                <Link
                  href={`/topic/${selectedTopic.slug}`}
                  className="mt-2 block text-xs font-medium text-primary hover:underline"
                >
                  View topic →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Graph */}
      <div className="relative flex-1 bg-[hsl(224,20%,6%)]">
        <button
          onClick={() => setSidebarOpen((p) => !p)}
          className="absolute left-3 top-3 z-10 rounded-lg border border-border/50 bg-card/80 p-2 text-muted-foreground backdrop-blur-sm hover:text-foreground"
        >
          <GraphIcon weight="bold" className="size-4" />
        </button>

        {graphNodes.length > 0 ? (
          <GraphViewer
            nodes={graphNodes}
            edges={graphEdges}
            height="100%"
            selectedNodeId={selectedTopicId ?? undefined}
            onNodeClick={(node) => setSelectedTopicId(node.id)}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-muted-foreground">
              <GraphIcon weight="thin" className="mx-auto mb-3 size-16 opacity-20" />
              <p className="text-sm">Knowledge graph is empty</p>
              <p className="text-xs opacity-60">Topics will appear here once published</p>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-4 right-4 rounded-xl border border-border/50 bg-card/80 p-3 text-xs backdrop-blur-sm">
          <p className="mb-2 font-semibold text-foreground">Edge types</p>
          <div className="space-y-1">
            {[
              { color: "bg-slate-400", label: "Subtopic" },
              { color: "bg-indigo-400", label: "Related" },
              { color: "bg-violet-400", label: "Prerequisite" },
              { color: "bg-emerald-400", label: "See also" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2 text-muted-foreground">
                <span className={`h-0.5 w-4 rounded ${color} opacity-70`} />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
