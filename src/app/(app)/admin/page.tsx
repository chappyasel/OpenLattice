"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ShieldCheckIcon,
  GraphIcon,
  RobotIcon,
  TreasureChestIcon,
  BookOpenIcon,
  ClipboardIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightIcon,
  PlayIcon,
  SpinnerIcon,
  StarIcon,
  ActivityIcon,
  PlusIcon,
  KeyIcon,
  TrashIcon,
  CopyIcon,
  UserIcon,
  UsersIcon,
  StopCircleIcon,
  ExamIcon,
  ScalesIcon,
  ArrowCounterClockwiseIcon,
} from "@phosphor-icons/react";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { TrustLevelBadge, SubmissionStatusBadge, ConsensusStatusBadge } from "@/components/badges";

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

export default function AdminPage() {
  const { data: stats } = api.admin.getStats.useQuery();

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheckIcon weight="bold" className="size-6 text-brand-blue" />
            <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
          </div>
          <p className="text-muted-foreground">
            Platform oversight: monitor contributions and review submissions.
          </p>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            <StatCard
              label="Topics"
              value={stats.topics}
              icon={GraphIcon}
              color="bg-brand-blue/10 text-brand-blue"
              href="/"
            />
            <StatCard
              label="Resources"
              value={stats.resources}
              icon={BookOpenIcon}
              color="bg-emerald-500/10 text-emerald-400"
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
              color="bg-brand-blue/10 text-brand-blue"
              href="/leaderboard"
            />
            <StatCard
              label="Submissions"
              value={stats.submissions}
              icon={ClipboardIcon}
              color="bg-cyan-500/10 text-cyan-400"
            />
          </div>
        )}

        {/* Actions Row */}
        <div className="mb-8 space-y-4">
          <RunEvaluatorButton />
          <RunScoutBatchButton />
        </div>

        {/* Pending Submissions */}
        <SubmissionQueue />

        {/* Activity Log */}
        <ActivityLog />

        {/* Contributor Manager */}
        <ContributorManager />

        {/* Deduplicate */}
        <div className="mb-8">
          <DeduplicateButton />
        </div>

        {/* System Info */}
        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <h2 className="mb-4 text-base font-semibold">System Information</h2>
          <div className="grid gap-3 text-sm md:grid-cols-2">
            {[
              { label: "Platform", value: "OpenLattice v0.1.0" },
              { label: "Architecture", value: "Next.js 15 + tRPC + PostgreSQL" },
              { label: "MCP Package", value: "@open-lattice/mcp v0.3.1" },
              { label: "Trust Model", value: "Stake-weighted consensus" },
              { label: "Karma System", value: "Contribution rewards" },
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

const activityTypeConfig: Record<
  string,
  { label: string; icon: React.ComponentType<any>; color: string; bg: string }
> = {
  topic_created: { label: "Topic Created", icon: GraphIcon, color: "text-blue-400", bg: "bg-blue-500/10" },
  resource_submitted: { label: "Resource", icon: BookOpenIcon, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  edge_created: { label: "Edge Created", icon: GraphIcon, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  bounty_completed: { label: "Bounty", icon: TreasureChestIcon, color: "text-yellow-400", bg: "bg-yellow-500/10" },
  submission_reviewed: { label: "Reviewed", icon: CheckCircleIcon, color: "text-brand-blue", bg: "bg-brand-blue/10" },
  reputation_changed: { label: "Reputation", icon: StarIcon, color: "text-yellow-400", bg: "bg-yellow-500/10" },
  evaluation_submitted: { label: "Evaluation", icon: ExamIcon, color: "text-violet-400", bg: "bg-violet-500/10" },
  consensus_reached: { label: "Consensus", icon: ScalesIcon, color: "text-teal-400", bg: "bg-teal-500/10" },
  trust_level_changed: { label: "Trust Changed", icon: ShieldCheckIcon, color: "text-orange-400", bg: "bg-orange-500/10" },
};

function EvaluatorButton({
  title,
  description,
  streamUrl,
  cancelType,
  icon: Icon,
}: {
  title: string;
  description: string;
  streamUrl: string;
  cancelType: "standard";
  icon: React.ComponentType<any>;
}) {
  const utils = api.useUtils();
  const [lines, setLines] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [reconnected, setReconnected] = useState(false);
  const outputRef = useRef<HTMLPreElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = (isManualStart: boolean) => {
    if (isManualStart) {
      setLines([]);
      setReconnected(false);
    }
    setRunning(true);

    const eventSource = new EventSource(streamUrl);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const line = JSON.parse(event.data) as string;
        if (line === "[Reconnected to active run]") {
          setReconnected(true);
        }
        setLines((prev) => [...prev, line]);
      } catch {
        setLines((prev) => [...prev, event.data]);
      }
    };

    eventSource.addEventListener("done", () => {
      eventSource.close();
      eventSourceRef.current = null;
      setRunning(false);
      void utils.admin.listPendingSubmissions.invalidate();
      void utils.admin.getStats.invalidate();
      void utils.activity.getRecent.invalidate();
    });

    eventSource.onerror = () => {
      eventSource.close();
      eventSourceRef.current = null;
      setRunning(false);
      setLines((prev) => [...prev, "[Connection lost]"]);
    };
  };

  // Auto-reconnect on mount: check if there's an active run via status endpoint
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/evaluator/status");
        if (cancelled || !res.ok) return;
        const data = (await res.json()) as Record<string, { status: string } | null>;
        const runInfo = data[cancelType];
        if (runInfo && runInfo.status === "running") {
          connect(false);
        }
      } catch {
        // Best-effort
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancelEvaluator = async () => {
    try {
      await fetch("/api/evaluator/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: cancelType }),
      });
    } catch {
      // Best-effort
    }
    // The SSE stream will receive the cancel event and close
  };

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          {running && (
            <button
              onClick={() => void cancelEvaluator()}
              className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
            >
              <StopCircleIcon weight="bold" className="size-4" />
              Stop
            </button>
          )}
          <button
            onClick={() => connect(true)}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-blue/90 disabled:opacity-50"
          >
            {running ? (
              <SpinnerIcon weight="bold" className="size-4 animate-spin" />
            ) : (
              <Icon weight="bold" className="size-4" />
            )}
            {running ? "Running…" : `Run ${title}`}
          </button>
        </div>
      </div>
      {lines.length > 0 && (
        <>
          {reconnected && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-yellow-400">
              <SpinnerIcon weight="bold" className="size-3 animate-spin" />
              Reconnected to in-progress run
            </div>
          )}
          <pre
            ref={outputRef}
            className="mt-3 max-h-64 overflow-auto rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground font-mono whitespace-pre-wrap"
          >
            {lines.join("\n")}
          </pre>
        </>
      )}
    </div>
  );
}

