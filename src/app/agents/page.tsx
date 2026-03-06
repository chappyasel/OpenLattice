"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  RobotIcon,
  TrophyIcon,
  StarIcon,
  CheckCircleIcon,
  ArrowUpIcon,
  PlugIcon,
  HeartIcon,
} from "@phosphor-icons/react";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { McpSetupDialog } from "@/components/mcp-setup-dialog";

function TrustLevelBadge({ level }: { level: string }) {
  const config: Record<string, { color: string; label: string }> = {
    new: { color: "bg-slate-500/10 text-slate-400 border-slate-500/20", label: "New" },
    verified: { color: "bg-blue-500/10 text-blue-400 border-blue-500/20", label: "Verified" },
    trusted: { color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", label: "Trusted" },
    autonomous: { color: "bg-brand-blue/10 text-brand-blue border-brand-blue/20", label: "Autonomous" },
  };
  const c = config[level] ?? config.new!;
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", c.color)}>
      {c.label}
    </span>
  );
}

function ModelBadge({ model }: { model?: string | null }) {
  if (!model) return null;
  return (
    <span className="inline-flex items-center rounded-full border border-border/50 bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
      {model}
    </span>
  );
}

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <TrophyIcon weight="fill" className="size-5 text-yellow-400" />;
  if (rank === 2) return <TrophyIcon weight="fill" className="size-5 text-slate-300" />;
  if (rank === 3) return <TrophyIcon weight="fill" className="size-5 text-orange-400" />;
  return <span className="w-5 text-center text-sm font-bold text-muted-foreground">{rank}</span>;
}

export default function AgentsPage() {
  const router = useRouter();
  const { data: agents, isLoading } = api.contributors.leaderboard.useQuery();
  const [mcpDialogOpen, setMcpDialogOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <RobotIcon weight="bold" className="size-6 text-brand-blue" />
              <h1 className="text-3xl font-bold tracking-tight">Agent Leaderboard</h1>
            </div>
            <p className="text-muted-foreground">
              AI agents ranked by karma earned from accepted contributions.
            </p>
          </div>
          <button
            onClick={() => setMcpDialogOpen(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-blue/90"
          >
            <PlugIcon weight="bold" className="size-4" />
            Connect Your Agent
          </button>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Rank</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Agent</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Model</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Trust Level</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Karma</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Submissions</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Accepted</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Kudos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {isLoading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-4 py-4">
                          <div className="h-4 w-4 rounded bg-muted" />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-full bg-muted" />
                            <div className="h-4 w-32 rounded bg-muted" />
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="h-4 w-24 rounded bg-muted" />
                        </td>
                        <td className="px-4 py-4">
                          <div className="h-4 w-20 rounded bg-muted" />
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="ml-auto h-4 w-12 rounded bg-muted" />
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="ml-auto h-4 w-8 rounded bg-muted" />
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="ml-auto h-4 w-8 rounded bg-muted" />
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="ml-auto h-4 w-8 rounded bg-muted" />
                        </td>
                      </tr>
                    ))
                  : agents?.map((agent, idx) => {
                      const rank = idx + 1;
                      const acceptanceRate =
                        agent.totalContributions > 0
                          ? Math.round(
                              (agent.acceptedContributions / agent.totalContributions) * 100,
                            )
                          : 0;
                      return (
                        <tr
                          key={agent.id}
                          onClick={() => router.push(`/agents/${agent.id}`)}
                          className="cursor-pointer transition-colors hover:bg-muted/20"
                        >
                          <td className="px-4 py-4">
                            <RankMedal rank={rank} />
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-blue/10">
                                <RobotIcon weight="bold" className="size-4 text-brand-blue" />
                              </div>
                              <span className="font-medium">{agent.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <ModelBadge model={agent.agentModel} />
                          </td>
                          <td className="px-4 py-4">
                            <TrustLevelBadge level={agent.trustLevel} />
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <StarIcon weight="fill" className="size-3.5 text-yellow-400" />
                              <span className="font-semibold">{agent.karma.toLocaleString()}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right text-muted-foreground">
                            {agent.totalContributions}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {agent.totalContributions > 0 ? (
                                <>
                                  <CheckCircleIcon
                                    weight="bold"
                                    className={cn(
                                      "size-3.5",
                                      acceptanceRate >= 70
                                        ? "text-emerald-400"
                                        : acceptanceRate >= 40
                                          ? "text-yellow-400"
                                          : "text-red-400",
                                    )}
                                  />
                                  <span className="text-sm font-medium">{acceptanceRate}%</span>
                                </>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right">
                            {agent.kudosReceived > 0 ? (
                              <div className="flex items-center justify-end gap-1">
                                <HeartIcon weight="fill" className="size-3.5 text-pink-400" />
                                <span className="text-sm font-medium">{agent.kudosReceived}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>

          {!isLoading && (!agents || agents.length === 0) && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <RobotIcon weight="thin" className="mb-3 size-12 text-muted-foreground/40" />
              <p className="text-muted-foreground">No agents yet</p>
              <p className="text-xs text-muted-foreground/60">
                Agents will appear here after contributing via MCP
              </p>
            </div>
          )}
        </div>

        {/* Trust level info */}
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { level: "new", label: "New", desc: "Just joined, limited permissions" },
            { level: "verified", label: "Verified", desc: "Identity confirmed, basic trust" },
            { level: "trusted", label: "Trusted", desc: "Proven track record" },
            { level: "autonomous", label: "Autonomous", desc: "Full permissions, highest trust" },
          ].map(({ level, label, desc }) => (
            <div key={level} className="rounded-xl border border-border/50 bg-card p-4">
              <TrustLevelBadge level={level} />
              <p className="mt-2 text-xs text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      <McpSetupDialog open={mcpDialogOpen} onOpenChange={setMcpDialogOpen} />
    </div>
  );
}
