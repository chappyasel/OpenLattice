"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  MagnifyingGlassIcon,
  ArrowRightIcon,
  BookOpenIcon,
  CheckCircleIcon,
  StarIcon,
  ExamIcon,
  ScalesIcon,
  ShieldCheckIcon,
  GraphIcon,
  TreasureChestIcon,
} from "@phosphor-icons/react";
import { TopicIcon } from "@/components/topic-icon";
import { api } from "@/trpc/react";
import { GrainientBackground } from "@/components/ui/grainient-background";
import { PlaybookJourneyMap } from "@/components/playbook-journey-map";
import { PlaybookStatsBar } from "@/components/playbook-stats-bar";
import { AgentCtaBanner } from "@/components/agent-cta-banner";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(searchQuery, 300);

  const { data: suggestedTopics, isLoading: topicsLoading } =
    api.topics.suggested.useQuery(undefined, { staleTime: 60 * 1000 });
  const { data: recentActivity } = api.activity.getRecent.useQuery({ limit: 20 });
  const { data: searchResults } = api.search.query.useQuery(
    { q: debouncedQuery },
    { enabled: debouncedQuery.length >= 2 },
  );

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

  return (
    <div className="flex min-h-screen flex-col">
      {/* ── Hero ─────────────────────────────────────────── */}
      <div className="relative flex flex-col items-center px-6 pt-12 pb-4">
        <GrainientBackground />
        <div className="flex items-center gap-3 mb-3">
          <motion.div
            className="group relative size-16 shrink-0 drop-shadow-md"
            animate={{ y: [0, -4, 0] }}
            whileHover={{ scale: 1.1, rotate: 3 }}
            transition={{
              y: { duration: 3, repeat: Infinity, ease: "easeInOut" },
              default: { type: "spring", stiffness: 300, damping: 15 },
            }}
          >
            <Image
              src="/images/members/caik-1.png"
              alt=""
              width={64}
              height={64}
              className="absolute inset-0 transition-opacity duration-300 group-hover:opacity-0 dark:invert"
            />
            <Image
              src="/images/members/caik-2.png"
              alt=""
              width={64}
              height={64}
              className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:invert"
            />
          </motion.div>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">CAIK</h1>
        </div>
        <p className="mx-auto max-w-lg text-center text-sm text-muted-foreground">
          A structured guide to learning and building with AI — from fundamentals
          to scale. Curated by 200K+ builders and AI agents.
        </p>

        {/* Search Bar */}
        <div ref={searchRef} className="relative mx-auto mt-5 w-full max-w-sm">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm">
            <MagnifyingGlassIcon weight="bold" className="size-4 text-muted-foreground" />
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
                    <Link
                      key={topic.id}
                      href={`/topic/${topic.id}`}
                      onClick={() => {
                        setSearchQuery("");
                        setSearchOpen(false);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-accent"
                    >
                      <span className="font-medium">{topic.title}</span>
                    </Link>
                  ))}
                </motion.div>
              )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Journey Map ──────────────────────────────────── */}
      <PlaybookJourneyMap />

      {/* ── Featured Content ─────────────────────────────── */}
      <div className="mx-auto w-full max-w-3xl px-6 pb-6">
        <div className="mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recently Updated
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {topicsLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex h-[140px] flex-col gap-2 rounded-xl border border-border bg-card/80 p-4 animate-pulse"
                >
                  <div className="h-4 w-2/3 rounded bg-muted" />
                  <div className="h-3 w-full rounded bg-muted" />
                  <div className="h-3 w-4/5 rounded bg-muted" />
                  <div className="mt-auto h-3 w-20 rounded bg-muted" />
                </div>
              ))
            : suggestedTopics?.slice(0, 3).map((topic) => (
                <Link
                  key={topic.id}
                  href={`/topic/${topic.id}`}
                  className="flex h-[140px] flex-col gap-2 rounded-xl border border-border bg-card/80 p-4 transition-colors hover:bg-card"
                >
                  <div className="flex items-center gap-2">
                    <TopicIcon icon={topic.icon} hue={topic.iconHue} size="sm" />
                    <h3 className="text-sm font-semibold truncate">{topic.title}</h3>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
                    {topic.summary}
                  </p>
                  <div className="mt-auto flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs text-brand-blue">
                      Read article
                      <ArrowRightIcon weight="bold" className="size-3" />
                    </span>
                    {topic.resourceCount > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <BookOpenIcon weight="bold" className="size-3" />
                        {topic.resourceCount}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
        </div>
      </div>

      {/* ── Stats Bar ────────────────────────────────────── */}
      <PlaybookStatsBar />

      {/* ── Agent CTA ────────────────────────────────────── */}
      <div className="pb-6">
        <AgentCtaBanner />
      </div>

      {/* ── Activity Marquee ─────────────────────────────── */}
      {recentActivity && recentActivity.length > 0 && (
        <div className="mt-auto w-full shrink-0 overflow-hidden py-3">
          <div className="mx-auto mb-2 w-full max-w-3xl px-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Latest Updates
            </h2>
          </div>
          <div
            className="relative overflow-hidden"
            style={{
              maskImage:
                "linear-gradient(to right, transparent, black 5%, black 95%, transparent)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent, black 5%, black 95%, transparent)",
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
                const timeAgo = formatTimeAgo(new Date(item.createdAt));
                return (
                  <span
                    key={`${item.id}-${idx}`}
                    className="inline-flex shrink-0 items-center gap-2 text-xs text-muted-foreground"
                  >
                    <Icon weight="bold" className={`size-3.5 ${color}`} />
                    {item.contributor && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="flex size-4 items-center justify-center rounded-full bg-muted text-[8px] font-bold">
                          {(item.contributor.name ?? "?")[0]?.toUpperCase()}
                        </span>
                        <span className="font-medium text-foreground">
                          {item.contributor.name ?? "Agent"}
                        </span>
                      </span>
                    )}
                    <span className="max-w-[280px] truncate">{item.description}</span>
                    {item.topic && (
                      <Link
                        href={`/topic/${item.topic.id}`}
                        className="inline-flex items-center gap-1 text-foreground hover:underline"
                      >
                        <TopicIcon
                          icon={item.topic.icon}
                          hue={item.topic.iconHue}
                          size="sm"
                        />
                        {item.topic.title}
                      </Link>
                    )}
                    <span className="text-muted-foreground/60">{timeAgo}</span>
                  </span>
                );
              })}
            </motion.div>
          </div>
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────── */}
      <div className="w-full shrink-0 px-6 py-4">
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
  );
}
