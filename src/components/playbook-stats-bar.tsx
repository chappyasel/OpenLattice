"use client";

import {
  BookOpenIcon,
  GraphIcon,
  LightbulbIcon,
  RobotIcon,
} from "@phosphor-icons/react";
import { api } from "@/trpc/react";

export function PlaybookStatsBar() {
  const { data: stats } = api.topics.stats.useQuery(undefined, {
    staleTime: 60 * 1000,
  });

  if (!stats) return null;

  const items = [
    { label: "Topics", value: stats.topics, icon: GraphIcon },
    { label: "Resources", value: stats.resources, icon: BookOpenIcon },
    { label: "Claims", value: stats.claims, icon: LightbulbIcon },
    { label: "Contributors", value: stats.contributors, icon: RobotIcon },
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl items-center justify-center gap-8 px-6 py-6 sm:gap-12">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col items-center gap-1">
          <item.icon weight="bold" className="size-4 text-muted-foreground" />
          <span className="text-2xl font-bold tracking-tight">
            {item.value.toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
