import axios, { AxiosInstance } from "axios";
import { config } from "../config";
import { logger } from "../utils/logger";

export interface ProfilingRequest {
  table_id: string;
}

export interface ProfilingResponse {
  dataset_summary: {
    row_count: number;
    column_count: number;
    table_id: string;
  };
  columns: Array<{
    name: string;
    type: string;
    null_percent: number;
    unique_count: number;
    duplicate_count?: number;
    min?: number;
    max?: number;
    mean?: number;
    median?: number;
    outlier_count?: number;
    top_values?: Array<{ value: string; count: number }>;
    format_valid_count?: number;
    format_invalid_count?: number;
  }>;
}

export interface QualityReportRequest {
  table_id: string;
  profiling: ProfilingResponse;
}

export interface QualityIssue {
  category: string;
  column: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  business_impact: string;
  recommendation: string;
  recommended_sql_check: string;
}

export interface QualityReportResponse {
  executive_summary: string;
  dataset_overview: Record<string, unknown>;
  detailed_findings: QualityIssue[];
  risk_score: number;
  remediation_plan: Array<{
    priority: string;
    action: string;
    sql?: string;
  }>;
}

let client: AxiosInstance | null = null;

function getClient(): AxiosInstance {
  if (!client) {
    client = axios.create({
      baseURL: config.aiService.url,
      timeout: config.aiService.timeout,
      headers: { "Content-Type": "application/json" },
    });
  }
  return client;
}

/**
 * Call Python profiling service.
 */
export async function profileTable(
  tableId: string,
): Promise<ProfilingResponse> {
  const response = await getClient().post<ProfilingResponse>("/profile", {
    table_id: tableId,
  });
  return response.data;
}

/**
 * Call Python service to generate full quality report (profiling + LLM).
 */
export async function generateReport(
  tableId: string,
  _profiling?: ProfilingResponse,
): Promise<QualityReportResponse> {
  const response = await getClient().post<QualityReportResponse>("/report", {
    table_id: tableId,
  });
  return response.data;
}

/**
 * Generate PDF report (optional).
 */
export async function generatePdf(tableId: string): Promise<Buffer> {
  const response = await getClient().get(`/report/${tableId}/pdf`, {
    responseType: "arraybuffer",
  });
  return Buffer.from(response.data);
}
