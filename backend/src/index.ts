import app from './app';
import { config } from './config';
import { initSchema } from './db/schema';
import { getPool } from './db/connection';
import { logger } from './utils/logger';

async function waitForDb(maxAttempts = 30): Promise<void> {
  const pool = getPool();
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch {
      logger.warn(`Waiting for database... (${i + 1}/${maxAttempts})`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('Database unavailable');
}

async function main(): Promise<void> {
  await waitForDb();
  await initSchema();
  app.listen(config.port, () => {
    logger.info(`API Gateway listening on port ${config.port}`);
  });
}

main().catch((err) => {
  logger.error('Failed to start', { error: err.message });
  process.exit(1);
});
