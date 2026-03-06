import { NextRequest } from "next/server";

import { runEvaluationCycle } from "@/lib/evaluator/cycle";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes (Vercel Pro)

export async function GET(request: NextRequest) {
  // Verify Vercel cron secret (or allow in dev)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const baseUrl = process.env.OPENLATTICE_URL ?? process.env.NEXT_PUBLIC_URL;
  const apiKey = process.env.EVALUATOR_API_KEY;

  if (!baseUrl || !apiKey) {
    return Response.json(
      { error: "Missing OPENLATTICE_URL or EVALUATOR_API_KEY" },
      { status: 500 },
    );
  }

  const logs: string[] = [];
  const log = (msg: string) => logs.push(msg);

  try {
    const result = await runEvaluationCycle(
      {
        baseUrl,
        apiKey,
        maxSubmissions: 10, // batch to stay within timeout
        runGapAnalysis: true,
      },
      log,
    );

    return Response.json({ success: true, result, logs });
  } catch (err: any) {
    log(`[Fatal] ${err.message}`);
    return Response.json(
      { success: false, error: err.message, logs },
      { status: 500 },
    );
  }
}