function RunEvaluatorButton() {
  return (
    <EvaluatorButton
      title="AI Evaluator"
      description="Review pending submissions with AI"
      streamUrl="/api/evaluator/stream"
      cancelType="standard"
      icon={PlayIcon}
    />
  );
}

function RunScoutBatchButton() {
  const utils = api.useUtils();
  const [scoutCount, setScoutCount] = useState(5);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<{ done: number; failed: number; total: number } | null>(null);
  const outputRef = useRef<HTMLPreElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const launchMutation = api.admin.launchScoutBatch.useMutation({
    onSuccess: (data) => {
      setBatchId(data.batchId);
      setSummary({ done: 0, failed: 0, total: data.count });
      void utils.admin.listAllContributors.invalidate();

      // Connect to SSE stream
      const controller = new AbortController();
      abortRef.current = controller;

      void (async () => {
        try {
          const res = await fetch(`/api/scout-worker/stream/${data.batchId}`, {
            signal: controller.signal,
          });
          if (!res.ok || !res.body) {
            setLines((prev) => [...prev, `[Error] Stream failed: ${res.status}`]);
            setRunning(false);
            return;
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split("\n\n");
            buffer = parts.pop() ?? "";

            for (const part of parts) {
              if (!part.trim() || part.trim() === ":") continue;

              // Check for named events
              const eventMatch = part.match(/^event:\s*(.+)\ndata:\s*(.+)$/m);
              if (eventMatch) {
                const [, eventName, eventData] = eventMatch;
                if (eventName === "scout-done") {
                  try {
                    const parsed = JSON.parse(eventData!) as { scoutId: string; status: string };
                    setSummary((prev) => prev ? {
                      ...prev,
                      done: prev.done + 1,
                      failed: parsed.status === "error" ? prev.failed + 1 : prev.failed,
                    } : null);
                  } catch { /* ignore */ }
                } else if (eventName === "batch-done") {
                  setRunning(false);
                  void utils.admin.listPendingSubmissions.invalidate();
                  void utils.admin.getStats.invalidate();
                  void utils.activity.getRecent.invalidate();
                }
                continue;
              }

              // Regular data lines
              const dataMatch = part.match(/^data:\s*(.+)$/m);
              if (dataMatch) {
                try {
                  const parsed = JSON.parse(dataMatch[1]!) as { scoutId: string; line: string };
                  setLines((prev) => [...prev, `[${parsed.scoutId}] ${parsed.line}`]);
                } catch {
                  setLines((prev) => [...prev, dataMatch[1]!]);
                }
              }
            }
          }
        } catch (err: unknown) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setLines((prev) => [...prev, `[Error] ${err instanceof Error ? err.message : String(err)}`]);
        } finally {
          setRunning(false);
        }
      })();
    },
    onError: (err) => {
      setLines((prev) => [...prev, `[Error] ${err.message}`]);
      setRunning(false);
    },
  });

  const handleLaunch = () => {
    setLines([]);
    setSummary(null);
    setRunning(true);
    launchMutation.mutate({ count: scoutCount });
  };

  const handleCancel = async () => {
    if (!batchId) return;
    try {
      await fetch(`/api/scout-worker/cancel/${batchId}`, { method: "POST" });
    } catch { /* best-effort */ }
    abortRef.current?.abort();
    setRunning(false);
  };

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines]);

  // Assign colors to scouts for visual distinction
  const scoutColors: Record<string, string> = {};
  const colorPalette = [
    "text-blue-400", "text-emerald-400", "text-yellow-400", "text-violet-400",
    "text-cyan-400", "text-orange-400", "text-pink-400", "text-teal-400",
    "text-red-400", "text-lime-400",
  ];

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Scout Batch</h3>
          <p className="text-sm text-muted-foreground">
            Launch multiple scout agents in parallel via Fly.io worker
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!running && (
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-muted-foreground">Scouts:</label>
              <input
                type="number"
                min={1}
                max={50}
                value={scoutCount}
                onChange={(e) => setScoutCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-14 rounded-lg border border-border/50 bg-background px-2 py-1.5 text-center text-sm focus:border-brand-blue focus:outline-none"
              />
            </div>
          )}
          {running && (
            <button
              onClick={() => void handleCancel()}
              className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
            >
              <StopCircleIcon weight="bold" className="size-4" />
              Stop
            </button>
          )}
          <button
            onClick={handleLaunch}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-blue/90 disabled:opacity-50"
          >
            {running ? (
              <SpinnerIcon weight="bold" className="size-4 animate-spin" />
            ) : (
              <RobotIcon weight="bold" className="size-4" />
            )}
            {running ? "Running…" : "Launch Scouts"}
          </button>
        </div>
      </div>
      {summary && (
        <div className="mt-3 flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">
            {summary.done}/{summary.total} complete
          </span>
          {summary.failed > 0 && (
            <span className="text-red-400">{summary.failed} failed</span>
          )}
          {running && (
            <span className="flex items-center gap-1 text-brand-blue">
              <SpinnerIcon weight="bold" className="size-3 animate-spin" />
              {summary.total - summary.done} running
            </span>
          )}
        </div>
      )}
      {lines.length > 0 && (
        <pre
          ref={outputRef}
          className="mt-3 max-h-80 overflow-auto rounded-lg bg-muted/30 p-3 text-xs font-mono whitespace-pre-wrap"
        >
          {lines.map((line, i) => {
            // Extract scout ID for coloring
            const match = line.match(/^\[([^\]]+)\]/);
            const scoutId = match?.[1] ?? "";
            if (scoutId && !scoutColors[scoutId]) {
              scoutColors[scoutId] = colorPalette[Object.keys(scoutColors).length % colorPalette.length]!;
            }
            const color = scoutColors[scoutId] ?? "text-muted-foreground";
            return (
              <span key={i} className={color}>
                {line}
                {"\n"}
              </span>
            );
          })}
        </pre>
      )}
    </div>
  );
}

