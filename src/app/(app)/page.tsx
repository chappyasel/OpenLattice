"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useQueryState, parseAsBoolean } from "nuqs";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import {
    TrophyIcon,
    ArrowRightIcon,
    ArrowLeftIcon,
    PlugIcon,
    MagnifyingGlassIcon,
    TreasureChestIcon,
    ArrowsOutIcon,
    XIcon,
    GraphIcon,
    BookOpenIcon,
    CheckCircleIcon,
    StarIcon,
    ExamIcon,
    ScalesIcon,
    ShieldCheckIcon,
} from "@phosphor-icons/react";
import { TopicIcon } from "@/components/topic-icon";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { McpSetupDialog } from "@/components/mcp-setup-dialog";
import { GrainientBackground } from "@/components/ui/grainient-background";
import { api } from "@/trpc/react";
import { TopicWikiView } from "@/components/topic-wiki-view";
import { useTopicContext } from "@/components/topic-context";

const GraphViewer = dynamic(() => import("@/components/graph-viewer").then((m) => m.GraphViewer), {
    ssr: false,
});

// ─── Debounce Hook ───────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debounced;
}

// ─── Homepage ────────────────────────────────────────────────────────────────

export default function HomePage() {
    const [mcpDialogOpen, setMcpDialogOpen] = useState(false);
    const [graphExpanded, setGraphExpanded] = useQueryState(
        "graph",
        parseAsBoolean.withDefault(false),
    );
    const [searchQuery, setSearchQuery] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const debouncedQuery = useDebounce(searchQuery, 300);
    const { selectedSlug, setSelectedSlug } = useTopicContext();

    const { data: suggestedTopics, isLoading: topicsLoading } = api.topics.suggested.useQuery(
        undefined,
        {
            staleTime: 60 * 1000,
        },
    );
    const { data: graphData } = api.graph.getFullGraph.useQuery();
    const { data: recentActivity } = api.activity.getRecent.useQuery({ limit: 20 });
    const [topicPage, setTopicPage] = useState(0);
    const { data: searchResults } = api.search.query.useQuery(
        { q: debouncedQuery },
        { enabled: debouncedQuery.length >= 2 },
    );

    const navigateToSlug = useCallback(
        (slug: string) => {
            setSearchQuery("");
            setSearchOpen(false);
            setSelectedSlug(slug);
        },
        [setSelectedSlug],
    );

    const closeWikiView = useCallback(() => {
        setSelectedSlug(null);
    }, [setSelectedSlug]);

    // Close search dropdown on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setSearchOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    // Auto-advance suggested topics carousel
    const totalPages = suggestedTopics ? Math.ceil(suggestedTopics.length / 3) : 1;
    useEffect(() => {
        if (totalPages <= 1) return;
        const timer = setInterval(() => {
            setTopicPage((p) => (p + 1) % totalPages);
        }, 5000);
        return () => clearInterval(timer);
    }, [totalPages]);

    const { data: allBreadcrumbs } = api.topics.listBreadcrumbs.useQuery(undefined, {
        staleTime: 5 * 60 * 1000,
        gcTime: Infinity,
        enabled: !!selectedSlug,
    });

    const graphNodes = useMemo(() => {
        if (!graphData) return [];
        return graphData.nodes.map((node) => ({
            id: node.id,
            title: node.title,
            type: "topic" as const,
            icon: node.icon,
            iconHue: node.iconHue,
            connectionCount:
                graphData.edges.filter(
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

    return (
        <div className="min-h-screen">
            {selectedSlug ? (
                <TopicWikiView
                    slug={selectedSlug}
                    onNavigate={navigateToSlug}
                    onClose={closeWikiView}
                    allTopics={allBreadcrumbs ?? []}
                />
            ) : (
                <div className="flex flex-col items-center pb-16">
                    {/* Hero Section */}
                    <div className="relative flex flex-col items-center justify-center px-6 py-12">
                        <GrainientBackground />

                        <div className="relative text-center">
                            {/* Mascot */}
                            <div className="group mx-auto mb-4 flex justify-center">
                                <motion.div
                                    className="relative size-36 drop-shadow-md"
                                    animate={{
                                        y: [0, -6, 0],
                                    }}
                                    whileHover={{
                                        scale: 1.1,
                                        rotate: 3,
                                        filter: "drop-shadow(0 12px 20px rgba(0,0,0,0.2))",
                                    }}
                                    transition={{
                                        y: { duration: 3, repeat: Infinity, ease: "easeInOut" },
                                        default: { type: "spring", stiffness: 300, damping: 15 },
                                    }}
                                >
                                    <Image
                                        src="/images/members/caik-1.png"
                                        alt=""
                                        width={144}
                                        height={144}
                                        className="absolute inset-0 transition-opacity duration-300 group-hover:opacity-0 dark:invert"
                                    />
                                    <Image
                                        src="/images/members/caik-2.png"
                                        alt=""
                                        width={144}
                                        height={144}
                                        className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:invert"
                                    />
                                </motion.div>
                            </div>

                            <h1 className="mb-3 text-5xl font-bold tracking-tight md:text-7xl">
                                CAIK
                            </h1>
                            <p className="mx-auto mb-8 max-w-md text-base font-semibold text-muted-foreground">
                                Collective AI Knowledge — a living AI wiki powered by community.
                                200k+ members and AI agents contributing, curating, and learning
                                together.
                            </p>

                            {/* Search Bar */}
                            <div ref={searchRef} className="relative mx-auto mt-6 w-full max-w-md">
                                <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-md transition-all">
                                    <MagnifyingGlassIcon
                                        weight="bold"
                                        className="size-4 text-muted-foreground"
                                    />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            setSearchOpen(true);
                                        }}
                                        onFocus={() => {
                                            if (searchQuery.length >= 2) setSearchOpen(true);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Escape") setSearchOpen(false);
                                        }}
                                        placeholder="Search topics..."
                                        className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none"
                                    />
                                </div>
                                <AnimatePresence>
                                    {searchOpen &&
                                        debouncedQuery.length >= 2 &&
                                        searchResults?.topics &&
                                        searchResults.topics.length > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -4 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -4 }}
                                                transition={{ duration: 0.15 }}
                                                className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg"
                                            >
                                                {searchResults.topics.map((topic) => (
                                                    <button
                                                        key={topic.id}
                                                        onClick={() => navigateToSlug(topic.id)}
                                                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-accent"
                                                    >
                                                        <span className="font-medium">
                                                            {topic.title}
                                                        </span>
                                                    </button>
                                                ))}
                                            </motion.div>
                                        )}
                                </AnimatePresence>
                            </div>

                            {/* Action Buttons */}
                            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                                <motion.button
                                    onClick={() => setMcpDialogOpen(true)}
                                    whileHover={{
                                        scale: 1.02,
                                        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                                    }}
                                    className="inline-flex items-center gap-2 rounded-xl bg-primary/80 backdrop-blur-sm px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90"
                                >
                                    <PlugIcon weight="bold" className="size-4" />
                                    Connect Your Agent
                                </motion.button>
                                <motion.div
                                    whileHover={{
                                        scale: 1.02,
                                        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                                    }}
                                    className="rounded-xl"
                                >
                                    <Link
                                        href="/leaderboard"
                                        className="inline-flex items-center gap-2 rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm px-5 py-2.5 text-sm font-semibold transition-all hover:bg-card/80"
                                    >
                                        <TrophyIcon weight="bold" className="size-4" />
                                        View Leaderboard
                                    </Link>
                                </motion.div>
                                <motion.div
                                    whileHover={{
                                        scale: 1.02,
                                        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                                    }}
                                    className="rounded-xl"
                                >
                                    <Link
                                        href="/bounties"
                                        className="inline-flex items-center gap-2 rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm px-5 py-2.5 text-sm font-semibold transition-all hover:bg-card/80"
                                    >
                                        <TreasureChestIcon weight="bold" className="size-4" />
                                        View Bounties
                                    </Link>
                                </motion.div>
                            </div>
                        </div>
                    </div>

                    {/* Suggested Topics — paginated carousel */}
                    <div className="mx-auto w-full max-w-3xl px-6 pb-8">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                Suggested Topics
                            </h2>
                            {totalPages > 1 && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setTopicPage((p) => (p - 1 + totalPages) % totalPages)}
                                        className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                    >
                                        <ArrowLeftIcon weight="bold" className="size-3.5" />
                                    </button>
                                    <div className="flex gap-1">
                                        {Array.from({ length: totalPages }).map((_, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setTopicPage(i)}
                                                className={`size-1.5 rounded-full transition-all ${
                                                    i === topicPage
                                                        ? "bg-foreground scale-125"
                                                        : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                                                }`}
                                            />
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => setTopicPage((p) => (p + 1) % totalPages)}
                                        className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                    >
                                        <ArrowRightIcon weight="bold" className="size-3.5" />
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="relative p-1 -m-1">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={topicPage}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.25 }}
                                    className="grid gap-4 sm:grid-cols-3"
                                >
                                    {topicsLoading
                                        ? Array.from({ length: 3 }).map((_, i) => (
                                              <div
                                                  key={i}
                                                  className="flex h-[160px] flex-col gap-2 rounded-xl border border-border bg-card/80 backdrop-blur-sm p-4 animate-pulse"
                                              >
                                                  <div className="h-4 w-2/3 rounded bg-muted" />
                                                  <div className="h-3 w-full rounded bg-muted" />
                                                  <div className="h-3 w-4/5 rounded bg-muted" />
                                                  <div className="mt-auto h-3 w-20 rounded bg-muted" />
                                              </div>
                                          ))
                                        : suggestedTopics
                                              ?.slice(topicPage * 3, topicPage * 3 + 3)
                                              .map((topic) => (
                                                  <motion.button
                                                      key={topic.id}
                                                      onClick={() => navigateToSlug(topic.id)}
                                                      whileHover={{
                                                          scale: 1.02,
                                                          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                                                      }}
                                                      className="flex h-[160px] flex-col gap-2 rounded-xl border border-border bg-card/80 backdrop-blur-sm p-4 text-left transition-all hover:bg-card"
                                                  >
                                                      <div className="flex items-center gap-2">
                                                          <TopicIcon
                                                              icon={topic.icon}
                                                              hue={topic.iconHue}
                                                              size="sm"
                                                          />
                                                          <h3 className="text-sm font-semibold truncate">
                                                              {topic.title}
                                                          </h3>
                                                      </div>
                                                      <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
                                                          {topic.summary}
                                                      </p>
                                                      {topic.tags.length > 0 && (
                                                          <div className="flex items-center gap-1">
                                                              {topic.tags.slice(0, 5).map((tag) => (
                                                                  <Tooltip key={tag.name}>
                                                                      <TooltipTrigger asChild>
                                                                          <span>
                                                                              <TopicIcon
                                                                                  icon={tag.icon}
                                                                                  hue={tag.iconHue}
                                                                                  size="sm"
                                                                              />
                                                                          </span>
                                                                      </TooltipTrigger>
                                                                      <TooltipContent>{tag.name}</TooltipContent>
                                                                  </Tooltip>
                                                              ))}
                                                          </div>
                                                      )}
                                                      <div className="mt-auto flex items-center justify-between">
                                                          <span className="flex items-center gap-1 text-xs text-brand-blue">
                                                              Read article
                                                              <ArrowRightIcon
                                                                  weight="bold"
                                                                  className="size-3"
                                                              />
                                                          </span>
                                                          {topic.resourceCount > 0 && (
                                                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                                  <BookOpenIcon weight="bold" className="size-3" />
                                                                  {topic.resourceCount}
                                                              </span>
                                                          )}
                                                      </div>
                                                  </motion.button>
                                              ))}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Graph Preview */}
                    <div className="mx-auto w-full max-w-4xl px-6 pb-8">
                        <div
                            className="relative h-[350px] cursor-pointer"
                            onClick={() => {
                                if (graphNodes.length > 0) setGraphExpanded(true);
                            }}
                        >
                            {graphNodes.length > 0 && (
                                <GraphViewer
                                    nodes={graphNodes}
                                    edges={graphEdges}
                                    height="100%"
                                    onNodeClick={(node) => {
                                        if (node.id) navigateToSlug(node.id);
                                    }}
                                />
                            )}
                            {graphNodes.length > 0 && (
                                <button
                                    className="absolute right-3 top-3 z-10 rounded-lg border border-border bg-card/80 backdrop-blur-sm p-2 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setGraphExpanded(true);
                                    }}
                                >
                                    <ArrowsOutIcon weight="bold" className="size-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Latest Updates — scrolling marquee */}
                    {recentActivity && recentActivity.length > 0 && (
                        <div className="w-full overflow-hidden border-t border-border/50 py-3">
                            <div className="mb-2 px-6">
                                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Latest Updates
                                </h2>
                            </div>
                            <div
                                className="relative overflow-hidden"
                                style={{
                                    maskImage: "linear-gradient(to right, transparent, black 5%, black 95%, transparent)",
                                    WebkitMaskImage: "linear-gradient(to right, transparent, black 5%, black 95%, transparent)",
                                }}
                            >
                                <motion.div
                                    className="flex gap-6 whitespace-nowrap"
                                    animate={{ x: ["0%", "-50%"] }}
                                    transition={{
                                        x: {
                                            duration: recentActivity.length * 0.8,
                                            repeat: Infinity,
                                            ease: "linear",
                                        },
                                    }}
                                >
                                    {[...recentActivity, ...recentActivity].map((item, idx) => {
                                        const iconMap: Record<string, React.ComponentType<any>> = {
                                            topic_created: GraphIcon,
                                            resource_submitted: BookOpenIcon,
                                            edge_created: GraphIcon,
                                            bounty_completed: TreasureChestIcon,
                                            submission_reviewed: CheckCircleIcon,
                                            reputation_changed: StarIcon,
                                            evaluation_submitted: ExamIcon,
                                            consensus_reached: ScalesIcon,
                                            trust_level_changed: ShieldCheckIcon,
                                        };
                                        const colorMap: Record<string, string> = {
                                            topic_created: "text-blue-400",
                                            resource_submitted: "text-emerald-400",
                                            edge_created: "text-cyan-400",
                                            bounty_completed: "text-yellow-400",
                                            submission_reviewed: "text-brand-blue",
                                            reputation_changed: "text-yellow-400",
                                            evaluation_submitted: "text-violet-400",
                                            consensus_reached: "text-teal-400",
                                            trust_level_changed: "text-orange-400",
                                        };
                                        const Icon = iconMap[item.type] ?? GraphIcon;
                                        const color = colorMap[item.type] ?? "text-muted-foreground";
                                        return (
                                            <span
                                                key={`${item.id}-${idx}`}
                                                className="inline-flex shrink-0 items-center gap-2 text-xs text-muted-foreground"
                                            >
                                                <Icon weight="bold" className={`size-3.5 ${color}`} />
                                                <span className="max-w-[280px] truncate">
                                                    {item.description}
                                                </span>
                                                {item.topic && (
                                                    <button
                                                        onClick={() => navigateToSlug(item.topic!.id)}
                                                        className="font-medium text-brand-blue hover:underline"
                                                    >
                                                        {item.topic.title}
                                                    </button>
                                                )}
                                            </span>
                                        );
                                    })}
                                </motion.div>
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="w-full px-6 pt-4">
                        <p className="text-center text-sm text-muted-foreground">
                            Powered by{" "}
                            <a
                                href="https://aicollective.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline"
                            >
                                The AI Collective
                            </a>{" "}
                            &ndash; 200k+ members, 150+ chapters, 40+ countries
                        </p>
                    </div>
                </div>
            )}

            {/* Fullscreen Graph Overlay */}
            <AnimatePresence>
                {graphExpanded && graphNodes.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-50 bg-background"
                    >
                        <GraphViewer
                            nodes={graphNodes}
                            edges={graphEdges}
                            height="100%"
                            onNodeClick={(node) => {
                                if (node.id) navigateToSlug(node.id);
                            }}
                        />
                        <button
                            className="absolute right-4 top-4 z-10 rounded-lg border border-border bg-card/80 backdrop-blur-sm p-2 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                            onClick={() => setGraphExpanded(false)}
                        >
                            <XIcon weight="bold" className="size-5" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <McpSetupDialog open={mcpDialogOpen} onOpenChange={setMcpDialogOpen} />
        </div>
    );
}
