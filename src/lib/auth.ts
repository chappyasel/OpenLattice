import type { DefaultSession } from "next-auth";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { env } from "@/env";

async function verifyPlatformUser(
  email: string,
): Promise<{ valid: boolean; user?: unknown }> {
  try {
    const res = await fetch(
      `${env.PLATFORM_API_URL}/api/public/users/verifyUser`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.PLATFORM_API_KEY}`,
        },
        body: JSON.stringify({ email: email.toLowerCase() }),
      },
    );
    if (!res.ok) return { valid: false };
    return (await res.json()) as { valid: boolean; user?: unknown };
  } catch {
    return { valid: false };
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: env.AUTH_GOOGLE_CLIENT_ID,
      clientSecret: env.AUTH_GOOGLE_CLIENT_SECRET,
      checks: [],
    }),
  ],
  pages: {
    signIn: "/signin",
    error: "/signin",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const result = await verifyPlatformUser(user.email);
      return result.valid;
    },
    session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          email: token.email?.toLowerCase(),
        },
      };
    },
  },
});

const adminEmails = new Set(
  (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails.has(email.toLowerCase());
}

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      email: string;
    } & DefaultSession["user"];
  }
}
