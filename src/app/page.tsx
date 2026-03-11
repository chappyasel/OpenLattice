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
    PlugIcon,
    MagnifyingGlassIcon,
    TreasureChestIcon,
    ArrowsOutIcon,
    XIcon,
    FolderIcon,
    NewspaperIcon,
} from "@phosphor-icons/react";
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
    const { data: collectionsData } = api.collections.list.useQuery();
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
                <div className="flex min-h-screen flex-col items-center justify-center pb-16">
                    {/* Hero Section */}
                    <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-12">
                        <GrainientBackground />

                        <div className="relative text-center">
                            {/* Mascot */}
                            <div className="group mx-auto mb-4 flex justify-center">
                                <motion.div
                                    className="relative size-36 drop-shadow-md"
                                    whileHover={{
                                        scale: 1.1,
                                        rotate: 3,
                                        filter: "drop-shadow(0 12px 20px rgba(0,0,0,0.2))",
                                    }}
                                    transition={{ type: "spring", stiffness: 300, damping: 15 }}
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

                    {/* Suggested Topics */}
                    <div className="mx-auto -mt-16 w-full max-w-3xl px-6 pb-8">
                        <h2 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                            Suggested Topics
                        </h2>
                        <div className="grid gap-4 sm:grid-cols-3">
                            {topicsLoading
                                ? Array.from({ length: 3 }).map((_, i) => (
                                      <div
                                          key={i}
                                          className="flex flex-col gap-2 rounded-xl border border-border bg-card/80 backdrop-blur-sm p-4 animate-pulse"
                                      >
                                          <div className="h-4 w-2/3 rounded bg-muted" />
                                          <div className="h-3 w-full rounded bg-muted" />
                                          <div className="h-3 w-4/5 rounded bg-muted" />
                                          <div className="mt-auto h-3 w-20 rounded bg-muted" />
                                      </div>
                                  ))
                                : suggestedTopics?.map((topic) => (
                                      <motion.button
                                          key={topic.id}
                                          onClick={() => navigateToSlug(topic.id)}
                                          whileHover={{
                                              scale: 1.02,
                                              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                                          }}
                                          className="flex flex-col gap-2 rounded-xl border border-border bg-card/80 backdrop-blur-sm p-4 text-left transition-all hover:bg-card"
                                      >
                                          <h3 className="text-sm font-semibold">{topic.title}</h3>
                                          <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
                                              {topic.summary}
                                          </p>
                                          <span className="mt-auto flex items-center gap-1 text-xs text-brand-blue">
                                              Read article
                                              <ArrowRightIcon weight="bold" className="size-3" />
                                          </span>
                                      </motion.button>
                                  ))}
                        </div>
                    </div>

                    {/* Collections */}
                    {collectionsData && collectionsData.length > 0 && (
                        <div className="mx-auto w-full max-w-3xl px-6 pb-8">
                            <h2 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                Knowledge Collections
                            </h2>
                            <div className="grid gap-4 sm:grid-cols-2">
                                {collectionsData.map((col) => (
                                    <motion.div
                                        key={col.id}
                                        whileHover={{
                                            scale: 1.02,
                                            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                                        }}
                                        className="rounded-xl"
                                    >
                                        <Link
                                            href={`/collection/${col.slug}`}
                                            className="flex items-center gap-3 rounded-xl border border-border bg-card/80 backdrop-blur-sm p-4 transition-all hover:bg-card"
                                        >
                                            <div
                                                className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                                                style={{
                                                    backgroundColor: col.iconHue
                                                        ? `hsl(${col.iconHue}, 60%, 95%)`
                                                        : "hsl(210, 60%, 95%)",
                                                }}
                                            >
                                                <FolderIcon
                                                    weight="bold"
                                                    className="size-5 text-brand-blue"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-sm font-semibold">
                                                    {col.name}
                                                </h3>
                                                {col.description && (
                                                    <p className="text-xs text-muted-foreground line-clamp-1">
                                                        {col.description}
                                                    </p>
                                                )}
                                            </div>
                                            <ArrowRightIcon
                                                weight="bold"
                                                className="size-4 text-muted-foreground"
                                            />
                                        </Link>
                                    </motion.div>
                                ))}
                            </div>
                            <div className="mt-3 text-center">
                                <Link
                                    href="/digest"
                                    className="inline-flex items-center gap-1.5 text-xs text-brand-blue hover:underline"
                                >
                                    <NewspaperIcon weight="bold" className="size-3.5" />
                                    View Weekly Digest
                                </Link>
                            </div>
                        </div>
                    )}

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
