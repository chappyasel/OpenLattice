"use client";

import Link from "next/link";
import {
  BrainIcon,
  HammerIcon,
  RocketLaunchIcon,
  ArrowRightIcon,
} from "@phosphor-icons/react";
import { TopicIcon } from "@/components/topic-icon";
import { api } from "@/trpc/react";

const PHASE_CONFIG = [
  {
    slug: "ai-fundamentals",
    number: 1,
    icon: BrainIcon,
    description: "Core concepts, models, and techniques powering modern AI systems.",
  },
  {
    slug: "building-with-ai",
    number: 2,
    icon: HammerIcon,
    description: "Practical patterns for shipping AI-powered products and features.",
  },
  {
    slug: "saas-playbook",
    number: 3,
    icon: RocketLaunchIcon,
    description: "Go-to-market, growth, and operations for AI-native companies.",
  },
];

export function PlaybookJourneyMap() {
  const { data: bases } = api.bases.list.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const { data: rootTopics } = api.topics.listTree.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  if (!bases || !rootTopics) {
    return (
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex h-[240px] flex-col rounded-xl border border-border bg-card/80 p-5 animate-pulse"
            >
              <div className="mb-3 h-6 w-8 rounded bg-muted" />
              <div className="mb-2 h-5 w-2/3 rounded bg-muted" />
              <div className="mb-4 h-4 w-full rounded bg-muted" />
              <div className="space-y-2">
                <div className="h-3 w-3/4 rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const baseMap = new Map(bases.map((b) => [b.slug, b]));
  const topicsByBase = new Map<string, typeof rootTopics>();
  for (const topic of rootTopics) {
    if (!topic.baseId) continue;
    const arr = topicsByBase.get(topic.baseId) ?? [];
    arr.push(topic);
    topicsByBase.set(topic.baseId, arr);
  }

  const phases = PHASE_CONFIG.map((config) => {
    const base = baseMap.get(config.slug);
    const topics = base ? topicsByBase.get(base.id) ?? [] : [];
    return { ...config, base, topics };
  }).filter((p) => p.base);

  if (phases.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <div className="mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          The Builder&apos;s Journey
        </h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {phases.map((phase, i) => (
          <div key={phase.slug} className="relative flex flex-col">
            {/* Connecting arrow (desktop only) */}
            {i < phases.length - 1 && (
              <div className="absolute -right-4 top-1/2 z-10 hidden -translate-y-1/2 sm:block">
                <ArrowRightIcon
                  weight="bold"
                  className="size-4 text-muted-foreground/40"
                />
              </div>
            )}
            {/* Mobile progress line */}
            {i < phases.length - 1 && (
              <div className="absolute -bottom-4 left-6 h-4 w-px bg-border sm:hidden" />
            )}
            <Link
              href={`/base/${phase.slug}`}
              className="flex flex-1 flex-col rounded-xl border border-border bg-card/80 p-5 transition-colors hover:bg-card"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                  {phase.number}
                </span>
                <phase.icon weight="bold" className="size-4 text-muted-foreground" />
              </div>
              <h3 className="mb-1 text-sm font-semibold">{phase.base!.name}</h3>
              <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                {phase.description}
              </p>
              {/* Root topic bullets */}
              {phase.topics.length > 0 && (
                <ul className="mb-3 space-y-1.5">
                  {phase.topics.slice(0, 4).map((topic) => (
                    <li key={topic.id} className="flex items-center gap-1.5 text-xs">
                      <TopicIcon icon={topic.icon} hue={topic.iconHue} size="sm" />
                      <span className="truncate text-muted-foreground">{topic.title}</span>
                    </li>
                  ))}
                  {phase.topics.length > 4 && (
                    <li className="text-xs text-muted-foreground/60">
                      +{phase.topics.length - 4} more
                    </li>
                  )}
                </ul>
              )}
              <div className="mt-auto flex items-center gap-1 text-xs text-brand-blue">
                Explore
                <ArrowRightIcon weight="bold" className="size-3" />
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
