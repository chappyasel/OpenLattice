import { auth, isAdmin } from "@/lib/auth";
import { getActiveBatch } from "@/lib/scout-batch-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const batch = getActiveBatch();
  return Response.json({ batch });
}
