import { Request, Response } from 'express';
import { processUpload } from '../services/uploadService';
import { profileTable, generateReport, generatePdf } from '../services/aiService';
import { logger } from '../utils/logger';

/**
 * POST /upload
 * Accept CSV, store in PostgreSQL, return table_id, row_count, column_count.
 */
export async function uploadCsv(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file || !req.file.buffer) {
      res.status(400).json({ error: 'No CSV file provided' });
      return;
    }

    const result = await processUpload(req.file.buffer);
    res.status(201).json(result);
  } catch (err) {
    logger.error('Upload failed', { error: (err as Error).message });
    res.status(500).json({
      error: 'Upload failed',
      message: (err as Error).message,
    });
  }
}

/**
 * GET /profile/:tableId
 * Return profiling JSON only (no LLM).
 */
export async function getProfile(req: Request, res: Response): Promise<void> {
  const { tableId } = req.params;
  if (!tableId) {
    res.status(400).json({ error: 'tableId required' });
    return;
  }
  try {
    const profiling = await profileTable(tableId);
    res.json(profiling);
  } catch (err) {
    logger.error('Profiling failed', { tableId, error: (err as Error).message });
    res.status(500).json({
      error: 'Profiling failed',
      message: (err as Error).message,
    });
  }
}

/**
 * POST /analyze/:tableId
 * Run full pipeline: profile -> LLM -> report.
 */
export async function analyzeTable(req: Request, res: Response): Promise<void> {
  const { tableId } = req.params;
  if (!tableId) {
    res.status(400).json({ error: 'tableId required' });
    return;
  }

  try {
    const report = await generateReport(tableId, {} as never);
    res.json(report);
  } catch (err) {
    logger.error('Analysis failed', { tableId, error: (err as Error).message });
    res.status(500).json({
      error: 'Analysis failed',
      message: (err as Error).message,
    });
  }
}

/**
 * GET /report/:tableId/pdf
 * Generate and download PDF report.
 */
export async function downloadPdf(req: Request, res: Response): Promise<void> {
  const { tableId } = req.params;
  if (!tableId) {
    res.status(400).json({ error: 'tableId required' });
    return;
  }

  try {
    const pdf = await generatePdf(tableId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="dq_report_${tableId}.pdf"`);
    res.send(pdf);
  } catch (err) {
    logger.error('PDF generation failed', { tableId, error: (err as Error).message });
    res.status(500).json({
      error: 'PDF generation failed',
      message: (err as Error).message,
    });
  }
}
