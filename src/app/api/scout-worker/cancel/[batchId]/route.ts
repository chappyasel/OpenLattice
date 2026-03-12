import { auth, isAdmin } from "@/lib/auth";
import { env } from "@/env";
import { finishBatch } from "@/lib/scout-batch-store";

export const dynamic = "force-dynamic";

export async function POST(
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
    `${env.SCOUT_WORKER_URL}/cancel/${batchId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.SCOUT_WORKER_SECRET}`,
      },
    },
  );

  finishBatch(batchId, "cancelled");
  return Response.json(await upstream.json(), { status: upstream.status });
}
