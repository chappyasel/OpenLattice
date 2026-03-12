"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, Reorder, useDragControls } from "framer-motion";
import {
  CaretRightIcon,
  CircleIcon,
  DotsSixVerticalIcon,
  MagnifyingGlassIcon,
  HouseIcon,
  TreasureChestIcon,
  TrophyIcon,
  ShieldCheckIcon,
  NewspaperIcon,
} from "@phosphor-icons/react";
import { api } from "@/trpc/react";
import { useTopicContext } from "@/components/topic-context";
import { TopicIcon } from "@/components/topic-icon";
import { TagBadge, ResourceTypeBadge } from "@/components/badges";
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

  // Leaf nodes nested inside a parent use SubItem styling
  if (!hasChildren && depth > 0) {
    return (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          asChild
          size="sm"
          isActive={isActive}
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

  // Caret placeholder keeps icons aligned whether or not a caret is shown
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
      <SidebarMenuButton
        size="sm"
        isActive={isActive}
        className="gap-1"
        asChild
      >
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

// --- Reorderable base wrapper (needs its own component for useDragControls hook) ---

function ReorderableBaseItem({
  baseId,
  children,
}: {
  baseId: string;
  children: (controls: ReturnType<typeof useDragControls>) => React.ReactNode;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={baseId}
      as="div"
      dragListener={false}
      dragControls={controls}
    >
      {children(controls)}
    </Reorder.Item>
  );
}

// --- Collapsible base section with icon ---

function BaseSection({
  base,
  topics,
  collapsed,
  onToggleCollapse,
  dragControls,
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
  dragControls?: ReturnType<typeof useDragControls>;
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
          <TopicIcon icon={base.icon} hue={base.iconHue} size="sm" />
          {base.name}
        </Link>
        {dragControls && (
          <div
            onPointerDown={(e) => dragControls.start(e)}
            className="ml-auto cursor-grab touch-none text-sidebar-foreground/30 hover:text-sidebar-foreground/60 active:cursor-grabbing"
          >
            <DotsSixVerticalIcon weight="bold" className="!size-3.5" />
          </div>
        )}
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
  const [baseOrder, setBaseOrder] = useState<string[]>([]);

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
  const { data: allTags } = api.tags.list.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    gcTime: Infinity,
  });
  const { data: resourceTypes } = api.resources.listByType.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    gcTime: Infinity,
  });
  const { data: isAdmin } = api.admin.isAdmin.useQuery();

  // Sync base order from query data, respecting localStorage preference
  useEffect(() => {
    if (!bases) return;
    const serverIds = bases.map((b) => b.id);
    try {
      const saved = localStorage.getItem("sidebar:base-order");
      if (saved) {
        const savedIds = JSON.parse(saved) as string[];
        // Keep saved order for IDs that still exist, append any new ones
        const serverSet = new Set(serverIds);
        const ordered = savedIds.filter((id) => serverSet.has(id));
        const remaining = serverIds.filter((id) => !ordered.includes(id));
        setBaseOrder([...ordered, ...remaining]);
        return;
      }
    } catch {
      // ignore malformed localStorage
    }
    setBaseOrder(serverIds);
  }, [bases]);

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

  const visibleBaseIds = useMemo(() => {
    if (!groupedTopics) return [];
    return baseOrder.filter((id) => {
      const base = baseMap.get(id);
      const topics = groupedTopics.get(id);
      return base && topics && topics.length > 0;
    });
  }, [baseOrder, baseMap, groupedTopics]);

  const handleReorder = useCallback((newOrder: string[]) => {
    setBaseOrder(newOrder);
    try {
      localStorage.setItem("sidebar:base-order", JSON.stringify(newOrder));
    } catch {
      // ignore storage errors
    }
  }, []);

  const navItems = [
    { href: "/", label: "Home", icon: HouseIcon },
    { href: "/bounties", label: "Bounties", icon: TreasureChestIcon },
    { href: "/leaderboard", label: "Leaderboard", icon: TrophyIcon },
    { href: "/digest", label: "Digest", icon: NewspaperIcon },
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
                  whileHover={{ scale: 1.1, rotate: 3, filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.15))" }}
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
                <span className="font-serif text-2xl font-bold tracking-tight">
                  CAIK
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

        {groupedTopics && visibleBaseIds.length > 0 ? (
          <>
            <Reorder.Group
              axis="y"
              values={visibleBaseIds}
              onReorder={handleReorder}
              as="div"
            >
              {visibleBaseIds.map((baseId) => {
                const base = baseMap.get(baseId)!;
                const topics = groupedTopics.get(baseId)!;
                return (
                  <ReorderableBaseItem key={baseId} baseId={baseId}>
                    {(dragControls) => (
                      <BaseSection
                        base={base}
                        topics={topics}
                        collapsed={collapsedBases.has(baseId)}
                        onToggleCollapse={() => toggleBaseCollapse(baseId)}
                        dragControls={dragControls}
                        pathname={pathname}
                        onSelect={setSelectedSlug}
                        selectedSlug={selectedSlug}
                        expandedIds={expandedIds}
                        onToggleExpand={onToggleExpand}
                      />
                    )}
                  </ReorderableBaseItem>
                );
              })}
            </Reorder.Group>
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

        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          {allTags && allTags.length > 0 && (
            <>
              <SidebarGroupLabel>Tags</SidebarGroupLabel>
              <div className="flex flex-col gap-1 px-2">
                {allTags.map((tag) => (
                  <Link key={tag.id} href={`/tags/${tag.id}`}>
                    <TagBadge tag={tag} size="sm" />
                  </Link>
                ))}
              </div>
            </>
          )}
        </SidebarGroup>

        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          {resourceTypes && resourceTypes.length > 0 && (
            <>
              <SidebarGroupLabel>Types</SidebarGroupLabel>
              <div className="flex flex-col gap-1 px-2">
                {resourceTypes.map(({ type }) => (
                  <Link key={type} href={`/types/${type}`}>
                    <ResourceTypeBadge type={type} size="sm" />
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
