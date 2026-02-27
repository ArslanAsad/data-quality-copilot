# LLM Prompt Template for Data Quality Analysis

The AI Data Quality Copilot uses Google Gemini with **strict JSON output mode**. The prompt instructs the model to analyze profiling results and rule-based issues, then return structured JSON only.

## Input Structure

1. **Profiling JSON** – Column-level statistics (type, null %, unique count, min/max, outliers, top values, format validation)
2. **Rule-Based Issues** – Pre-computed deterministic issues (completeness, uniqueness, validity, consistency, range violations)

## Output Schema

```json
{
  "issues": [
    {
      "category": "Completeness|Uniqueness|Validity|Consistency|Range Violations",
      "column": "string",
      "severity": "LOW|MEDIUM|HIGH",
      "business_impact": "string",
      "recommendation": "string",
      "recommended_sql_check": "SELECT ... FROM table_name WHERE ..."
    }
  ],
  "overall_risk_score": 0-100
}
```

## Key Instructions to LLM

1. **Severity classification** – Assign LOW, MEDIUM, or HIGH based on business impact
2. **Business impact** – 1–2 sentences on how the issue affects operations
3. **Recommendation** – Concrete remediation step
4. **SQL check** – Valid `SELECT` query to identify problematic rows; use `table_name` as placeholder
5. **Risk score** – Weighted aggregation (see README) capped at 100
6. **Additional findings** – LLM may add issues not in the rule-based list

## Example Request (to LLM)

```
You are an enterprise data quality analyst. Analyze the following...

## Profiling Summary
{
  "dataset_summary": {"row_count": 15, "column_count": 5, "table_id": "tbl_abc"},
  "columns": [
    {"name": "email", "type": "email", "null_percent": 13.3, "format_invalid_count": 4, ...},
    {"name": "age", "type": "integer", "min": -5, "max": 52, "null_percent": 0, ...}
  ]
}

## Rule-Based Issues
[
  {"category": "Validity", "column": "age", "severity": "HIGH", ...},
  {"category": "Completeness", "column": "email", "severity": "MEDIUM", ...}
]

## Your Task
... (see llm_service.py for full template)
```

## Example Response (from LLM)

```json
{
  "issues": [
    {
      "category": "Validity",
      "column": "age",
      "severity": "HIGH",
      "business_impact": "Negative age values invalidate demographic analytics and reporting.",
      "recommendation": "Add CHECK constraint: age >= 0; correct or remove invalid rows.",
      "recommended_sql_check": "SELECT * FROM table_name WHERE \"age\" < 0;"
    },
    {
      "category": "Validity",
      "column": "email",
      "severity": "HIGH",
      "business_impact": "Invalid email formats prevent reliable communication and matching.",
      "recommendation": "Validate emails on ingestion; use regex or library validation.",
      "recommended_sql_check": "SELECT * FROM table_name WHERE \"email\" !~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$';"
    }
  ],
  "overall_risk_score": 72
}
```

## Configuration

- `GEMINI_API_KEY` – Required for LLM calls (get from [Google AI Studio](https://aistudio.google.com/apikey))
- `GEMINI_MODEL` – Model name (default: gemini-1.5-flash)

If the API key is missing, the system falls back to rule-based issues only with a computed risk score.
