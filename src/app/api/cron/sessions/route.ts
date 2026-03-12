import { NextRequest } from "next/server";

import { db } from "@/server/db";
import { researchSessions } from "@/server/db/schema";
import { eq, and, lt } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const result = await db
    .update(researchSessions)
    .set({ status: "expired" })
    .where(
      and(
        eq(researchSessions.status, "active"),
        lt(researchSessions.createdAt, cutoff),
      ),
    )
    .returning({ id: researchSessions.id });

  return Response.json({
    success: true,
    expiredCount: result.length,
    expiredIds: result.map((r) => r.id),
  });
}
