import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

export default auth((request) => {
  if (!request.auth) {
    const signInUrl = new URL("/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /signin (auth page)
     * - /api (NextAuth, tRPC, cron, evaluator, scout)
     * - /_next (Next.js internals)
     * - Static assets
     */
    "/((?!signin|api|_next|favicon\\.ico|favicon\\.svg|fonts|images|logo\\.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
