"use client";

import { useState } from "react";
import {
  RobotIcon,
  ClipboardIcon,
  BookOpenIcon,
  StarIcon,
  ChartBarIcon,
  ClockIcon,
  CaretDownIcon,
  CaretUpIcon,
  SpinnerIcon,
  BrainIcon,
  LightningIcon,
  PlayIcon,
  ExamIcon,
  ScalesIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { SubmissionStatusBadge, EvalTypeBadge, ConsensusStatusBadge, EvaluatorAgreementBadge } from "@/components/badges";

// ─── Score Bar ─────────────────────────────────────────────────────────────────

function ScoreBar({ label, value, max = 10 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const barColor =
    pct > 70 ? "bg-emerald-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500";
  const textColor =
    pct > 70 ? "text-emerald-400" : pct >= 40 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="flex items-center gap-3">
      <span className="w-36 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="flex-1 overflow-hidden rounded-full bg-muted/40 h-1.5">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn("w-8 text-right text-xs font-semibold tabular-nums", textColor)}>
        {typeof value === "number" ? value.toFixed(value % 1 === 0 ? 0 : 1) : value}
      </span>
    </div>
  );
}

// ─── Evaluation Trace ─────────────────────────────────────────────────────────

function ExpansionReviewTrace({ data }: { data: Record<string, unknown> }) {
  const scores = data.scores as Record<string, Record<string, number>> | undefined;
  const suggestions = data.improvementSuggestions as string[] | undefined;
  const overallScore = data.overallScore as number | undefined;
  const reputationDelta = data.reputationDelta as number | undefined;

  return (
    <div className="space-y-5">
      {/* Topic + Contributor */}
      <div className="grid grid-cols-2 gap-3">
        {!!data.topicTitle && (
          <div className="rounded-lg bg-muted/30 px-3 py-2.5">
            <div className="mb-0.5 text-xs text-muted-foreground">Topic</div>
            <div className="text-sm font-medium">{String(data.topicTitle)}</div>
          </div>
        )}
        {!!data.contributorName && (
          <div className="rounded-lg bg-muted/30 px-3 py-2.5">
            <div className="mb-0.5 text-xs text-muted-foreground">Contributor</div>
            <div className="text-sm font-medium font-mono">{String(data.contributorName)}</div>
          </div>
        )}
      </div>

      {/* Score breakdown */}
      {!!scores && (
        <div className="grid gap-4 md:grid-cols-3">
          {Object.entries(scores).map(([section, sectionScores]) => (
            <div key={section} className="rounded-lg border border-border/40 bg-muted/10 p-3">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section}
              </div>
              <div className="space-y-2">
                {Object.entries(sectionScores).map(([key, val]) => (
                  <ScoreBar key={key} label={key} value={val} max={10} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Overall + Reputation row */}
      <div className="flex items-center gap-4">
        {overallScore !== undefined && (
          <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card px-4 py-3">
            <div>
              <div className="text-xs text-muted-foreground">Overall Score</div>
              <div className="text-3xl font-bold tracking-tight">{overallScore}<span className="text-base font-normal text-muted-foreground">/10</span></div>
            </div>
            <div className={cn("h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0",
              overallScore > 7 ? "bg-emerald-500/10 text-emerald-400" :
              overallScore >= 4 ? "bg-yellow-500/10 text-yellow-400" :
              "bg-red-500/10 text-red-400"
            )}>
              {overallScore > 7 ? "A" : overallScore >= 4 ? "B" : "C"}
            </div>
          </div>
        )}
        {reputationDelta !== undefined && (
          <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card px-4 py-3">
            <StarIcon weight="fill" className="size-4 text-yellow-400" />
            <div>
              <div className="text-xs text-muted-foreground">Reputation Delta</div>
              <div className={cn("text-xl font-bold", reputationDelta >= 0 ? "text-emerald-400" : "text-red-400")}>
                {reputationDelta >= 0 ? "+" : ""}{reputationDelta}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reasoning */}
      {!!data.reasoning && (
        <blockquote className="border-l-2 border-brand-blue/50 pl-4 text-sm text-muted-foreground italic leading-relaxed">
          {String(data.reasoning)}
        </blockquote>
      )}

      {/* Improvement suggestions */}
      {!!suggestions && suggestions.length > 0 && (
        <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-orange-400">
            <LightningIcon weight="bold" className="size-3.5" />
            Improvement Suggestions
          </div>
          <ul className="space-y-1.5">
            {suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-0.5 shrink-0 text-orange-400/70">•</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ResourceScoreTrace({ data }: { data: Record<string, unknown> }) {
  const dimensions = data.dimensions as Record<string, number> | undefined;
  const overallScore = data.score as number | undefined;

  return (
    <div className="space-y-4">
      {!!data.resourceName && (
        <div className="rounded-lg bg-muted/30 px-3 py-2.5">
          <div className="mb-0.5 text-xs text-muted-foreground">Resource</div>
          <div className="text-sm font-medium">{String(data.resourceName)}</div>
        </div>
      )}

      {!!dimensions && (
        <div className="rounded-lg border border-border/40 bg-muted/10 p-4 space-y-2.5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Score Dimensions</div>
          {Object.entries(dimensions).map(([key, val]) => (
            <ScoreBar key={key} label={key} value={val} max={100} />
          ))}
        </div>
      )}

      {overallScore !== undefined && (
        <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card px-4 py-3 w-fit">
          <div>
            <div className="text-xs text-muted-foreground">Overall Score</div>
            <div className="text-3xl font-bold tracking-tight">{overallScore}<span className="text-base font-normal text-muted-foreground">/100</span></div>
          </div>
        </div>
      )}

      {!!data.reasoning && (
        <blockquote className="border-l-2 border-brand-blue/50 pl-4 text-sm text-muted-foreground italic leading-relaxed">
          {String(data.reasoning)}
        </blockquote>
      )}
    </div>
  );
}

function EvaluationTrace({ data }: { data: Record<string, unknown> }) {
  const type = data.type as string | undefined;

  if (type === "expansion_review") return <ExpansionReviewTrace data={data} />;
  if (type === "resource_score") return <ResourceScoreTrace data={data} />;
  return (
    <pre className="overflow-auto rounded-lg bg-muted/30 p-4 text-xs text-muted-foreground">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

// ─── Feed Card ─────────────────────────────────────────────────────────────────

type FeedItem = {
  id: string;
  type: string;
  description: string | null;
  data: Record<string, unknown> | null;
  createdAt: Date;
  contributor?: { name: string } | null;
  submission?: { evaluationCount: number; consensusReachedAt: Date | null } | null;
};

function typeIcon(evalType: string, activityType?: string) {
  if (activityType === "evaluation_submitted") return ExamIcon;
  if (activityType === "consensus_reached") return ScalesIcon;
  if (activityType === "trust_level_changed") return ShieldCheckIcon;
  if (evalType === "expansion_review") return ClipboardIcon;
  if (evalType === "resource_score") return BookOpenIcon;
  return RobotIcon;
}

function getVerdict(data: Record<string, unknown>, activityType?: string): string {
  if (activityType === "evaluation_submitted") return (data.verdict as string) ?? "reviewed";
  if (activityType === "consensus_reached") return (data.verdict as string) ?? "consensus";
  if (activityType === "trust_level_changed") return "trust change";
  if (data.type === "expansion_review") return (data.verdict as string) ?? "reviewed";
  if (data.type === "resource_score") return "scored";
  return "reviewed";
}

function getIconBg(evalType: string, activityType?: string): string {
  if (activityType === "evaluation_submitted") return "bg-violet-500/10 text-violet-400";
  if (activityType === "consensus_reached") return "bg-teal-500/10 text-teal-400";
  if (activityType === "trust_level_changed") return "bg-orange-500/10 text-orange-400";
  if (evalType === "expansion_review") return "bg-cyan-500/10 text-cyan-400";
  return "bg-blue-500/10 text-blue-400";
}

function EvalCard({ item, expanded, onToggle }: {
  item: FeedItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const data = item.data ?? {};
  const evalType = (data.type as string) ?? item.type;
  const activityType = item.type;
  const isConsensusType = ["evaluation_submitted", "consensus_reached", "trust_level_changed"].includes(activityType);
  const Icon = typeIcon(evalType, activityType);
  const verdict = getVerdict(data, activityType);
  const durationMs = data.durationMs as number | undefined;
  const consensusStatus = data.status as string | undefined;
  const agreedWithConsensus = data.agreedWithConsensus as boolean | undefined;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card transition-all duration-200",
        expanded ? "border-border" : "border-border/50 hover:border-border/80",
      )}
    >
      {/* Collapsed header — always visible */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        {/* Type icon */}
        <div className={cn(
          "flex shrink-0 items-center justify-center rounded-lg p-2",
          getIconBg(evalType, activityType),
        )}>
          <Icon weight="bold" className="size-4" />
        </div>

        {/* Description */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-snug">
            {item.description ?? "Evaluation"}
          </p>
          {item.contributor && (
            <p className="mt-0.5 text-xs text-muted-foreground font-mono">
              {item.contributor.name}
            </p>
          )}
        </div>

        {/* Badges */}
        <div className="flex shrink-0 items-center gap-2">
          {!isConsensusType && <EvalTypeBadge type={evalType} />}
          {activityType === "consensus_reached" && consensusStatus && (
            <ConsensusStatusBadge status={consensusStatus === "split" ? "split" : "consensus"} size="sm" />
          )}
          {activityType === "evaluation_submitted" && agreedWithConsensus !== undefined && (
            <EvaluatorAgreementBadge agreed={agreedWithConsensus} />
          )}
          {!isConsensusType && <SubmissionStatusBadge status={verdict} />}
          {durationMs !== undefined && (
            <span className="hidden items-center gap-1 rounded-full border border-border/50 bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground sm:inline-flex">
              <ClockIcon weight="bold" className="size-3" />
              {(durationMs / 1000).toFixed(1)}s
            </span>
          )}
          <span className="hidden text-xs text-muted-foreground sm:block">
            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
          </span>
          <div className="text-muted-foreground">
            {expanded
              ? <CaretUpIcon weight="bold" className="size-4" />
              : <CaretDownIcon weight="bold" className="size-4" />
            }
          </div>
        </div>
      </button>

      {/* Expanded trace */}
      {expanded && (
        <div className="border-t border-border/50 px-4 pb-5 pt-4">
          <div className="mb-3 flex items-center gap-2">
            <BrainIcon weight="bold" className="size-3.5 text-brand-blue" />
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-blue">Evaluation Trace</span>
          </div>
          <EvaluationTrace data={data} />
        </div>
      )}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<any>;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/50 bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <div className={cn("rounded-lg p-1.5", color)}>
          <Icon weight="bold" className="size-3.5" />
        </div>
      </div>
      <div>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EvaluatorPage() {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [runOutput, setRunOutput] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const utils = api.useUtils();

  const { data: stats } = api.evaluator.getEvaluationStats.useQuery(undefined, {
    refetchInterval: 10000,
  });

  const { data: feed, isLoading } = api.evaluator.getEvaluationFeed.useQuery(
    { limit: 50 },
    { refetchInterval: 10000 },
  );

  const runEvaluator = {
    isPending: isRunning,
    mutate: () => {
      setIsRunning(true);
      setRunOutput("");
      const es = new EventSource("/api/evaluator/stream");
      es.onmessage = (e) => {
        const line = JSON.parse(e.data as string) as string;
        setRunOutput((prev) => (prev ? prev + "\n" + line : line));
      };
      es.addEventListener("done", () => {
        es.close();
        setIsRunning(false);
        void utils.evaluator.getEvaluationFeed.invalidate();
        void utils.evaluator.getEvaluationStats.invalidate();
      });
      es.onerror = () => {
        es.close();
        setIsRunning(false);
        setRunOutput((prev) => (prev ? prev + "\nConnection error" : "Connection error"));
      };
    },
  };

  const items = (feed ?? []) as FeedItem[];

  function toggleCard(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const approvalRate =
    stats && stats.expansionReviews > 0
      ? Math.round((stats.approvals / stats.expansionReviews) * 100)
      : null;

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="flex items-center justify-center rounded-xl bg-brand-blue/10 p-2.5">
                <RobotIcon weight="bold" className="size-6 text-brand-blue" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold tracking-tight">Arbiter</h1>
                  <span className="rounded-full border border-border bg-card px-2 py-0.5 font-mono text-xs text-muted-foreground">
                    claude-sonnet-4
                  </span>
                  <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Active
                  </span>
                </div>
              </div>
            </div>
            <p className="ml-[52px] text-muted-foreground text-sm">
              In-house evaluator agent — reviews submissions and scores resources
            </p>
          </div>
          <button
            onClick={() => {
              setRunOutput(null);
              runEvaluator.mutate();
            }}
            disabled={runEvaluator.isPending}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-brand-blue/30 bg-brand-blue/10 px-4 py-2.5 text-sm font-medium text-brand-blue transition-colors hover:bg-brand-blue/20 disabled:opacity-50"
          >
            {runEvaluator.isPending ? (
              <SpinnerIcon weight="bold" className="size-4 animate-spin" />
            ) : (
              <PlayIcon weight="bold" className="size-4" />
            )}
            {runEvaluator.isPending ? "Running..." : "Run Cycle"}
          </button>
        </div>

        {/* Evaluator output */}
        {runOutput !== null && (
          <div className="mb-8 rounded-xl border border-border/50 bg-card">
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <BrainIcon weight="bold" className="size-3.5 text-brand-blue" />
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-blue">
                  Cycle Output
                </span>
                {runOutput !== null && !isRunning && (
                  <span className={cn(
                    "rounded-full border px-2 py-0.5 text-xs font-medium",
                    !runOutput.includes("[Fatal]") && !runOutput.includes("Connection error")
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                      : "border-red-500/20 bg-red-500/10 text-red-400",
                  )}>
                    {!runOutput.includes("[Fatal]") && !runOutput.includes("Connection error") ? "Success" : "Failed"}
                  </span>
                )}
              </div>
              <button
                onClick={() => setRunOutput(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Dismiss
              </button>
            </div>
            <pre className="max-h-80 overflow-auto p-4 text-xs text-muted-foreground font-mono leading-relaxed whitespace-pre-wrap">
              {runOutput || "No output"}
            </pre>
          </div>
        )}

        {/* Stats Row */}
        <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-6">
          <StatCard
            label="Total Evaluations"
            value={stats?.total ?? 0}
            icon={ChartBarIcon}
            color="bg-brand-blue/10 text-brand-blue"
          />
          <StatCard
            label="Expansion Reviews"
            value={stats?.expansionReviews ?? 0}
            sub={approvalRate !== null ? `${approvalRate}% approval rate` : undefined}
            icon={ClipboardIcon}
            color="bg-cyan-500/10 text-cyan-400"
          />
          <StatCard
            label="Revisions Requested"
            value={stats?.revisionRequests ?? 0}
            sub="sent back for fixes"
            icon={LightningIcon}
            color="bg-amber-500/10 text-amber-400"
          />
          <StatCard
            label="Resources Scored"
            value={stats?.resourceScores ?? 0}
            sub={stats?.avgResourceScore ? `avg ${stats.avgResourceScore}/100` : undefined}
            icon={BookOpenIcon}
            color="bg-blue-500/10 text-blue-400"
          />
          <StatCard
            label="Avg Response"
            value={stats?.avgDurationMs ? `${(stats.avgDurationMs / 1000).toFixed(1)}s` : "—"}
            sub="per evaluation"
            icon={ClockIcon}
            color="bg-emerald-500/10 text-emerald-400"
          />
        </div>

        {/* Feed */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BrainIcon weight="bold" className="size-4 text-brand-blue" />
              <h2 className="text-base font-semibold">Evaluation Feed</h2>
              {items.length > 0 && (
                <span className="rounded-full bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
                  {items.length}
                </span>
              )}
            </div>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <SpinnerIcon weight="bold" className="size-3 animate-spin opacity-50" />
              Live — refreshes every 10s
            </span>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-xl border border-border/50 bg-card"
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border/50 bg-card py-20 text-center">
              <RobotIcon weight="thin" className="mb-3 size-12 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No evaluations yet</p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Arbiter will appear here once it begins processing
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <EvalCard
                  key={item.id}
                  item={item}
                  expanded={expandedIds.has(item.id)}
                  onToggle={() => toggleCard(item.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
