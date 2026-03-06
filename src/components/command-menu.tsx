"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  HouseIcon,
  TreasureChestIcon,
  TrophyIcon,
  ClockCounterClockwiseIcon,
  ShieldCheckIcon,
  CircleIcon,
  MoonIcon,
  SunIcon,
  DesktopIcon,
} from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { api } from "@/trpc/react";
import { useTopicContext } from "@/components/topic-context";
import { TopicIcon } from "@/components/topic-icon";
import { DifficultyBadge, ResourceTypeBadge, TagBadge } from "@/components/badges";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface CommandMenuContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const CommandMenuContext = React.createContext<CommandMenuContextType>({
  open: false,
  setOpen: () => {},
});

export function useCommandMenu() {
  return React.useContext(CommandMenuContext);
}

export function CommandMenuProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      if (
        e.key === "f" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target as HTMLElement)?.isContentEditable
      ) {
        e.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const value = React.useMemo(() => ({ open, setOpen }), [open]);

  return (
    <CommandMenuContext.Provider value={value}>
      {children}
    </CommandMenuContext.Provider>
  );
}

const pages = [
  { href: "/", label: "Home", icon: HouseIcon },
  { href: "/bounties", label: "Bounties", icon: TreasureChestIcon },
  { href: "/leaderboard", label: "Leaderboard", icon: TrophyIcon },
  { href: "/activity", label: "Activity", icon: ClockCounterClockwiseIcon },
];

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function CommandMenu() {
  const { open, setOpen } = useCommandMenu();
  const router = useRouter();
  const { setSelectedSlug } = useTopicContext();
  const { theme, setTheme } = useTheme();
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 200);
  const hasSearch = debouncedSearch.trim().length > 0;

  const { data: allTopics } = api.topics.list.useQuery(
    { status: "published" },
    { staleTime: 5 * 60 * 1000, gcTime: Infinity },
  );

  const { data: allTags } = api.tags.list.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    gcTime: Infinity,
  });

  const { data: isAdmin } = api.admin.isAdmin.useQuery();

  const { data: searchResults } = api.search.query.useQuery(
    { q: debouncedSearch, limit: 20 },
    { enabled: hasSearch },
  );

  const navigate = React.useCallback(
    (path: string) => {
      setOpen(false);
      router.push(path);
    },
    [router, setOpen],
  );

  const selectTopic = React.useCallback(
    (slug: string) => {
      setOpen(false);
      if (window.location.pathname === "/") {
        setSelectedSlug(slug);
      } else {
        router.push(`/topic/${slug}`);
      }
    },
    [router, setSelectedSlug, setOpen],
  );

  // Reset search when dialog closes
  React.useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  // Filter pages client-side when searching
  const filteredPages = hasSearch
    ? pages.filter((p) => p.label.toLowerCase().includes(debouncedSearch.toLowerCase()))
    : pages;

  const showAdmin = isAdmin && (!hasSearch || "admin".includes(debouncedSearch.toLowerCase()));

  // Topics: use search results when searching, otherwise show all
  const displayTopics = hasSearch ? searchResults?.topics : allTopics;

  // Tags: filter client-side when searching
  const displayTags = hasSearch
    ? allTags?.filter((t) => t.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
    : allTags;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search topics, resources, and pages..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {(filteredPages.length > 0 || showAdmin) && (
          <CommandGroup heading="Pages">
            {filteredPages.map((page) => (
              <CommandItem key={page.href} onSelect={() => navigate(page.href)}>
                <page.icon weight="bold" className="mr-2 size-4" />
                {page.label}
              </CommandItem>
            ))}
            {showAdmin && (
              <CommandItem onSelect={() => navigate("/admin")}>
                <ShieldCheckIcon weight="bold" className="mr-2 size-4" />
                Admin
              </CommandItem>
            )}
          </CommandGroup>
        )}

        <CommandGroup heading="Theme">
          <CommandItem
            onSelect={() => {
              const currentTheme = theme === "system" ? "light" : theme;
              setTheme(currentTheme === "light" ? "dark" : "light");
              setOpen(false);
            }}
          >
            <MoonIcon weight="bold" className="mr-2 size-4" />
            Toggle Theme
            <kbd className="ml-auto flex h-5 select-none items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
              ⌥⌘L
            </kbd>
          </CommandItem>
          <CommandItem onSelect={() => { setTheme("light"); setOpen(false); }}>
            <SunIcon weight="bold" className="mr-2 size-4" />
            Light
          </CommandItem>
          <CommandItem onSelect={() => { setTheme("dark"); setOpen(false); }}>
            <MoonIcon weight="bold" className="mr-2 size-4" />
            Dark
          </CommandItem>
          <CommandItem onSelect={() => { setTheme("system"); setOpen(false); }}>
            <DesktopIcon weight="bold" className="mr-2 size-4" />
            System
          </CommandItem>
        </CommandGroup>

        {displayTopics && displayTopics.length > 0 && (
          <CommandGroup heading="Topics">
            {displayTopics.map((topic) => (
              <CommandItem
                key={topic.id}
                value={topic.title}
                onSelect={() => selectTopic(topic.id)}
              >
                {topic.icon ? (
                  <TopicIcon icon={topic.icon} hue={topic.iconHue} size="sm" className="mr-2" />
                ) : (
                  <span className="mr-2 flex size-4 shrink-0 items-center justify-center">
                    <CircleIcon weight="fill" className="!size-1.5 opacity-40" />
                  </span>
                )}
                <span className="flex-1 truncate">{topic.title}</span>
                <DifficultyBadge difficulty={topic.difficulty} size="sm" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {hasSearch && searchResults?.resources && searchResults.resources.length > 0 && (
          <CommandGroup heading="Resources">
            {searchResults.resources.map((resource) => (
              <CommandItem
                key={resource.id}
                value={resource.name}
                onSelect={() => {
                  setOpen(false);
                  if (resource.url) {
                    window.open(resource.url, "_blank");
                  }
                }}
              >
                <span className="mr-2 flex size-4 shrink-0 items-center justify-center">
                    <CircleIcon weight="fill" className="!size-1.5 opacity-40" />
                  </span>
                <span className="flex-1 truncate">{resource.name}</span>
                <ResourceTypeBadge type={resource.type} size="sm" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {displayTags && displayTags.length > 0 && (
          <CommandGroup heading="Tags">
            {displayTags.map((tag) => (
              <CommandItem
                key={tag.id}
                value={`tag-${tag.name}`}
                onSelect={() => navigate(`/tags/${tag.id}`)}
              >
                <TagBadge tag={tag} size="sm" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
