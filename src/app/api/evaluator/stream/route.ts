import { auth, isAdmin } from "@/lib/auth";
import { runEvaluationCycle } from "@/lib/evaluator/cycle";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const baseUrl = process.env.OPENLATTICE_URL ?? process.env.NEXT_PUBLIC_URL;
  const apiKey = process.env.EVALUATOR_API_KEY;

  if (!baseUrl || !apiKey) {
    return new Response("Missing OPENLATTICE_URL or EVALUATOR_API_KEY", {
      status: 500,
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(line: string) {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(line)}\n\n`),
          );
        } catch {
          // Stream already closed
        }
      }

      try {
        await runEvaluationCycle(
          { baseUrl, apiKey, runGapAnalysis: true },
          send,
        );
        controller.enqueue(encoder.encode("event: done\ndata: ok\n\n"));
      } catch (err: any) {
        send(`[Fatal] ${err.message}`);
        controller.enqueue(encoder.encode("event: done\ndata: error\n\n"));
      }

      try {
        controller.close();
      } catch {
        // already closed
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
