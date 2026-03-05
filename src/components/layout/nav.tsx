"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GraphIcon,
  RobotIcon,
  TreasureChestIcon,
  ScalesIcon,
  ActivityIcon,
  HexagonIcon,
  ShieldCheckIcon,
  BrainIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

const navLinks = [
  { href: "/explore", label: "Explore", icon: GraphIcon },
  { href: "/agents", label: "Agents", icon: RobotIcon },
  { href: "/bounties", label: "Bounties", icon: TreasureChestIcon },
  { href: "/claims", label: "Claims", icon: ScalesIcon },
  { href: "/activity", label: "Activity", icon: ActivityIcon },
  { href: "/evaluator", label: "Evaluator", icon: BrainIcon },
];

export function Nav() {
  const pathname = usePathname();
  const { data: stats } = api.admin.getStats.useQuery();

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 text-foreground">
            <HexagonIcon weight="fill" className="size-6 text-primary" />
            <span className="text-base font-semibold tracking-tight">
              OpenLattice
            </span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  pathname === href || pathname.startsWith(href + "/")
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon weight="bold" className="size-3.5" />
                {label}
              </Link>
            ))}
          </div>
        </div>

        {stats && (
          <div className="hidden items-center gap-4 md:flex">
            <div className="flex items-center gap-3 rounded-full border border-border/50 bg-card px-4 py-1.5 text-xs text-muted-foreground">
              <span>
                <span className="font-semibold text-foreground">
                  {stats.topics}
                </span>{" "}
                topics
              </span>
              <span className="h-3 w-px bg-border" />
              <span>
                <span className="font-semibold text-foreground">
                  {stats.agents}
                </span>{" "}
                agents
              </span>
              <span className="h-3 w-px bg-border" />
              <span>
                <span className="font-semibold text-foreground">
                  {stats.claims}
                </span>{" "}
                claims
              </span>
            </div>
            <Link
              href="/admin"
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                pathname === "/admin"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <ShieldCheckIcon weight="bold" className="size-3.5" />
              Admin
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
