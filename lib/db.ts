import mysql, { type Pool, type RowDataPacket, type ResultSetHeader } from "mysql2/promise";
import { env } from "./env";

/**
 * A single shared connection pool. In dev, Next.js clears the module cache on
 * each reload, so we stash the pool on `globalThis` to avoid exhausting MySQL
 * connections. The worker process gets its own pool (separate process).
 */
const globalForDb = globalThis as unknown as { __payrollPool?: Pool };

export function getPool(): Pool {
  if (!globalForDb.__payrollPool) {
    globalForDb.__payrollPool = mysql.createPool({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.database,
      waitForConnections: true,
      connectionLimit: 10,
      maxIdle: 10,
      idleTimeout: 60_000,
      enableKeepAlive: true,
      // Decimals come back as JS numbers rather than strings.
      decimalNumbers: true,
      dateStrings: true,
      namedPlaceholders: true,
    });
  }
  return globalForDb.__payrollPool;
}

/** Run a SELECT and get typed rows back. */
type Params = Record<string, unknown> | unknown[];

export async function query<T extends RowDataPacket>(
  sql: string,
  params?: Params
): Promise<T[]> {
  // mysql2's overloads don't model named-placeholder objects; the runtime
  // handles them fine when `namedPlaceholders` is enabled on the pool.
  const [rows] = await getPool().query<T[]>(sql, params as never);
  return rows;
}

/** Run an INSERT/UPDATE/DELETE and get the result header. */
export async function execute(
  sql: string,
  params?: Params
): Promise<ResultSetHeader> {
  const [result] = await getPool().execute<ResultSetHeader>(sql, params as never);
  return result;
}

export type { RowDataPacket, ResultSetHeader };
