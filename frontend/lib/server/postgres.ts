import { Pool } from "pg";
import type { QueryResult, QueryResultRow } from "pg";

type GlobalWithPostgresPool = typeof globalThis & {
  __vdPostgresPool?: Pool;
};

const globalPostgres = globalThis as GlobalWithPostgresPool;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function shouldResetPool(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = (error as Error & { code?: unknown }).code;
  if (typeof code === "string") {
    return ["XX000", "57P01", "57P02", "57P03", "08000", "08006"].includes(
      code,
    );
  }

  return /terminat|closed|reset|DbHandler exited/i.test(error.message);
}

function resetPool(pool: Pool): void {
  if (globalPostgres.__vdPostgresPool === pool) {
    globalPostgres.__vdPostgresPool = undefined;
  }

  void pool.end().catch(() => {
    // Ignore close errors; a fresh pool is created lazily on next query.
  });
}

export function getPostgresPool(): Pool {
  if (globalPostgres.__vdPostgresPool) {
    return globalPostgres.__vdPostgresPool;
  }

  const databaseUrl = requiredEnv("DATABASE_URL");
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("localhost")
      ? undefined
      : { rejectUnauthorized: false },
  });

  pool.on("error", (error) => {
    if (shouldResetPool(error)) {
      resetPool(pool);
    }
  });

  globalPostgres.__vdPostgresPool = pool;
  return pool;
}

export async function queryWithRetry<Row extends QueryResultRow>(
  text: string,
  values?: unknown[],
): Promise<QueryResult<Row>> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const pool = getPostgresPool();

    try {
      return await pool.query<Row>(text, values);
    } catch (error) {
      if (!shouldResetPool(error) || attempt === 1) {
        throw error;
      }

      resetPool(pool);
    }
  }

  throw new Error("Unreachable retry path");
}
