import { Pool, PoolClient } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

let pool: Pool | null = null;

/**
 * Get or create the PostgreSQL connection pool.
 */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.database.url,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
      logger.error('Unexpected database pool error', { error: err.message });
    });
  }
  return pool;
}

/**
 * Execute a query with automatic connection handling.
 */
export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const client = await getPool().connect();
  try {
    const result = await client.query(text, params);
    return (result.rows as T[]) || [];
  } finally {
    client.release();
  }
}

/**
 * Execute multiple queries in a transaction.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
