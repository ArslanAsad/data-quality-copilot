import { query } from './connection';
import { logger } from '../utils/logger';

/**
 * Initialize database schema for metadata tracking.
 * Stores table registrations and job metadata.
 */
export async function initSchema(): Promise<void> {
  const createMetadataTable = `
    CREATE TABLE IF NOT EXISTS _dqc_metadata (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      table_id VARCHAR(255) UNIQUE NOT NULL,
      table_name VARCHAR(255) NOT NULL,
      row_count INTEGER NOT NULL,
      column_count INTEGER NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  const createJobTable = `
    CREATE TABLE IF NOT EXISTS _dqc_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      table_id VARCHAR(255) NOT NULL REFERENCES _dqc_metadata(table_id),
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      report_json JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );
  `;

  try {
    await query(createMetadataTable);
    await query(createJobTable);
    logger.info('Database schema initialized');
  } catch (err) {
    logger.error('Failed to initialize schema', { error: (err as Error).message });
    throw err;
  }
}
