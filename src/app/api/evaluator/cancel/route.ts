import { auth, isAdmin } from "@/lib/auth";
import { cancelRun, type RunType } from "@/lib/evaluator/run-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await request.json()) as { type?: string };
  const type = body.type as RunType | undefined;

  if (!type || (type !== "standard" && type !== "scout")) {
    return Response.json(
      { error: 'Missing or invalid "type" — must be "standard" or "scout"' },
      { status: 400 },
    );
  }

  const cancelled = cancelRun(type);
  return Response.json({ cancelled });
}
