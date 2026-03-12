import { auth, isAdmin } from "@/lib/auth";
import { getActiveRun } from "@/lib/evaluator/run-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const standard = getActiveRun("standard");

  return Response.json({
    standard: standard
      ? { id: standard.id, status: standard.status, logCount: standard.logs.length }
      : null,
  });
}
