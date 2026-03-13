"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CaretRightIcon,
  CircleIcon,
  MagnifyingGlassIcon,
  HouseIcon,
  TreasureChestIcon,
  TrophyIcon,
  ShieldCheckIcon,
  GraphIcon,
} from "@phosphor-icons/react";
import { api } from "@/trpc/react";
import { useTopicContext } from "@/components/topic-context";
import { TopicIcon } from "@/components/topic-icon";
import { cn } from "@/lib/utils";
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

// Fixed base order: ai-fundamentals → building-with-ai → saas-playbook
const FIXED_BASE_ORDER = ["ai-fundamentals", "building-with-ai", "saas-playbook"];

const PHASE_NUMBERS: Record<string, number> = {
  "ai-fundamentals": 1,
  "building-with-ai": 2,
  "saas-playbook": 3,
};

interface TreeTopic {
  id: string;
  title: string;
  parentTopicId: string | null;
  baseId: string | null;
  icon: string | null;
  iconHue: number | null;
  childCount: number;
}

function TopicTreeNode({
  topic,
  depth = 0,
  pathname,
  onSelect,
  selectedSlug,
  expandedIds,
  onToggleExpand,
}: {
  topic: TreeTopic;
  depth?: number;
  pathname: string;
  onSelect: (slug: string) => void;
  selectedSlug: string | null;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
}) {
  const expanded = expandedIds.has(topic.id);
  const hasChildren = topic.childCount > 0;
  const isActive = selectedSlug === topic.id || pathname === `/topic/${topic.id}`;

  const { data: children } = api.topics.listTree.useQuery(
    { parentTopicId: topic.id },
    { enabled: expanded && hasChildren, staleTime: 5 * 60 * 1000, gcTime: Infinity },
  );

  if (!hasChildren && depth > 0) {
    return (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton asChild size="sm" isActive={isActive}>
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

  const caretSlot = hasChildren ? (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggleExpand(topic.id);
      }}
      className="-ml-2 flex w-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground/60 hover:text-foreground"
    >
      <motion.span
        animate={{ rotate: expanded ? 90 : 0 }}
        transition={{ duration: 0.15, ease: "easeInOut" }}
        className="flex items-center justify-center"
      >
        <CaretRightIcon weight="bold" className="!size-3" />
      </motion.span>
    </button>
  ) : (
    <span className="-ml-2 w-4 shrink-0" />
  );

  return (
    <SidebarMenuItem>
      <SidebarMenuButton size="sm" isActive={isActive} className="gap-1" asChild>
        <Link href={`/topic/${topic.id}`}>
          {caretSlot}
          <TopicIcon icon={topic.icon} hue={topic.iconHue} size="sm" />
          <span className="truncate">{topic.title}</span>
        </Link>
      </SidebarMenuButton>
      <AnimatePresence initial={false}>
        {expanded && children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <SidebarMenuSub className="gap-0">
              {children.map((child) => (
                <TopicTreeNode
                  key={child.id}
                  topic={child}
                  depth={depth + 1}
                  pathname={pathname}
                  onSelect={onSelect}
                  selectedSlug={selectedSlug}
                  expandedIds={expandedIds}
                  onToggleExpand={onToggleExpand}
                />
              ))}
            </SidebarMenuSub>
          </motion.div>
        )}
      </AnimatePresence>
    </SidebarMenuItem>
  );
}

// --- Collapsible base section with phase number ---

