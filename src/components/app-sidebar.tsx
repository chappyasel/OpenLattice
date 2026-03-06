"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CaretRightIcon,
  CaretDownIcon,
  CircleIcon,
  MagnifyingGlassIcon,
  HouseIcon,
  TreasureChestIcon,
  TrophyIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react";
import { api } from "@/trpc/react";
import { useTopicContext } from "@/components/topic-context";
import { TopicIcon } from "@/components/topic-icon";
import { TagBadge } from "@/components/badges";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { AppSidebarFooter } from "@/components/app-sidebar-footer";

interface TopicWithChildren {
  id: string;
  title: string;
  parentTopicId: string | null;
  icon: string | null;
  iconHue: number | null;
  children?: TopicWithChildren[];
}

function TopicTreeNode({
  topic,
  depth = 0,
  pathname,
  onSelect,
  selectedSlug,
}: {
  topic: TopicWithChildren;
  depth?: number;
  pathname: string;
  onSelect: (slug: string) => void;
  selectedSlug: string | null;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = topic.children && topic.children.length > 0;
  const isActive = selectedSlug === topic.id || pathname === `/topic/${topic.id}`;

  if (!hasChildren) {
    return (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          asChild
          size="sm"
          isActive={isActive}
          onClick={(e) => {
            if (pathname === "/") {
              e.preventDefault();
              onSelect(topic.id);
            }
          }}
        >
          <Link href={`/topic/${topic.id}`}>
            {topic.icon ? (
              <TopicIcon icon={topic.icon} hue={topic.iconHue} size="sm" />
            ) : (
              <CircleIcon weight="fill" className="!size-1.5 shrink-0 opacity-40" />
            )}
            <span className="truncate">{topic.title}</span>
          </Link>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        size="sm"
        isActive={isActive}
        className="gap-1"
        onClick={(e) => {
          if (pathname === "/") {
            e.preventDefault();
            onSelect(topic.id);
          }
        }}
        asChild
      >
        <Link href={`/topic/${topic.id}`}>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setExpanded((p) => !p);
            }}
            className="shrink-0"
          >
            {expanded ? (
              <CaretDownIcon weight="bold" className="!size-3" />
            ) : (
              <CaretRightIcon weight="bold" className="!size-3" />
            )}
          </button>
          <TopicIcon icon={topic.icon} hue={topic.iconHue} size="sm" />
          <span className="truncate">{topic.title}</span>
        </Link>
      </SidebarMenuButton>
      {expanded && (
        <SidebarMenuSub>
          {topic.children!.map((child) => (
            <TopicTreeNode
              key={child.id}
              topic={child}
              depth={depth + 1}
              pathname={pathname}
              onSelect={onSelect}
              selectedSlug={selectedSlug}
            />
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { selectedSlug, setSelectedSlug } = useTopicContext();
  const { data: allTopics } = api.topics.list.useQuery(
    { status: "published" },
    { staleTime: 5 * 60 * 1000, gcTime: Infinity },
  );
  const { data: allTags } = api.tags.list.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    gcTime: Infinity,
  });
  const { data: isAdmin } = api.admin.isAdmin.useQuery();

  const navItems = [
    { href: "/", label: "Home", icon: HouseIcon },
    { href: "/bounties", label: "Bounties", icon: TreasureChestIcon },
    { href: "/leaderboard", label: "Leaderboard", icon: TrophyIcon },
  ];

  const topicTree = useMemo<TopicWithChildren[]>(() => {
    if (!allTopics) return [];
    const topicMap = new Map<string, TopicWithChildren>(
      allTopics
        .map((t) => ({
          id: t.id,
          title: t.title,
          parentTopicId: t.parentTopicId,
          icon: t.icon ?? null,
          iconHue: t.iconHue ?? null,
        }))
        .map((t) => [t.id, { ...t, children: [] } as TopicWithChildren]),
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

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="gap-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="The AI Wiki" className="pl-1">
              <Link href="/">
                <Image
                  src="/logo.png"
                  alt="The AI Collective"
                  width={48}
                  height={48}
                  className="size-5 shrink-0 object-contain brightness-0 transition-opacity hover:opacity-80 dark:invert"
                />
                <span className="font-serif text-lg font-semibold tracking-tight">
                  The AI Wiki
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem className="px-1">
            <SidebarMenuButton
              className="rounded-sm border border-input bg-card shadow-sm"
              tooltip="Search (F)"
              onClick={() => {
                document.dispatchEvent(
                  new KeyboardEvent("keydown", {
                    key: "k",
                    metaKey: true,
                    bubbles: true,
                  }),
                );
              }}
            >
              <MagnifyingGlassIcon
                className="size-4 text-muted-foreground"
                weight="bold"
              />
              <span className="flex-1 text-muted-foreground">Find...</span>
              <kbd className="pointer-events-none -mr-0.5 flex h-5 select-none items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                F
              </kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
                  tooltip={item.label}
                >
                  <Link href={item.href}>
                    <item.icon className="size-4" weight="bold" />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            {isAdmin && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/admin"}
                  tooltip="Admin"
                >
                  <Link href="/admin">
                    <ShieldCheckIcon className="size-4" weight="bold" />
                    <span>Admin</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Topics</SidebarGroupLabel>
          <SidebarMenu>
            {topicTree.map((topic) => (
              <TopicTreeNode
                key={topic.id}
                topic={topic}
                pathname={pathname}
                onSelect={setSelectedSlug}
                selectedSlug={selectedSlug}
              />
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          {allTags && allTags.length > 0 && (
            <>
              <SidebarGroupLabel>Tags</SidebarGroupLabel>
              <div className="flex flex-wrap gap-1.5 px-2">
                {allTags.map((tag) => (
                  <Link key={tag.id} href={`/tags/${tag.id}`}>
                    <TagBadge tag={tag} size="sm" />
                  </Link>
                ))}
              </div>
            </>
          )}
        </SidebarGroup>
      </SidebarContent>

      <AppSidebarFooter />
      <SidebarRail />
    </Sidebar>
  );
}

