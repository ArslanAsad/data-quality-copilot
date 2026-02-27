import { http, httpBlob } from "./http";

export interface UploadResult {
  tableId: string;
  rowCount: number;
  columnCount: number;
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

export async function health(): Promise<{ status: string; service?: string }> {
  return await http<{ status: string; service?: string }>("/health");
}

export async function uploadCsv(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch("/api/upload", {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    const message =
      typeof body === "object" && body && "error" in body && typeof (body as any).error === "string"
        ? (body as any).error
        : `Upload failed (${response.status})`;
    throw new Error(message);
  }

  return (await response.json()) as UploadResult;
}

export async function getProfile(tableId: string): Promise<ProfilingResponse> {
  return await http<ProfilingResponse>(`/api/profile/${encodeURIComponent(tableId)}`);
}

export async function analyzeTable(tableId: string): Promise<QualityReportResponse> {
  return await http<QualityReportResponse>(`/api/analyze/${encodeURIComponent(tableId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

export async function downloadReportPdf(tableId: string): Promise<Blob> {
  return await httpBlob(`/api/report/${encodeURIComponent(tableId)}/pdf`);
}

