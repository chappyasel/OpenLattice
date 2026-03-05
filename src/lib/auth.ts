import type { DefaultSession } from "next-auth";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { env } from "@/env";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: env.AUTH_GOOGLE_CLIENT_ID,
      clientSecret: env.AUTH_GOOGLE_CLIENT_SECRET,
      checks: [],
    }),
  ],
  callbacks: {
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
