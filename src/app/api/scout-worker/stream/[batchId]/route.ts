import { auth, isAdmin } from "@/lib/auth";
import { env } from "@/env";
import { finishBatch } from "@/lib/scout-batch-store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!env.SCOUT_WORKER_URL || !env.SCOUT_WORKER_SECRET) {
    return new Response("Scout worker not configured", { status: 500 });
  }

  const { batchId } = await params;

  const upstream = await fetch(
    `${env.SCOUT_WORKER_URL}/stream/${batchId}`,
    {
      headers: {
        Authorization: `Bearer ${env.SCOUT_WORKER_SECRET}`,
      },
    },
  );

  if (!upstream.ok || !upstream.body) {
    return new Response(await upstream.text(), { status: upstream.status });
  }

  // Wrap the upstream body to detect when the stream ends and mark batch done
  const reader = upstream.body.getReader();
  const stream = new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        finishBatch(batchId, "done");
        controller.close();
        return;
      }
      controller.enqueue(value);
    },
    cancel() {
      void reader.cancel();
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
