import { runScoutCycle } from "./agent.js";

export type ScoutStatus = "queued" | "running" | "done" | "error" | "cancelled";

export interface ScoutRun {
  id: string;
  status: ScoutStatus;
  abortController: AbortController;
  logs: string[];
}

export interface BatchRun {
  batchId: string;
  scouts: Map<string, ScoutRun>;
  startedAt: Date;
  listeners: Set<(event: string) => void>;
  cleanupTimer: ReturnType<typeof setTimeout>;
}

const batches = new Map<string, BatchRun>();

// Concurrency semaphore: max 10 concurrent query() calls
let running = 0;
const MAX_CONCURRENT = 10;
const waitQueue: Array<() => void> = [];

async function acquireSemaphore(): Promise<void> {
  if (running < MAX_CONCURRENT) {
    running++;
    return;
  }
  return new Promise<void>((resolve) => {
    waitQueue.push(() => {
      running++;
      resolve();
    });
  });
}

function releaseSemaphore(): void {
  running--;
  const next = waitQueue.shift();
  if (next) next();
}

function broadcastLog(batch: BatchRun, scoutId: string, line: string): void {
  const event = `data: ${JSON.stringify({ scoutId, line })}\n\n`;
  for (const listener of batch.listeners) {
    listener(event);
  }
}

function broadcastEvent(
  batch: BatchRun,
  eventName: string,
  data: Record<string, unknown>,
): void {
  const event = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const listener of batch.listeners) {
    listener(event);
  }
}

function cancelBatch(batch: BatchRun): number {
  let cancelled = 0;
  for (const scout of batch.scouts.values()) {
    if (scout.status === "queued" || scout.status === "running") {
      scout.abortController.abort();
      scout.status = "cancelled";
      cancelled++;
    }
  }
  return cancelled;
}

function cleanupBatch(batchId: string): void {
  const batch = batches.get(batchId);
  if (batch) {
    clearTimeout(batch.cleanupTimer);
    batch.listeners.clear();
    batches.delete(batchId);
  }
}

export function startBatch(
  batchId: string,
  scouts: Array<{ id: string; apiKey: string; baseUrl: string }>,
): { batchId: string; started: number } {
  // Cancel any existing batch
  for (const [existingId, existingBatch] of batches) {
    if (existingId !== batchId) {
      cancelBatch(existingBatch);
      clearTimeout(existingBatch.cleanupTimer);
      // Schedule cleanup for the old batch
      existingBatch.cleanupTimer = setTimeout(
        () => cleanupBatch(existingId),
        60 * 60 * 1000,
      );
    }
  }

  // If this batchId already exists, cancel it
  const existing = batches.get(batchId);
  if (existing) {
    cancelBatch(existing);
    clearTimeout(existing.cleanupTimer);
    batches.delete(batchId);
  }

  const scoutMap = new Map<string, ScoutRun>();
  for (const s of scouts) {
    scoutMap.set(s.id, {
      id: s.id,
      status: "queued",
      abortController: new AbortController(),
      logs: [],
    });
  }

  const batch: BatchRun = {
    batchId,
    scouts: scoutMap,
    startedAt: new Date(),
    listeners: new Set(),
    cleanupTimer: setTimeout(() => cleanupBatch(batchId), 60 * 60 * 1000),
  };

  batches.set(batchId, batch);

  // Launch all scouts with concurrency limiting
  for (const scoutConfig of scouts) {
    const scoutRun = scoutMap.get(scoutConfig.id)!;

    void (async () => {
      await acquireSemaphore();

      // Check if cancelled while waiting in queue
      if (scoutRun.abortController.signal.aborted) {
        scoutRun.status = "cancelled";
        releaseSemaphore();
        return;
      }

      scoutRun.status = "running";

      try {
        await runScoutCycle(
          {
            scoutId: scoutConfig.id,
            baseUrl: scoutConfig.baseUrl,
            apiKey: scoutConfig.apiKey,
            signal: scoutRun.abortController.signal,
          },
          (line: string) => {
            scoutRun.logs.push(line);
            broadcastLog(batch, scoutConfig.id, line);
          },
        );
        scoutRun.status = scoutRun.abortController.signal.aborted
          ? "cancelled"
          : "done";
      } catch {
        scoutRun.status = scoutRun.abortController.signal.aborted
          ? "cancelled"
          : "error";
      } finally {
        releaseSemaphore();
        broadcastEvent(batch, "scout-done", { scoutId: scoutConfig.id });

        // Check if all scouts are finished
        const allDone = [...batch.scouts.values()].every(
          (s) =>
            s.status === "done" ||
            s.status === "error" ||
            s.status === "cancelled",
        );
        if (allDone) {
          broadcastEvent(batch, "batch-done", {});
        }
      }
    })();
  }

  return { batchId, started: scouts.length };
}

export function cancelBatchById(batchId: string): { cancelled: number } {
  const batch = batches.get(batchId);
  if (!batch) return { cancelled: 0 };
  return { cancelled: cancelBatch(batch) };
}

export function subscribe(
  batchId: string,
  listener: (event: string) => void,
): (() => void) | null {
  const batch = batches.get(batchId);
  if (!batch) return null;

  // Replay buffered logs
  for (const [scoutId, scout] of batch.scouts) {
    for (const line of scout.logs) {
      listener(`data: ${JSON.stringify({ scoutId, line })}\n\n`);
    }
  }

  // Check if already done and send events for completed scouts
  for (const [scoutId, scout] of batch.scouts) {
    if (
      scout.status === "done" ||
      scout.status === "error" ||
      scout.status === "cancelled"
    ) {
      listener(
        `event: scout-done\ndata: ${JSON.stringify({ scoutId })}\n\n`,
      );
    }
  }

  const allDone = [...batch.scouts.values()].every(
    (s) =>
      s.status === "done" ||
      s.status === "error" ||
      s.status === "cancelled",
  );
  if (allDone) {
    listener(`event: batch-done\ndata: ${JSON.stringify({})}\n\n`);
  }

  batch.listeners.add(listener);

  return () => {
    batch.listeners.delete(listener);
  };
}
