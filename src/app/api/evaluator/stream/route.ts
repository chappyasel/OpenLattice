import { auth, isAdmin } from "@/lib/auth";
import { runEvaluationCycle } from "@/lib/evaluator/cycle";
import { getEvaluatorApiKey } from "@/lib/evaluator/get-api-key";
import {
  startRun,
  getActiveRun,
  createRunLogger,
  finishRun,
  subscribe,
} from "@/lib/evaluator/run-store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const baseUrl = process.env.OPENLATTICE_URL ?? process.env.NEXT_PUBLIC_URL;
  if (!baseUrl) {
    return new Response("Missing OPENLATTICE_URL or NEXT_PUBLIC_URL", {
      status: 500,
    });
  }

  let apiKey: string;
  try {
    apiKey = await getEvaluatorApiKey();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(msg, { status: 500 });
  }

  const encoder = new TextEncoder();

  // Check for an existing active run to reconnect to
  const existingRun = getActiveRun("standard");

  const stream = new ReadableStream({
    start(controller) {
      function send(line: string) {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(line)}\n\n`),
          );
        } catch {
          // Stream already closed
        }
      }

      function sendDone(status: string) {
        try {
          controller.enqueue(
            encoder.encode(
              `event: done\ndata: ${status === "done" ? "ok" : status}\n\n`,
            ),
          );
          controller.close();
        } catch {
          // already closed
        }
      }

      if (existingRun && existingRun.status === "running") {
        // Reconnect: replay logs and subscribe for new ones
        send("[Reconnected to active run]");
        subscribe(existingRun, send, (status) => sendDone(status));
      } else {
        // Start a new run
        const run = startRun("standard");
        const log = createRunLogger(run);

        // Subscribe this client to the run
        subscribe(run, send, (status) => sendDone(status));

        // Run the cycle in the background (don't await in start())
        void (async () => {
          try {
            await runEvaluationCycle(
              {
                baseUrl,
                apiKey,
                runGapAnalysis: true,
                signal: run.abortController.signal,
              },
              log,
            );
            finishRun("standard", "done");
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            log(`[Fatal] ${msg}`);
            finishRun("standard", "error");
          }
        })();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
