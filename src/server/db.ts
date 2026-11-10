import "server-only";
import postgres from "postgres";

declare global {
  var __sql: postgres.Sql | undefined;
}

/** Lazily-created shared connection pool (reused across hot reloads in dev). */
export function db(): postgres.Sql {
  if (globalThis.__sql) return globalThis.__sql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  globalThis.__sql = postgres(url, {
    max: process.env.NODE_ENV === "production" ? 5 : 10,
    idle_timeout: 20,
    // Neon/Vercel poolers (pgbouncer transaction mode) don't support prepared statements.
    prepare: false,
    onnotice: () => {},
  });
  return globalThis.__sql;
}

export type Tx = postgres.TransactionSql;
