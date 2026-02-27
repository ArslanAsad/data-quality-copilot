# API Examples

## 1. Upload CSV

**Request:**
```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@sample_data.csv"
```

**Response (201 Created):**
```json
{
  "tableId": "tbl_a1b2c3d4e5f6789012345678",
  "rowCount": 15,
  "columnCount": 5
}
```

---

## 2. Get Profiling Only (No LLM)

**Request:**
```bash
curl http://localhost:3000/api/profile/tbl_a1b2c3d4e5f6789012345678
```

**Response (200 OK):**
```json
{
  "dataset_summary": {
    "row_count": 15,
    "column_count": 5,
    "table_id": "tbl_a1b2c3d4e5f6789012345678"
  },
  "columns": [
    {
      "name": "id",
      "type": "integer",
      "null_percent": 0,
      "unique_count": 15,
      "duplicate_count": 0,
      "min": 1,
      "max": 15,
      "mean": 8.0,
      "median": 8.0,
      "outlier_count": 0,
      "top_values": [
        {"value": "1", "count": 1},
        {"value": "2", "count": 1}
      ]
    },
    {
      "name": "email",
      "type": "email",
      "null_percent": 13.33,
      "unique_count": 12,
      "format_valid_count": 10,
      "format_invalid_count": 4,
      "top_values": [...]
    },
    {
      "name": "age",
      "type": "integer",
      "null_percent": 0,
      "min": -5,
      "max": 52,
      "mean": 33.2,
      "outlier_count": 1,
      "top_values": [...]
    }
  ]
}
```

---

## 3. Full Analysis (Profile + LLM Report)

**Request:**
```bash
curl -X POST http://localhost:3000/api/analyze/tbl_a1b2c3d4e5f6789012345678
```

**Response (200 OK):**
```json
{
  "executive_summary": "Data Quality Report: Dataset contains 15 rows and 5 columns. Overall risk score: 72/100 (High). Identified 6 data quality issues requiring attention.",
  "dataset_overview": {
    "row_count": 15,
    "column_count": 5,
    "table_id": "tbl_a1b2c3d4e5f6789012345678"
  },
  "detailed_findings": [
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
    },
    {
      "category": "Completeness",
      "column": "email",
      "severity": "MEDIUM",
      "business_impact": "Column has 13.33% null values, affecting data reliability.",
      "recommendation": "Investigate missing data sources; consider default values or imputation.",
      "recommended_sql_check": "SELECT COUNT(*) FROM table_name WHERE \"email\" IS NULL;"
    }
  ],
  "risk_score": 72,
  "remediation_plan": [
    {
      "priority": "HIGH",
      "action": "Add CHECK constraint: age >= 0; correct or remove invalid rows.",
      "sql": "SELECT * FROM table_name WHERE \"age\" < 0;"
    },
    {
      "priority": "HIGH",
      "action": "Validate emails on ingestion; use regex or library validation.",
      "sql": "SELECT * FROM table_name WHERE \"email\" !~ '^...';"
    }
  ]
}
```

---

## 4. Download PDF Report

**Request:**
```bash
curl -o report.pdf http://localhost:3000/api/report/tbl_a1b2c3d4e5f6789012345678/pdf
```

**Response:** Binary PDF file (`Content-Type: application/pdf`)
