import { auth, isAdmin } from "@/lib/auth";
import { getActiveRun } from "@/lib/evaluator/run-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const standard = getActiveRun("standard");
  const scout = getActiveRun("scout");

  return Response.json({
    standard: standard
      ? { id: standard.id, status: standard.status, logCount: standard.logs.length }
      : null,
    scout: scout
      ? { id: scout.id, status: scout.status, logCount: scout.logs.length }
      : null,
  });
}
