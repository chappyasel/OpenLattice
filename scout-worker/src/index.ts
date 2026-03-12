import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { bearerAuth } from "./auth.js";
import { startBatch, cancelBatchById, subscribe } from "./run-manager.js";

const app = new Hono();

const secret = process.env.SCOUT_WORKER_SECRET;
if (!secret) {
  console.error("SCOUT_WORKER_SECRET env var is required");
  process.exit(1);
}

// Health check — no auth
app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

// All other routes require bearer auth
app.use("/run/*", bearerAuth(secret));
app.use("/stream/*", bearerAuth(secret));
app.use("/cancel/*", bearerAuth(secret));

// Start a batch of scout runs
app.post("/run", async (c) => {
  const body = await c.req.json<{
    batchId: string;
    scouts: Array<{ id: string; apiKey: string; baseUrl: string }>;
  }>();

  if (!body.batchId || !Array.isArray(body.scouts) || body.scouts.length === 0) {
    return c.json({ error: "Invalid request: batchId and non-empty scouts array required" }, 400);
  }

  const result = startBatch(body.batchId, body.scouts);
  return c.json(result);
});

// SSE stream for a batch
app.get("/stream/:batchId", (c) => {
  const batchId = c.req.param("batchId");

  return new Response(
    new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        const send = (event: string) => {
          try {
            controller.enqueue(encoder.encode(event));
          } catch {
            // Stream closed
          }
        };

        const unsubscribe = subscribe(batchId, send);

        if (!unsubscribe) {
          send(`data: ${JSON.stringify({ error: "Batch not found" })}\n\n`);
          controller.close();
          return;
        }

        // Heartbeat every 30s
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(":\n\n"));
          } catch {
            clearInterval(heartbeat);
          }
        }, 30_000);

        // Clean up when the stream is cancelled
        const checkClosed = setInterval(() => {
          try {
            // If controller is closed, this will throw
            controller.enqueue(new Uint8Array(0));
          } catch {
            clearInterval(checkClosed);
            clearInterval(heartbeat);
            unsubscribe();
          }
        }, 5_000);
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    },
  );
});

// Cancel a batch
app.post("/cancel/:batchId", (c) => {
  const batchId = c.req.param("batchId");
  const result = cancelBatchById(batchId);
  return c.json(result);
});

const port = parseInt(process.env.PORT ?? "8080", 10);

console.log(`Scout worker listening on port ${port}`);
serve({ fetch: app.fetch, port });
