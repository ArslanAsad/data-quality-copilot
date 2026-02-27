"""
Data profiling engine.
Computes column-level statistics: types, nulls, uniques, outliers, top values, format validation.
"""
import re
from typing import Any
import pandas as pd
import numpy as np
from app.config import get_table_name

# Format validation patterns
EMAIL_PATTERN = re.compile(
    r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
)
PHONE_PATTERN = re.compile(
    r"^[\d\s\-\.\(\)\+]{10,20}$"
)
DATE_STRING_PATTERN = re.compile(
    r"^\d{4}-\d{2}-\d{2}(T|\s)?|^\d{2}/\d{2}/\d{4}"
)


def _infer_type(series: pd.Series) -> str:
    """Infer semantic type from pandas dtype and sample."""
    if series.dtype in ("int64", "int32"):
        return "integer"
    if series.dtype in ("float64", "float32"):
        return "float"
    if pd.api.types.is_datetime64_any_dtype(series):
        return "datetime"
    if series.dtype == "bool":
        return "boolean"
    # String columns - try to detect
    sample = series.dropna().astype(str).head(100)
    if len(sample) == 0:
        return "string"
    if sample.str.match(EMAIL_PATTERN).all():
        return "email"
    if sample.str.match(PHONE_PATTERN).all() and sample.str.len().between(10, 20).all():
        return "phone"
    if sample.str.match(DATE_STRING_PATTERN).any():
        return "date_string"
    return "string"


def _compute_iqr_outliers(series: pd.Series) -> int:
    """Count IQR-based outliers for numeric series."""
    q1 = series.quantile(0.25)
    q3 = series.quantile(0.75)
    iqr = q3 - q1
    if iqr == 0:
        return 0
    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr
    return int(((series < lower) | (series > upper)).sum())


def _format_validation(series: pd.Series, col_type: str) -> tuple[int, int]:
    """Return (valid_count, invalid_count) for format checks."""
    non_null = series.dropna().astype(str).str.strip()
    non_null = non_null[non_null != ""]
    if len(non_null) == 0:
        return 0, 0
    if col_type == "email":
        valid = non_null.str.match(EMAIL_PATTERN).sum()
    elif col_type == "phone":
        valid = non_null.str.match(PHONE_PATTERN).sum()
    else:
        return len(non_null), 0
    return int(valid), int(len(non_null) - valid)


def profile_table(table_id: str, rows: list[dict]) -> dict:
    """
    Profile a dataset. Returns structured JSON suitable for LLM and rule-based checks.
    """
    df = pd.DataFrame(rows)
    n_rows = len(df)
    n_cols = len(df.columns)

    columns_out = []
    for col in df.columns:
        s = df[col]
        null_count = s.isna().sum()
        null_pct = round(100 * null_count / n_rows, 2) if n_rows else 0
        unique_count = int(s.nunique())
        duplicate_count = int(n_rows - unique_count) if n_rows else 0

        col_type = _infer_type(s)
        col_stats: dict[str, Any] = {
            "name": col,
            "type": col_type,
            "null_percent": null_pct,
            "unique_count": unique_count,
            "duplicate_count": max(0, duplicate_count),
        }

        # Numeric stats
        if s.dtype in ("int64", "int32", "float64", "float32"):
            numeric = pd.to_numeric(s, errors="coerce").dropna()
            if len(numeric) > 0:
                col_stats["min"] = float(numeric.min())
                col_stats["max"] = float(numeric.max())
                col_stats["mean"] = round(float(numeric.mean()), 2)
                col_stats["median"] = round(float(numeric.median()), 2)
                col_stats["outlier_count"] = _compute_iqr_outliers(numeric)

        # Top 5 frequent values
        top = s.value_counts().head(5)
        col_stats["top_values"] = [
            {"value": str(v), "count": int(c)} for v, c in top.items()
        ]

        # Format validation
        if col_type in ("email", "phone"):
            valid, invalid = _format_validation(s, col_type)
            col_stats["format_valid_count"] = valid
            col_stats["format_invalid_count"] = invalid

        columns_out.append(col_stats)

    return {
        "dataset_summary": {
            "row_count": n_rows,
            "column_count": n_cols,
            "table_id": table_id,
        },
        "columns": columns_out,
    }