function BaseSection({
  base,
  topics,
  collapsed,
  onToggleCollapse,
  phaseNumber,
  pathname,
  onSelect,
  selectedSlug,
  expandedIds,
  onToggleExpand,
}: {
  base: { id: string; slug: string; name: string; icon: string | null; iconHue: number | null };
  topics: TreeTopic[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  phaseNumber?: number;
  pathname: string;
  onSelect: (slug: string) => void;
  selectedSlug: string | null;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
}) {
  const isBaseActive = pathname === `/base/${base.slug}`;

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel className="-ml-1 gap-0.5">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleCollapse();
          }}
          className="-ml-2 flex size-5 shrink-0 items-center justify-center rounded-sm text-sidebar-foreground/40 transition-colors duration-150 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
        >
          <motion.span
            animate={{ rotate: collapsed ? 0 : 90 }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
            className="flex items-center justify-center"
          >
            <CaretRightIcon weight="bold" className="!size-3" />
          </motion.span>
        </button>
        <Link
          href={`/base/${base.slug}`}
          className={cn(
            "flex flex-1 items-center gap-1.5 truncate hover:text-sidebar-foreground",
            isBaseActive && "text-sidebar-foreground font-semibold",
          )}
        >
          {phaseNumber && (
            <span className="flex size-4 shrink-0 items-center justify-center rounded text-[10px] font-bold text-primary bg-primary/10">
              {phaseNumber}
            </span>
          )}
          <TopicIcon icon={base.icon} hue={base.iconHue} size="sm" />
          {base.name}
        </Link>
      </SidebarGroupLabel>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <SidebarMenu className="gap-0">
              {topics.map((topic) => (
                <TopicTreeNode
                  key={topic.id}
                  topic={topic}
                  pathname={pathname}
                  onSelect={onSelect}
                  selectedSlug={selectedSlug}
                  expandedIds={expandedIds}
                  onToggleExpand={onToggleExpand}
                />
              ))}
            </SidebarMenu>
          </motion.div>
        )}
      </AnimatePresence>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { selectedSlug, setSelectedSlug } = useTopicContext();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [collapsedBases, setCollapsedBases] = useState<Set<string>>(new Set());

  const onToggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleBaseCollapse = useCallback((baseId: string) => {
    setCollapsedBases((prev) => {
      const next = new Set(prev);
      if (next.has(baseId)) next.delete(baseId);
      else next.add(baseId);
      return next;
    });
  }, []);

  const { data: rootTopics } = api.topics.listTree.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    gcTime: Infinity,
  });
  const { data: bases } = api.bases.list.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    gcTime: Infinity,
  });
  const { data: isAdmin } = api.admin.isAdmin.useQuery();

  // Group root topics by base
  const groupedTopics = useMemo(() => {
    if (!rootTopics) return null;
    const byBase = new Map<string | null, TreeTopic[]>();
    for (const topic of rootTopics) {
      const key = topic.baseId;
      const arr = byBase.get(key) ?? [];
      arr.push(topic);
      byBase.set(key, arr);
    }
    return byBase;
  }, [rootTopics]);

  const baseMap = useMemo(() => {
    if (!bases) return new Map<string, NonNullable<typeof bases>[number]>();
    return new Map(bases.map((b) => [b.id, b]));
  }, [bases]);

  // Fixed order: sort bases by FIXED_BASE_ORDER using slug, then any remaining
  const orderedBaseIds = useMemo(() => {
    if (!bases || !groupedTopics) return [];
    const slugToId = new Map(bases.map((b) => [b.slug, b.id]));
    const ordered: string[] = [];
    for (const slug of FIXED_BASE_ORDER) {
      const id = slugToId.get(slug);
      if (id && groupedTopics.has(id)) ordered.push(id);
    }
    // Add any bases not in the fixed order
    for (const base of bases) {
      if (!ordered.includes(base.id) && groupedTopics.has(base.id)) {
        ordered.push(base.id);
      }
    }
    return ordered;
  }, [bases, groupedTopics]);

  const navItems = [
    { href: "/", label: "Home", icon: HouseIcon },
    { href: "/explore", label: "Explore", icon: GraphIcon },
    { href: "/bounties", label: "Bounties", icon: TreasureChestIcon },
    { href: "/leaderboard", label: "Leaderboard", icon: TrophyIcon },
  ];

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="gap-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="CAIK" className="pl-1">
              <Link href="/">
                <motion.div
                  className="group/icon relative size-8 shrink-0 drop-shadow-sm"
                  whileHover={{
                    scale: 1.1,
                    rotate: 3,
                    filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.15))",
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 15 }}
                >
                  <Image
                    src="/images/members/caik-1.png"
                    alt="CAIK"
                    width={48}
                    height={48}
                    className="absolute inset-0 size-8 object-contain transition-opacity duration-300 group-hover/icon:opacity-0 dark:invert"
                  />
                  <Image
                    src="/images/members/caik-2.png"
                    alt=""
                    width={48}
                    height={48}
                    className="absolute inset-0 size-8 object-contain opacity-0 transition-opacity duration-300 group-hover/icon:opacity-100 dark:invert"
                  />
                </motion.div>
                <span className="font-serif text-2xl font-bold tracking-tight">CAIK</span>
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
              <MagnifyingGlassIcon className="size-4 text-muted-foreground" weight="bold" />
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

        {groupedTopics && orderedBaseIds.length > 0 ? (
          <>
            {orderedBaseIds.map((baseId) => {
              const base = baseMap.get(baseId)!;
              const topics = groupedTopics.get(baseId)!;
              return (
                <BaseSection
                  key={baseId}
                  base={base}
                  topics={topics}
                  collapsed={collapsedBases.has(baseId)}
                  onToggleCollapse={() => toggleBaseCollapse(baseId)}
                  phaseNumber={PHASE_NUMBERS[base.slug]}
                  pathname={pathname}
                  onSelect={setSelectedSlug}
                  selectedSlug={selectedSlug}
                  expandedIds={expandedIds}
                  onToggleExpand={onToggleExpand}
                />
              );
            })}
            {/* Uncategorized topics (no base) */}
            {groupedTopics.get(null) && groupedTopics.get(null)!.length > 0 && (
              <SidebarGroup className="group-data-[collapsible=icon]:hidden">
                <SidebarGroupLabel>Topics</SidebarGroupLabel>
                <SidebarMenu className="gap-0">
                  {groupedTopics.get(null)!.map((topic) => (
                    <TopicTreeNode
                      key={topic.id}
                      topic={topic}
                      pathname={pathname}
                      onSelect={setSelectedSlug}
                      selectedSlug={selectedSlug}
                      expandedIds={expandedIds}
                      onToggleExpand={onToggleExpand}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            )}
          </>
        ) : (
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel>Topics</SidebarGroupLabel>
            <SidebarMenu className="gap-0">
              {rootTopics?.map((topic) => (
                <TopicTreeNode
                  key={topic.id}
                  topic={topic}
                  pathname={pathname}
                  onSelect={setSelectedSlug}
                  selectedSlug={selectedSlug}
                  expandedIds={expandedIds}
                  onToggleExpand={onToggleExpand}
                />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      <AppSidebarFooter />
      <SidebarRail />
    </Sidebar>
  );
}
