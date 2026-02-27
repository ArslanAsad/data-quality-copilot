"""
Report generation: combines profiling, rule-based checks, LLM analysis.
Produces final structured report and optional PDF.
"""
import json
import logging
from typing import Any
import pandas as pd
from app.db import fetch_table_data
from app.config import get_table_name
from app.services.profiler import profile_table
from app.services.quality_checks import run_rule_based_checks
from app.services.llm_service import analyze_with_llm

logger = logging.getLogger(__name__)


def _compute_risk_score(llm_output: dict, rule_issues: list) -> int:
    """Use LLM risk score if present, else compute from issues."""
    if "overall_risk_score" in llm_output:
        return min(100, max(0, int(llm_output["overall_risk_score"])))
    severity_scores = {"HIGH": 30, "MEDIUM": 15, "LOW": 5}
    total = sum(severity_scores.get(i.get("severity", "LOW"), 5) for i in rule_issues)
    return min(100, total)


def _build_remediation_plan(issues: list[dict]) -> list[dict]:
    """Build prioritized remediation plan from issues."""
    priority_order = {"HIGH": 1, "MEDIUM": 2, "LOW": 3}
    sorted_issues = sorted(
        issues,
        key=lambda x: (priority_order.get(x.get("severity", "LOW"), 3), x.get("column", "")),
    )
    plan = []
    for i, issue in enumerate(sorted_issues[:10], 1):
        plan.append({
            "priority": issue.get("severity", "MEDIUM"),
            "action": issue.get("recommendation", ""),
            "sql": issue.get("recommended_sql_check"),
        })
    return plan


def _build_executive_summary(
    profiling: dict, risk_score: int, issue_count: int
) -> str:
    """Generate executive summary text."""
    summary = profiling.get("dataset_summary", {})
    row_count = summary.get("row_count", 0)
    col_count = summary.get("column_count", 0)
    risk_level = "High" if risk_score >= 70 else "Medium" if risk_score >= 40 else "Low"
    return (
        f"Data Quality Report: Dataset contains {row_count:,} rows and {col_count} columns. "
        f"Overall risk score: {risk_score}/100 ({risk_level}). "
        f"Identified {issue_count} data quality issues requiring attention."
    )


def generate_report(table_id: str) -> dict[str, Any]:
    """
    Full pipeline: fetch data -> profile -> rule checks -> LLM -> final report.
    """
    table_name = get_table_name(table_id)
    rows = fetch_table_data(table_name)
    if not rows:
        raise ValueError(f"No data found for table {table_id}")

    df = pd.DataFrame(rows)
    profiling = profile_table(table_id, rows)
    rule_issues = run_rule_based_checks(profiling, df)
    llm_output = analyze_with_llm(profiling, rule_issues)

    issues = llm_output.get("issues", rule_issues)
    risk_score = _compute_risk_score(llm_output, issues)
    remediation_plan = _build_remediation_plan(issues)
    executive_summary = _build_executive_summary(
        profiling, risk_score, len(issues)
    )

    return {
        "executive_summary": executive_summary,
        "dataset_overview": profiling.get("dataset_summary", {}),
        "detailed_findings": issues,
        "risk_score": risk_score,
        "remediation_plan": remediation_plan,
    }
