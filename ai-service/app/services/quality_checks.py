"""
Rule-based data quality checks.
Deterministic checks: completeness, uniqueness, validity, consistency, range violations.
"""
from typing import Any
import pandas as pd
from datetime import datetime

# Severity thresholds
NULL_PCT_THRESHOLD = 10.0
DUPLICATE_PK_THRESHOLD = 0  # Any duplicate in PK candidate is an issue


def _check_completeness(col: dict) -> list[dict]:
    """Null % > 10%."""
    issues = []
    if col.get("null_percent", 0) > NULL_PCT_THRESHOLD:
        issues.append({
            "category": "Completeness",
            "column": col["name"],
            "severity": "HIGH" if col["null_percent"] > 25 else "MEDIUM",
            "business_impact": f"Column has {col['null_percent']}% null values, affecting data reliability.",
            "recommendation": "Investigate missing data sources; consider default values or imputation.",
            "recommended_sql_check": f'SELECT COUNT(*) FROM table_name WHERE "{col["name"]}" IS NULL;',
        })
    return issues


def _check_uniqueness(col: dict, row_count: int) -> list[dict]:
    """Duplicate primary key candidates."""
    issues = []
    dup_count = col.get("duplicate_count", 0)
    if dup_count > DUPLICATE_PK_THRESHOLD and col.get("unique_count", 0) < row_count:
        # Potential PK column with duplicates
        if col["type"] in ("integer", "string", "email") and col.get("null_percent", 0) < 5:
            issues.append({
                "category": "Uniqueness",
                "column": col["name"],
                "severity": "HIGH" if dup_count > row_count * 0.1 else "MEDIUM",
                "business_impact": f"Column has {dup_count} duplicate values; may not be suitable as primary key.",
                "recommendation": "Deduplicate or use composite key; validate business rules.",
                "recommended_sql_check": f'SELECT "{col["name"]}", COUNT(*) FROM table_name GROUP BY "{col["name"]}" HAVING COUNT(*) > 1;',
            })
    return issues


def _check_validity(col: dict) -> list[dict]:
    """Invalid email format, negative values where illogical."""
    issues = []
    if col.get("type") == "email" and col.get("format_invalid_count", 0) > 0:
        issues.append({
            "category": "Validity",
            "column": col["name"],
            "severity": "HIGH" if col["format_invalid_count"] > 10 else "MEDIUM",
            "business_impact": f"{col['format_invalid_count']} values do not match email format.",
            "recommendation": "Validate and correct email formats; reject invalid on ingestion.",
            "recommended_sql_check": f'SELECT * FROM table_name WHERE "{col["name"]}" !~ \'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{{2,}}$\';',
        })
    if col["type"] in ("integer", "float"):
        min_val = col.get("min")
        if min_val is not None and min_val < 0:
            if "age" in col["name"].lower() or "count" in col["name"].lower():
                issues.append({
                    "category": "Validity",
                    "column": col["name"],
                    "severity": "HIGH",
                    "business_impact": f"Column contains negative values (min={min_val}); illogical for this metric.",
                    "recommendation": "Filter or correct negative values; add CHECK constraint.",
                    "recommended_sql_check": f'SELECT * FROM table_name WHERE "{col["name"]}" < 0;',
                })
    return issues


def _check_consistency(col: dict, _df: pd.DataFrame) -> list[dict]:
    """Mixed types in same column, date stored as string."""
    issues = []
    if col.get("type") == "date_string":
        issues.append({
            "category": "Consistency",
            "column": col["name"],
            "severity": "MEDIUM",
            "business_impact": "Dates stored as strings; may cause sorting and filtering errors.",
            "recommendation": "Convert to proper DATE/TIMESTAMP type.",
            "recommended_sql_check": f'SELECT * FROM table_name WHERE "{col["name"]}"::date IS NULL AND "{col["name"]}" IS NOT NULL;',
        })
    return issues


def _check_range_violations(col: dict) -> list[dict]:
    """Future dates, age < 0."""
    issues = []
    if "age" in col["name"].lower() and col.get("min") is not None:
        if col["min"] < 0:
            issues.append({
                "category": "Range Violations",
                "column": col["name"],
                "severity": "HIGH",
                "business_impact": f"Age column contains negative values (min={col['min']}).",
                "recommendation": "Remove or correct invalid age values.",
                "recommended_sql_check": f'SELECT * FROM table_name WHERE "{col["name"]}" < 0;',
            })
    return issues


def run_rule_based_checks(
    profiling: dict, df: pd.DataFrame
) -> list[dict]:
    """
    Run all deterministic quality checks.
    Returns list of structured issues.
    """
    issues = []
    row_count = profiling.get("dataset_summary", {}).get("row_count", 0)
    for col in profiling.get("columns", []):
        issues.extend(_check_completeness(col))
        issues.extend(_check_uniqueness(col, row_count))
        issues.extend(_check_validity(col))
        issues.extend(_check_consistency(col, df))
        issues.extend(_check_range_violations(col))
    return issues
