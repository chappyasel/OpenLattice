/**
 * In-memory store for active evaluator runs.
 *
 * Enables:
 * - Reconnection: navigate away and come back to see logs from an in-progress run
 * - Cancellation: abort a running cycle via AbortController
 * - Multiple listeners: multiple browser tabs can watch the same run
 */

export type RunType = "standard" | "scout";
export type RunStatus = "running" | "done" | "error" | "cancelled";

export type RunListener = (line: string) => void;

export interface EvaluatorRun {
  id: string;
  type: RunType;
  status: RunStatus;
  logs: string[];
  startedAt: Date;
  abortController: AbortController;
  listeners: Set<RunListener>;
}

/** One active run per type (standard / scout) */
const activeRuns = new Map<RunType, EvaluatorRun>();

let nextId = 1;

/** Start a new run. Cancels any existing run of the same type. */
export function startRun(type: RunType): EvaluatorRun {
  const existing = activeRuns.get(type);
  if (existing && existing.status === "running") {
    existing.abortController.abort();
    existing.status = "cancelled";
    broadcastToListeners(existing, "[Cancelled — new run started]");
    broadcastDone(existing);
  }

  const run: EvaluatorRun = {
    id: `run-${nextId++}`,
    type,
    status: "running",
    logs: [],
    startedAt: new Date(),
    abortController: new AbortController(),
    listeners: new Set(),
  };

  activeRuns.set(type, run);
  return run;
}

/** Get the active run for a type (if any). */
export function getActiveRun(type: RunType): EvaluatorRun | undefined {
  return activeRuns.get(type);
}

/** Cancel a running cycle. */
export function cancelRun(type: RunType): boolean {
  const run = activeRuns.get(type);
  if (!run || run.status !== "running") return false;

  run.abortController.abort();
  run.status = "cancelled";
  broadcastToListeners(run, "[Cancelled by user]");
  broadcastDone(run);
  return true;
}

/** Create a log callback that writes to the run's buffer AND broadcasts to listeners. */
export function createRunLogger(run: EvaluatorRun): (line: string) => void {
  return (line: string) => {
    run.logs.push(line);
    broadcastToListeners(run, line);
  };
}

/** Mark a run as complete. */
export function finishRun(
  type: RunType,
  status: "done" | "error" = "done",
): void {
  const run = activeRuns.get(type);
  if (!run || run.status !== "running") return;
  run.status = status;
  broadcastDone(run);
}

/** Subscribe a listener, replaying existing logs first. Returns unsubscribe fn. */
export function subscribe(
  run: EvaluatorRun,
  onLine: RunListener,
  onDone: (status: RunStatus) => void,
): () => void {
  // Replay buffered logs
  for (const line of run.logs) {
    onLine(line);
  }

  // If already finished, send done immediately
  if (run.status !== "running") {
    onDone(run.status);
    return () => {};
  }

  // Subscribe for new lines
  const wrappedListener: RunListener = (line) => {
    if (line === "__DONE__") {
      onDone(run.status);
    } else {
      onLine(line);
    }
  };
  run.listeners.add(wrappedListener);

  return () => {
    run.listeners.delete(wrappedListener);
  };
}

function broadcastToListeners(run: EvaluatorRun, line: string) {
  for (const listener of run.listeners) {
    try {
      listener(line);
    } catch {
      // Listener threw (e.g. stream closed) — remove it
      run.listeners.delete(listener);
    }
  }
}

function broadcastDone(run: EvaluatorRun) {
  broadcastToListeners(run, "__DONE__");
  run.listeners.clear();
}
