import { auth, isAdmin } from "@/lib/auth";
import { cancelRun } from "@/lib/evaluator/run-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await request.json()) as { type?: string };

  if (body.type !== "standard") {
    return Response.json(
      { error: 'Missing or invalid "type" — must be "standard"' },
      { status: 400 },
    );
  }

  const cancelled = cancelRun("standard");
  return Response.json({ cancelled });
}
