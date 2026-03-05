import { type Config } from "drizzle-kit";

export default {
  schema: "./src/server/db/schema",
  out: "./src/server/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL as string,
  },
  strict: true,
  migrations: {
    prefix: "index",
  },
} satisfies Config;
