import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  RefreshCw,
  Upload,
  Brain,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import type {
  ProfilingResponse,
  QualityIssue,
  QualityReportResponse,
  UploadResult,
} from "./lib/api";
import {
  analyzeTable,
  downloadReportPdf,
  getProfile,
  health,
  uploadCsv,
} from "./lib/api";
import { HttpError } from "./lib/http";

function App() {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [backendStatus, setBackendStatus] = useState<
    "checking" | "up" | "down"
  >("checking");

  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<
    null | "upload" | "profile" | "analyze" | "pdf"
  >(null);
  const [error, setError] = useState<string | null>(null);

  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [profile, setProfile] = useState<ProfilingResponse | null>(null);
  const [report, setReport] = useState<QualityReportResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await health();
        if (!cancelled) setBackendStatus("up");
      } catch {
        if (!cancelled) setBackendStatus("down");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tableId = uploadResult?.tableId ?? null;

  const datasetSummary = useMemo(() => {
    if (profile) return profile.dataset_summary;
    return null;
  }, [profile]);

  const issuesBySeverity = useMemo(() => {
    const base = { HIGH: 0, MEDIUM: 0, LOW: 0 } as const;
    if (!report) return base;
    const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const issue of report.detailed_findings ?? [])
      counts[issue.severity] += 1;
    return counts;
  }, [report]);

  function resetAll(): void {
    setError(null);
    setBusy(null);
    setUploadResult(null);
    setProfile(null);
    setReport(null);
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onUpload(): Promise<void> {
    if (!file) return;
    setBusy("upload");
    setError(null);
    try {
      const res = await uploadCsv(file);
      setUploadResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  async function onLoadProfile(): Promise<void> {
    if (!tableId) return;
    setBusy("profile");
    setError(null);
    try {
      const p = await getProfile(tableId);
      setProfile(p);
    } catch (e) {
      setError(
        e instanceof HttpError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Profiling failed",
      );
    } finally {
      setBusy(null);
    }
  }

  async function onAnalyze(): Promise<void> {
    if (!tableId) return;
    setBusy("analyze");
    setError(null);
    try {
      const r = await analyzeTable(tableId);
      setReport(r);
    } catch (e) {
      setError(
        e instanceof HttpError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Analysis failed",
      );
    } finally {
      setBusy(null);
    }
  }

  async function onDownloadPdf(): Promise<void> {
    if (!tableId) return;
    setBusy("pdf");
    setError(null);
    try {
      const blob = await downloadReportPdf(tableId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dq_report_${tableId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(
        e instanceof HttpError
          ? e.message
          : e instanceof Error
            ? e.message
            : "PDF download failed",
      );
    } finally {
      setBusy(null);
    }
  }

  function formatPct(value?: number): string {
    if (value === undefined || Number.isNaN(value)) return "—";
    if (!Number.isFinite(value)) return "—";
    return `${value.toFixed(1)}%`;
  }

  const getRiskColor = (score?: number) => {
    if (!score) return "border-slate-600 text-slate-400";
    if (score >= 80) return "border-red-500 text-red-300";
    if (score >= 45) return "border-amber-500 text-amber-300";
    return "border-green-500 text-green-300";
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "HIGH":
        return "bg-red-500/20 text-red-200 border-red-500/30";
      case "MEDIUM":
        return "bg-amber-500/20 text-amber-200 border-amber-500/30";
      case "LOW":
        return "bg-green-500/20 text-green-200 border-green-500/30";
      default:
        return "bg-slate-500/20 text-slate-200 border-slate-500/30";
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 pt-8 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-white">
                Data Quality Copilot
              </h1>
              <Badge
                variant="outline"
                className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
              >
                Preview
              </Badge>
            </div>
            <p className="text-slate-400 text-sm max-w-2xl">
              Upload a CSV, profile the dataset, generate an AI quality report,
              and export a PDF.
            </p>
          </div>

          {/* Backend Status */}
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <div
              className={`w-2 h-2 rounded-full ${backendStatus === "up" ? "bg-green-500" : "bg-slate-600"}`}
            />
            <span>
              Backend:{" "}
              <span className="text-slate-200 font-medium">
                {backendStatus === "checking"
                  ? "checking…"
                  : backendStatus === "up"
                    ? "connected"
                    : "offline"}
              </span>
            </span>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Left Column - Upload & Actions */}
          <div className="lg:col-span-3 space-y-6">
            {/* Upload Section */}
            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Upload</h2>
                  <p className="text-sm text-slate-400">
                    POST `/api/upload` → returns `tableId`
                  </p>
                </div>
                <Badge variant="secondary">Step 1</Badge>
              </div>

              <div className="p-6 space-y-6">
                {/* Dropzone */}
                <div className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center hover:border-slate-600 transition-colors">
                  <div className="space-y-2 mb-4">
                    <p className="text-white font-medium">
                      Choose a CSV file to ingest
                    </p>
                    <p className="text-sm text-slate-400">
                      File is streamed to the backend and stored in PostgreSQL
                      as an internal table.
                    </p>
                  </div>

                  <input
                    ref={inputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                    id="file-input"
                  />

                  <label
                    htmlFor="file-input"
                    className="inline-block cursor-pointer text-sm text-slate-400 hover:text-slate-300 transition-colors"
                  >
                    {file ? file.name : "Click to select or drag and drop"}
                  </label>
                </div>

                {/* Upload Buttons */}
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={onUpload}
                    disabled={!file || busy !== null}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {busy === "upload" ? "Uploading…" : "Upload CSV"}
                  </Button>
                  <Button
                    onClick={resetAll}
                    disabled={busy !== null}
                    variant="outline"
                    size="sm"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reset
                  </Button>
                </div>

                {/* Upload Result Metrics */}
                {uploadResult && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        {
                          label: "Table ID",
                          value:
                            uploadResult.tableId.length > 20
                              ? `${uploadResult.tableId.slice(0, 5)}...${uploadResult.tableId.slice(-5)}`
                              : uploadResult.tableId,
                          caption: "Use for profiling",
                        },
                        {
                          label: "Rows",
                          value: uploadResult.rowCount.toLocaleString(),
                          caption: "Records",
                        },
                        {
                          label: "Columns",
                          value: uploadResult.columnCount.toLocaleString(),
                          caption: "Fields",
                        },
                      ].map((metric) => (
                        <div
                          key={metric.label}
                          className="border border-slate-700 rounded-lg p-4 bg-slate-800/30"
                        >
                          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                            {metric.label}
                          </div>
                          <div className="text-2xl font-bold text-white mb-1">
                            {metric.value}
                          </div>
                          <div className="text-xs text-slate-500">
                            {metric.caption}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3 pt-2">
                      <Button
                        onClick={onLoadProfile}
                        disabled={busy !== null}
                        variant="outline"
                        size="sm"
                      >
                        <TrendingUp className="w-4 h-4 mr-2" />
                        {busy === "profile" ? "Profiling…" : "Load profiling"}
                      </Button>
                      <Button
                        onClick={onAnalyze}
                        disabled={busy !== null}
                        variant="outline"
                        size="sm"
                      >
                        <Brain className="w-4 h-4 mr-2" />
                        {busy === "analyze"
                          ? "Analyzing…"
                          : "Generate AI report"}
                      </Button>
                      <Button
                        onClick={onDownloadPdf}
                        disabled={busy !== null}
                        variant="outline"
                        size="sm"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        {busy === "pdf" ? "Preparing…" : "Download PDF"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Errors */}
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Something went wrong</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {!error && backendStatus === "down" && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Backend offline</AlertTitle>
                    <AlertDescription>
                      Start the backend on port 5000, then refresh.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </Card>

            {/* Column Profile */}
            {profile && (
              <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
                <div className="p-6 border-b border-slate-800">
                  <h2 className="text-lg font-semibold text-white mb-1">
                    Column Profile
                  </h2>
                  <p className="text-sm text-slate-400">
                    Quick scan of nulls, uniqueness, ranges, and common values
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 bg-slate-800/50">
                        <th className="text-left px-6 py-3 font-medium text-slate-300">
                          Column
                        </th>
                        <th className="text-left px-6 py-3 font-medium text-slate-300">
                          Type
                        </th>
                        <th className="text-left px-6 py-3 font-medium text-slate-300">
                          Null %
                        </th>
                        <th className="text-left px-6 py-3 font-medium text-slate-300">
                          Unique
                        </th>
                        <th className="text-left px-6 py-3 font-medium text-slate-300">
                          Outliers
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.columns.map((col, idx) => (
                        <tr
                          key={col.name}
                          className={idx % 2 ? "bg-slate-800/20" : ""}
                        >
                          <td className="px-6 py-3 text-white font-medium">
                            {col.name}
                          </td>
                          <td className="px-6 py-3 text-slate-400">
                            {col.type}
                          </td>
                          <td className="px-6 py-3 text-slate-300">
                            {formatPct(col.null_percent)}
                          </td>
                          <td className="px-6 py-3 text-slate-300">
                            {col.unique_count.toLocaleString()}
                          </td>
                          <td className="px-6 py-3">
                            {col.outlier_count ? (
                              <Badge variant="secondary">
                                {col.outlier_count}
                              </Badge>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>

          {/* Right Column - Insights */}
          <div className="lg:col-span-2">
            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur sticky top-8 h-fit">
              <div className="p-6 border-b border-slate-800">
                <h2 className="text-lg font-semibold text-white">Insights</h2>
                <p className="text-sm text-slate-400">
                  Profiling & AI report output
                </p>
                <Badge variant="secondary" className="mt-2">
                  Step 2
                </Badge>
              </div>

              <div className="p-6 space-y-6">
                {!uploadResult ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Start with an upload</AlertTitle>
                    <AlertDescription>
                      Once you have a `tableId`, you can profile and analyze it
                      here.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    {/* Data Chips */}
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="text-slate-300">
                        {uploadResult.tableId}
                      </Badge>
                      {datasetSummary && (
                        <>
                          <Badge variant="outline" className="text-slate-300">
                            {datasetSummary.row_count.toLocaleString()} rows
                          </Badge>
                          <Badge variant="outline" className="text-slate-300">
                            {datasetSummary.column_count} cols
                          </Badge>
                        </>
                      )}
                    </div>

                    {report && (
                      <div className="space-y-4">
                        <div className="border-t border-slate-800 pt-4" />

                        {/* Risk Badge */}
                        <div
                          className={`border-2 rounded-lg p-4 ${getRiskColor(report.risk_score)}`}
                        >
                          <div className="text-xs font-semibold uppercase tracking-wide mb-2">
                            Risk Score
                          </div>
                          <div className="text-3xl font-bold">
                            {report.risk_score
                              ? report.risk_score.toFixed(0)
                              : "—"}
                          </div>
                        </div>

                        {/* Risk Meter */}
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-linear-to-r from-green-500 via-amber-500 to-red-500 transition-all"
                            style={{
                              width:
                                report.risk_score !== undefined
                                  ? `${Math.max(0, Math.min(100, report.risk_score))}%`
                                  : "0%",
                            }}
                          />
                        </div>

                        {/* Executive Summary */}
                        <Alert>
                          <Brain className="h-4 w-4" />
                          <AlertTitle>Executive Summary</AlertTitle>
                          <AlertDescription>
                            {report.executive_summary}
                          </AlertDescription>
                        </Alert>

                        {/* Issue Counts */}
                        <div className="flex gap-2">
                          <Badge
                            variant="outline"
                            className="text-red-300 border-red-500/30 bg-red-500/10"
                          >
                            {issuesBySeverity.HIGH} high
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-amber-300 border-amber-500/30 bg-amber-500/10"
                          >
                            {issuesBySeverity.MEDIUM} medium
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-green-300 border-green-500/30 bg-green-500/10"
                          >
                            {issuesBySeverity.LOW} low
                          </Badge>
                        </div>

                        {/* Issues List */}
                        {report.detailed_findings &&
                          report.detailed_findings.length > 0 && (
                            <div className="space-y-3">
                              <h3 className="text-sm font-semibold text-white">
                                Findings ({report.detailed_findings.length})
                              </h3>
                              <div className="space-y-3 max-h-96 overflow-y-auto">
                                {report.detailed_findings
                                  .slice(0, 6)
                                  .map((issue, idx) => (
                                    <div
                                      key={`${issue.column}-${idx}`}
                                      className="border border-slate-700 rounded-lg p-3 space-y-2 bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <h4 className="font-medium text-white text-sm">
                                          {issue.category}
                                        </h4>
                                        <Badge
                                          className={`text-xs border ${getSeverityColor(issue.severity)}`}
                                          variant="outline"
                                        >
                                          {issue.severity}
                                        </Badge>
                                      </div>
                                      <div>
                                        <Badge
                                          variant="secondary"
                                          className="text-xs"
                                        >
                                          {issue.column}
                                        </Badge>
                                      </div>
                                      <p className="text-sm text-slate-300">
                                        {issue.business_impact}
                                      </p>
                                      <p className="text-xs text-slate-400 italic">
                                        {issue.recommendation}
                                      </p>
                                      <button
                                        onClick={() =>
                                          navigator.clipboard.writeText(
                                            issue.recommended_sql_check,
                                          )
                                        }
                                        className="text-xs font-mono text-blue-400 hover:text-blue-300 transition-colors bg-slate-900 px-2 py-1 rounded truncate max-w-full"
                                      >
                                        {issue.recommended_sql_check}
                                      </button>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
