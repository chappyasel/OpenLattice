import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  shared: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },
  server: {
    DATABASE_URL: z.string().url(),
    AUTH_SECRET: z.string(),
    AUTH_GOOGLE_CLIENT_ID: z.string(),
    AUTH_GOOGLE_CLIENT_SECRET: z.string(),
    ADMIN_EMAILS: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_URL: z.string().url(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_GOOGLE_CLIENT_ID: process.env.AUTH_GOOGLE_CLIENT_ID,
    AUTH_GOOGLE_CLIENT_SECRET: process.env.AUTH_GOOGLE_CLIENT_SECRET,
    NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
