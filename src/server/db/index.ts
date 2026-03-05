import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

function singleton<Value>(name: string, value: () => Value): Value {
  const globalAny: any = global;
  globalAny.singletons = globalAny.singletons || {};
  if (!globalAny.singletons[name]) {
    globalAny.singletons[name] = value();
  }
  return globalAny.singletons[name];
}

function createDatabaseConnection() {
  const pgClient = postgres(process.env.DATABASE_URL as string, {
    max: 20,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    transform: { undefined: null },
  });
  return drizzle(pgClient, { schema });
}

const db = singleton("db", createDatabaseConnection);

export { db, schema };
