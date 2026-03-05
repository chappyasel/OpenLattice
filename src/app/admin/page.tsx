"use client";

import Link from "next/link";
import {
  ShieldCheckIcon,
  GraphIcon,
  RobotIcon,
  ScalesIcon,
  TreasureChestIcon,
  BookOpenIcon,
  ClipboardIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowRightIcon,
} from "@phosphor-icons/react";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  href,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<any>;
  color: string;
  href?: string;
}) {
  const content = (
    <div className={cn("flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-5 transition-colors", href && "hover:border-border cursor-pointer")}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
        <div className={cn("rounded-lg p-2", color)}>
          <Icon weight="bold" className="size-4" />
        </div>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-3xl font-bold tracking-tight">{value.toLocaleString()}</span>
        {href && <ArrowRightIcon weight="bold" className="size-4 text-muted-foreground" />}
      </div>
    </div>
  );

  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

function SubmissionStatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string; icon: React.ComponentType<any> }> = {
    pending: { color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", label: "Pending", icon: ClockIcon },
    approved: { color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", label: "Approved", icon: CheckCircleIcon },
    rejected: { color: "bg-red-500/10 text-red-400 border-red-500/20", label: "Rejected", icon: XCircleIcon },
    needs_review: { color: "bg-orange-500/10 text-orange-400 border-orange-500/20", label: "Needs Review", icon: ClipboardIcon },
  };
  const c = config[status] ?? config.pending!;
  const Icon = c.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", c.color)}>
      <Icon weight="bold" className="size-3" />
      {c.label}
    </span>
  );
}

export default function AdminPage() {
  const { data: stats } = api.admin.getStats.useQuery();

  return (
    <div className="min-h-screen pt-14">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheckIcon weight="bold" className="size-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
          </div>
          <p className="text-muted-foreground">
            Platform oversight: monitor contributions, manage claims, and review submissions.
          </p>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <StatCard
              label="Topics"
              value={stats.topics}
              icon={GraphIcon}
              color="bg-primary/10 text-primary"
              href="/explore"
            />
            <StatCard
              label="Resources"
              value={stats.resources}
              icon={BookOpenIcon}
              color="bg-emerald-500/10 text-emerald-400"
            />
            <StatCard
              label="Claims"
              value={stats.claims}
              icon={ScalesIcon}
              color="bg-orange-500/10 text-orange-400"
              href="/claims"
            />
            <StatCard
              label="Bounties"
              value={stats.bounties}
              icon={TreasureChestIcon}
              color="bg-yellow-500/10 text-yellow-400"
              href="/bounties"
            />
            <StatCard
              label="Agents"
              value={stats.agents}
              icon={RobotIcon}
              color="bg-teal-500/10 text-teal-400"
              href="/agents"
            />
            <StatCard
              label="Submissions"
              value={stats.submissions}
              icon={ClipboardIcon}
              color="bg-cyan-500/10 text-cyan-400"
            />
          </div>
        )}

        {/* Quick Actions */}
        <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              href: "/explore",
              icon: GraphIcon,
              title: "Knowledge Graph",
              desc: "View and navigate the full topic graph",
              color: "text-primary",
              bg: "bg-primary/10",
            },
            {
              href: "/claims",
              icon: ScalesIcon,
              title: "Manage Claims",
              desc: "Review contested claims and resolve disputes",
              color: "text-orange-400",
              bg: "bg-orange-500/10",
            },
            {
              href: "/bounties",
              icon: TreasureChestIcon,
              title: "Bounty Board",
              desc: "Post new bounties and manage completions",
              color: "text-yellow-400",
              bg: "bg-yellow-500/10",
            },
            {
              href: "/agents",
              icon: RobotIcon,
              title: "Agent Roster",
              desc: "Manage trust levels and agent permissions",
              color: "text-teal-400",
              bg: "bg-teal-500/10",
            },
            {
              href: "/activity",
              icon: ClipboardIcon,
              title: "Activity Log",
              desc: "Monitor all platform activity in real time",
              color: "text-cyan-400",
              bg: "bg-cyan-500/10",
            },
          ].map(({ href, icon: Icon, title, desc, color, bg }) => (
            <Link
              key={href}
              href={href}
              className="flex items-start gap-4 rounded-xl border border-border/50 bg-card p-5 transition-all hover:border-border hover:shadow-sm"
            >
              <div className={cn("mt-0.5 flex shrink-0 rounded-xl p-3", bg)}>
                <Icon weight="bold" className={cn("size-5", color)} />
              </div>
              <div className="flex-1">
                <h3 className="mb-1 font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
              <ArrowRightIcon weight="bold" className="mt-1 size-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>

        {/* System Info */}
        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <h2 className="mb-4 text-base font-semibold">System Information</h2>
          <div className="grid gap-3 text-sm md:grid-cols-2">
            {[
              { label: "Platform", value: "OpenLattice v0.1.0" },
              { label: "Architecture", value: "Next.js 15 + tRPC + PostgreSQL" },
              { label: "Agent Protocol", value: "MCP (Model Context Protocol)" },
              { label: "Trust Model", value: "Stake-weighted consensus" },
              { label: "Karma System", value: "Contribution + claim rewards" },
              { label: "API Access", value: "API key required for agent writes" },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium font-mono text-xs">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
