import { Readable } from 'stream';
import { withTransaction } from '../db/connection';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const CSV = require('csv-parser');

export interface ColumnSchema {
  name: string;
  type: string;
  maxLength?: number;
}

export interface UploadResult {
  tableId: string;
  rowCount: number;
  columnCount: number;
}

/**
 * Infer PostgreSQL type from sample values.
 */
function inferPgType(values: string[]): { type: string; maxLength?: number } {
  const nonNull = values.filter((v) => v !== '' && v !== null && v !== undefined);
  if (nonNull.length === 0) return { type: 'TEXT' };

  const sample = nonNull.slice(0, 100);
  let allNumeric = true;
  let allInteger = true;
  let allDate = true;
  let maxLen = 0;

  const datePattern = /^\d{4}-\d{2}-\d{2}(T|\s)?/;
  const numericPattern = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;

  for (const v of sample) {
    const s = String(v).trim();
    maxLen = Math.max(maxLen, s.length);

    if (numericPattern.test(s)) {
      if (!Number.isInteger(parseFloat(s))) allInteger = false;
    } else {
      allNumeric = false;
      allInteger = false;
    }

    if (!datePattern.test(s) && s !== '') allDate = false;
  }

  if (allDate && sample.some((s) => s.length >= 10)) return { type: 'TIMESTAMPTZ' };
  if (allInteger && allNumeric) return { type: 'BIGINT' };
  if (allNumeric) return { type: 'DOUBLE PRECISION' };
  if (maxLen > 255) return { type: 'TEXT' };
  return { type: 'VARCHAR(255)', maxLength: Math.min(maxLen + 50, 255) };
}

/**
 * Sanitize column name for SQL.
 */
function sanitizeColumnName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_') || 'column_' + Math.random().toString(36).slice(2, 8);
}

/**
 * Parse CSV buffer and return rows + headers.
 */
async function parseCsv(buffer: Buffer): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  return new Promise((resolve, reject) => {
    const headers: string[] = [];
    const rows: Record<string, string>[] = [];
    const stream = Readable.from(buffer);

    stream
      .pipe(CSV())
      .on('data', (row: Record<string, string>) => {
        if (headers.length === 0) headers.push(...Object.keys(row));
        rows.push(row);
      })
      .on('end', () => resolve({ headers, rows }))
      .on('error', reject);
  });
}

/**
 * Upload CSV, infer schema, create table, insert data.
 */
export async function processUpload(buffer: Buffer): Promise<UploadResult> {
  const tableId = `tbl_${uuidv4().replace(/-/g, '')}`;
  const tableName = `_dqc_${tableId}`;

  const { headers, rows } = await parseCsv(buffer);
  if (headers.length === 0) throw new Error('CSV has no columns');
  if (rows.length === 0) throw new Error('CSV has no data rows');

  const colNames = headers.map((h) => sanitizeColumnName(h));
  const colValues: Record<string, string[]> = {};
  colNames.forEach((c) => (colValues[c] = []));

  for (const row of rows) {
    for (let i = 0; i < headers.length; i++) {
      const key = headers[i];
      const col = colNames[i];
      colValues[col].push(row[key] ?? '');
    }
  }

  const schema: ColumnSchema[] = colNames.map((name, i) => {
    const values = colValues[name];
    const { type, maxLength } = inferPgType(values);
    return { name, type, maxLength };
  });

  await withTransaction(async (client) => {
    const colDefs = schema
      .map((c) => `"${c.name}" ${c.type}`)
      .join(', ');
    const createSql = `CREATE TABLE "${tableName}" (${colDefs})`;
    await client.query(createSql);

    const placeholders = colNames.map((_, i) => `$${i + 1}`).join(', ');
    const insertSql = `INSERT INTO "${tableName}" (${colNames.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders})`;

    for (const row of rows) {
      const values = colNames.map((c, i) => {
        const raw = row[headers[i]] ?? '';
        if (raw === '') return null;
        const col = schema[i];
        if (col.type === 'BIGINT') return parseInt(raw, 10) || null;
        if (col.type === 'DOUBLE PRECISION') return parseFloat(raw) || null;
        if (col.type === 'TIMESTAMPTZ') return raw;
        return raw;
      });
      await client.query(insertSql, values);
    }

    await client.query(
      `INSERT INTO _dqc_metadata (table_id, table_name, row_count, column_count) VALUES ($1, $2, $3, $4)`,
      [tableId, tableName, rows.length, colNames.length]
    );
  });

  logger.info('Upload processed', { tableId, rowCount: rows.length, columnCount: colNames.length });

  return {
    tableId,
    rowCount: rows.length,
    columnCount: colNames.length,
  };
}
