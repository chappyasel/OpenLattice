import crypto from "crypto";
import { type ClassValue, clsx } from "clsx";
import { eq, type Column } from "drizzle-orm";
import { type PgTableWithColumns } from "drizzle-orm/pg-core";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatTimestamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

/** Generate a unique activity ID with a random suffix to prevent PK collisions at scale */
export function activityId(prefix: string, ...parts: (string | null | undefined)[]): string {
  const rand = crypto.randomUUID().slice(0, 8);
  const filtered = parts.filter(Boolean).join("--");
  return filtered ? `${prefix}--${filtered}--${rand}` : `${prefix}--${rand}`;
}

export async function generateUniqueId(
  db: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  table: PgTableWithColumns<any>,
  idColumn: Column,
  base: string,
): Promise<string> {
  const candidate = slugify(base);
  if (!candidate) throw new Error("Cannot generate ID from empty string");

  // Check if base ID is available
  const existing = await (db as any)
    .select({ id: idColumn })
    .from(table)
    .where(eq(idColumn, candidate))
    .limit(1);

  if (existing.length === 0) return candidate;

  // Try suffixes -2, -3, ...
  for (let i = 2; i < 100; i++) {
    const suffixed = `${candidate}-${i}`;
    const check = await (db as any)
      .select({ id: idColumn })
      .from(table)
      .where(eq(idColumn, suffixed))
      .limit(1);
    if (check.length === 0) return suffixed;
  }

  throw new Error(`Could not generate unique ID for base "${base}"`);
}