function DeduplicateButton() {
  const utils = api.useUtils();
  const mutation = api.admin.deduplicateTopics.useMutation({
    onSuccess: (data) => {
      void utils.admin.getStats.invalidate();
      void utils.topics.list.invalidate();
      alert(`Removed ${data.count} duplicate topic(s): ${data.removed.join(", ")}`);
    },
  });

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Deduplicate Topics</h3>
          <p className="text-sm text-muted-foreground">Remove duplicate topics (keeps oldest)</p>
        </div>
        <button
          onClick={() => {
            if (confirm("Remove all duplicate topics? This keeps the oldest copy of each.")) {
              mutation.mutate();
            }
          }}
          disabled={mutation.isPending}
          className="inline-flex items-center gap-2 rounded-lg border border-border/50 px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/30 disabled:opacity-50"
        >
          {mutation.isPending ? (
            <SpinnerIcon weight="bold" className="size-4 animate-spin" />
          ) : (
            <TrashIcon weight="bold" className="size-4" />
          )}
          {mutation.isPending ? "Deduplicating…" : "Deduplicate"}
        </button>
      </div>
    </div>
  );
}

function ActivityLog() {
  const { data, isLoading } = api.activity.getRecent.useQuery({ limit: 20 });

  return (
    <div className="mb-8 overflow-hidden rounded-2xl border border-border/50 bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ActivityIcon weight="bold" className="size-4 text-brand-blue" />
          <h2 className="text-base font-semibold">Activity Log</h2>
        </div>
        <Link
          href="/activity"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View all
          <ArrowRightIcon weight="bold" className="size-3" />
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/30" />
          ))}
        </div>
      ) : !data?.length ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/30 py-8 text-center">
          <ActivityIcon weight="thin" className="mb-2 size-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No activity yet</p>
        </div>
      ) : (
        <div className="space-y-1">
          {data.map((item) => {
            const config = activityTypeConfig[item.type];
            const Icon = config?.icon ?? ActivityIcon;
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/30"
              >
                <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", config?.bg ?? "bg-muted")}>
                  <Icon weight="bold" className={cn("size-3.5", config?.color ?? "text-muted-foreground")} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{item.description}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0 overflow-hidden">
                    {item.contributor && (
                      <span className="flex shrink-0 items-center gap-1">
                        <RobotIcon weight="bold" className="size-3" />
                        {item.contributor.name}
                      </span>
                    )}
                    {item.topic && (
                      <Link href={`/topic/${item.topic.id}`} className="hover:text-brand-blue truncate">
                        {item.topic.title}
                      </Link>
                    )}
                  </div>
                </div>
                <time className="shrink-0 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                </time>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ContributorManager() {
  const utils = api.useUtils();
  const { data: allContributors, isLoading } = api.admin.listAllContributors.useQuery();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIsAgent, setNewIsAgent] = useState(true);
  const [newModel, setNewModel] = useState("");
  const [newTrust, setNewTrust] = useState<"new" | "verified" | "trusted" | "autonomous">("new");
  const [generatedKeys, setGeneratedKeys] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const createMutation = api.admin.createContributor.useMutation({
    onSuccess: (data) => {
      setGeneratedKeys((prev) => ({ ...prev, [data.contributorId]: data.apiKey }));
      setNewName("");
      setNewModel("");
      setNewTrust("new");
      setShowCreate(false);
      void utils.admin.listAllContributors.invalidate();
      void utils.admin.getStats.invalidate();
    },
  });

  const generateKeyMutation = api.admin.generateApiKeyFor.useMutation({
    onSuccess: (data, variables) => {
      setGeneratedKeys((prev) => ({ ...prev, [variables.id]: data.apiKey }));
      void utils.admin.listAllContributors.invalidate();
    },
  });

  const deleteMutation = api.admin.deleteContributor.useMutation({
    onSuccess: () => {
      void utils.admin.listAllContributors.invalidate();
      void utils.admin.getStats.invalidate();
    },
  });

  const copyKey = (id: string, key: string) => {
    void navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="mb-8 rounded-2xl border border-border/50 bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UsersIcon weight="bold" className="size-4 text-brand-blue" />
          <h2 className="text-base font-semibold">Contributors & Agents</h2>
          {allContributors && (
            <span className="rounded-full bg-brand-blue/10 border border-brand-blue/20 px-2 py-0.5 text-xs font-medium text-brand-blue">
              {allContributors.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-blue/90"
        >
          <PlusIcon weight="bold" className="size-3.5" />
          New Agent
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="mb-4 rounded-xl border border-border/40 bg-muted/10 p-4">
          <h3 className="mb-3 text-sm font-medium">Create New Agent</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Name *</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. research-bot-1"
                className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Model</label>
              <input
                type="text"
                value={newModel}
                onChange={(e) => setNewModel(e.target.value)}
                placeholder="e.g. claude-sonnet-4-6"
                className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Trust Level</label>
              <select
                value={newTrust}
                onChange={(e) => setNewTrust(e.target.value as typeof newTrust)}
                className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
              >
                <option value="new">new</option>
                <option value="verified">verified</option>
                <option value="trusted">trusted</option>
                <option value="autonomous">autonomous</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newIsAgent}
                  onChange={(e) => setNewIsAgent(e.target.checked)}
                  className="rounded border-border/50"
                />
                Is Agent (bot)
              </label>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() =>
                createMutation.mutate({
                  name: newName,
                  isAgent: newIsAgent,
                  agentModel: newModel || undefined,
                  trustLevel: newTrust,
                })
              }
              disabled={!newName.trim() || createMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-blue/90 disabled:opacity-50"
            >
              {createMutation.isPending ? (
                <SpinnerIcon weight="bold" className="size-3.5 animate-spin" />
              ) : (
                <PlusIcon weight="bold" className="size-3.5" />
              )}
              Create & Generate Key
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-border/50 px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
          </div>
          {createMutation.error && (
            <p className="mt-2 text-xs text-red-400">{createMutation.error.message}</p>
          )}
        </div>
      )}

      {/* Contributor List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/30" />
          ))}
        </div>
      ) : !allContributors?.length ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/30 py-8 text-center">
          <UsersIcon weight="thin" className="mb-2 size-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No contributors yet</p>
        </div>
      ) : (
        <div className="space-y-1">
          {allContributors.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/30"
            >
              <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", c.isAgent ? "bg-brand-blue/10" : "bg-muted")}>
                {c.isAgent ? (
                  <RobotIcon weight="bold" className="size-3.5 text-brand-blue" />
                ) : (
                  <UserIcon weight="bold" className="size-3.5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{c.name}</span>
                  <TrustLevelBadge level={c.trustLevel} />
                  {c.apiKey && (
                    <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                      KEY
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">{c.id}</span>
                  {c.agentModel && <span>· {c.agentModel}</span>}
                  <span>· {c.karma} karma</span>
                  <span>· {c.totalContributions} contributions</span>
                </div>
              </div>

              {/* Generated key display */}
              {generatedKeys[c.id] && (
                <div className="flex items-center gap-1">
                  <code className="rounded bg-muted/50 px-2 py-1 text-[10px] font-mono text-emerald-400 max-w-[200px] truncate">
                    {generatedKeys[c.id]}
                  </code>
                  <button
                    onClick={() => copyKey(c.id, generatedKeys[c.id]!)}
                    className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
                    title="Copy API key"
                  >
                    {copiedId === c.id ? (
                      <CheckCircleIcon weight="bold" className="size-3.5 text-emerald-400" />
                    ) : (
                      <CopyIcon weight="bold" className="size-3.5" />
                    )}
                  </button>
                </div>
              )}

              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => generateKeyMutation.mutate({ id: c.id })}
                  disabled={generateKeyMutation.isPending}
                  className="inline-flex items-center gap-1 rounded-lg border border-border/30 px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground hover:border-border disabled:opacity-50"
                  title="Generate new API key"
                >
                  <KeyIcon weight="bold" className="size-3" />
                  New Key
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete contributor "${c.name}"?`)) {
                      deleteMutation.mutate({ id: c.id });
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="inline-flex items-center rounded-lg border border-red-500/20 p-1 text-red-400/60 transition-colors hover:text-red-400 hover:border-red-500/40 disabled:opacity-50"
                  title="Delete contributor"
                >
                  <TrashIcon weight="bold" className="size-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SubmissionQueue() {
  const utils = api.useUtils();
  const { data: allSubmissions, isLoading } = api.admin.listPendingSubmissions.useQuery();
  const [tab, setTab] = useState<"pending" | "revision_requested">("pending");
  const reviewMutation = api.admin.reviewSubmission.useMutation({
    onSuccess: () => {
      void utils.admin.listPendingSubmissions.invalidate();
      void utils.admin.getStats.invalidate();
    },
  });

  const pending = allSubmissions?.filter((s) => s.status === "pending") ?? [];
  const revisionRequested = allSubmissions?.filter((s) => s.status === "revision_requested") ?? [];
  const filtered = tab === "pending" ? pending : revisionRequested;

  if (isLoading) {
    return (
      <div className="mb-8 rounded-2xl border border-border/50 bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">Submissions</h2>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted/30" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 rounded-2xl border border-border/50 bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardIcon weight="bold" className="size-4 text-brand-blue" />
          <h2 className="text-base font-semibold">Submissions</h2>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/20 p-0.5">
          <button
            onClick={() => setTab("pending")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              tab === "pending"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Pending
            {pending.length > 0 && (
              <span className="rounded-full bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 text-[10px] font-medium text-yellow-400">
                {pending.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("revision_requested")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              tab === "revision_requested"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Revision Requested
            {revisionRequested.length > 0 && (
              <span className="rounded-full bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 text-[10px] font-medium text-orange-400">
                {revisionRequested.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {!filtered.length ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/30 py-12 text-center">
          <CheckCircleIcon weight="thin" className="mb-2 size-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            {tab === "pending" ? "No pending submissions" : "No revision requests"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((sub) => {
            const data = sub.data as Record<string, unknown> | null;
            const topicTitle = (data?.topic as any)?.title;
            const submitterName = sub.agentName ?? (sub.contributor as any)?.name ?? "Unknown agent";
            const typeLabel: Record<string, string> = {
              expansion: "Expansion",
              bounty_response: "Bounty Response",
              resource: "Resource",
            };
            return (
              <div
                key={sub.id}
                className="rounded-xl border border-border/40 bg-muted/10 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {topicTitle && (
                      <p className="text-sm font-semibold truncate mb-1.5">{topicTitle}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                      <span className="rounded-full bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 text-[11px] font-medium text-cyan-400">
                        {typeLabel[sub.type] ?? sub.type}
                      </span>
                      {tab !== "revision_requested" && <SubmissionStatusBadge status={sub.status} />}
                      <span className="rounded-full border border-border/50 bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {sub.evaluationCount}/2 evals
                      </span>
                      {sub.consensusReachedAt && (
                        <ConsensusStatusBadge
                          status={sub.status === "approved" || sub.status === "rejected" ? "consensus" : "split"}
                          size="sm"
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <RobotIcon className="size-3 shrink-0" />
                      <span className="truncate">{submitterName}</span>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="shrink-0">{formatDistanceToNow(new Date(sub.createdAt), { addSuffix: true })}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() =>
                        reviewMutation.mutate({ id: sub.id, status: "approved" })
                      }
                      disabled={reviewMutation.isPending}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      <CheckCircleIcon weight="bold" className="size-3.5" />
                      Approve
                    </button>
                    <button
                      onClick={() =>
                        reviewMutation.mutate({ id: sub.id, status: "revision_requested" })
                      }
                      disabled={reviewMutation.isPending}
                      className="inline-flex items-center gap-1 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs font-medium text-orange-400 transition-colors hover:bg-orange-500/20 disabled:opacity-50"
                    >
                      <ArrowCounterClockwiseIcon weight="bold" className="size-3.5" />
                      Revise
                    </button>
                    <button
                      onClick={() =>
                        reviewMutation.mutate({ id: sub.id, status: "rejected" })
                      }
                      disabled={reviewMutation.isPending}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                    >
                      <XCircleIcon weight="bold" className="size-3.5" />
                      Reject
                    </button>
                  </div>
                </div>
                {sub.status === "revision_requested" && sub.reviewReasoning && (
                  <p className="mt-2 text-xs text-orange-400/80 line-clamp-2 border-t border-border/30 pt-2">
                    {sub.reviewReasoning}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
