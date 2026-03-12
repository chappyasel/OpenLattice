/**
 * In-memory store for active scout batches.
 * Tracks the currently running batch so the admin UI can reconnect on page load.
 */

export interface ScoutBatch {
  batchId: string;
  count: number;
  startedAt: Date;
  status: "running" | "done" | "cancelled";
}

let activeBatch: ScoutBatch | null = null;

export function setActiveBatch(batchId: string, count: number): ScoutBatch {
  activeBatch = { batchId, count, startedAt: new Date(), status: "running" };
  return activeBatch;
}

export function getActiveBatch(): ScoutBatch | null {
  return activeBatch;
}

export function finishBatch(batchId: string, status: "done" | "cancelled" = "done") {
  if (activeBatch?.batchId === batchId) {
    activeBatch.status = status;
  }
}

export function clearBatch(batchId: string) {
  if (activeBatch?.batchId === batchId) {
    activeBatch = null;
  }
}
