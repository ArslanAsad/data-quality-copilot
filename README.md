# AI Data Quality Copilot

Production-quality system for automated data profiling, quality issue detection, and LLM-powered structured reporting.

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Client    │────▶│  Node.js Gateway │────▶│  Python AI Svc  │
│  (curl/UI)  │     │  (Express) :3000  │     │  (FastAPI) :8000 │
└─────────────┘     └────────┬─────────┘     └────────┬────────┘
                             │                       │
                             ▼                       ▼
                    ┌────────────────────────────────────┐
                    │         PostgreSQL :5432            │
                    └────────────────────────────────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │  Google Gemini  │
                                    │  (LLM)          │
                                    └─────────────────┘
```

## Tech Stack

| Component    | Technology                    |
| ------------ | ----------------------------- |
| API Gateway  | Node.js, Express              |
| AI/Profiling | Python, FastAPI, pandas       |
| Database     | PostgreSQL                    |
| LLM          | Google Gemini API (JSON mode) |

## Quick Start

### 1. Prerequisites

- PostgreSQL
- Google Gemini API key

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env and set:
# - POSTGRES_PASSWORD
# - POSTGRES_DB
# - DATABASE_URL
# - GEMINI_API_KEY
```

### 3. Verify Services

```bash
curl http://localhost:3000/health
curl http://localhost:8000/health
```

### 4. Upload and Analyze

```bash
# Upload CSV
curl -X POST http://localhost:3000/api/upload \
  -F "file=@sample_data.csv" \
  -H "Content-Type: multipart/form-data"

# Response: {"tableId":"tbl_abc123...","rowCount":100,"columnCount":5}

# Analyze (generate report)
curl -X POST http://localhost:3000/api/analyze/tbl_abc123...

# Download PDF
curl -o report.pdf http://localhost:3000/api/report/tbl_abc123/pdf
```

## API Reference

| Method | Endpoint                   | Description                                   |
| ------ | -------------------------- | --------------------------------------------- |
| POST   | `/api/upload`              | Upload CSV, infer schema, store in PostgreSQL |
| GET    | `/api/profile/:tableId`    | Get profiling JSON only (no LLM)              |
| POST   | `/api/analyze/:tableId`    | Full pipeline: profile → LLM → report         |
| GET    | `/api/report/:tableId/pdf` | Download PDF report                           |

### POST /api/upload

Upload a CSV file. Schema is inferred dynamically.

**Request:** `multipart/form-data` with `file` field (CSV)

**Response:**

```json
{
  "tableId": "tbl_a1b2c3d4e5f6...",
  "rowCount": 150,
  "columnCount": 8
}
```

### POST /api/analyze/:tableId

Run full pipeline: profile → rule-based checks → LLM analysis → report.

**Response:**

```json
{
  "executive_summary": "Data Quality Report: Dataset contains 150 rows and 8 columns. Overall risk score: 72/100 (High)...",
  "dataset_overview": {
    "row_count": 150,
    "column_count": 8,
    "table_id": "tbl_abc123"
  },
  "detailed_findings": [
    {
      "category": "Completeness",
      "column": "email",
      "severity": "HIGH",
      "business_impact": "Column has 15% null values...",
      "recommendation": "Investigate missing data sources...",
      "recommended_sql_check": "SELECT COUNT(*) FROM table_name WHERE \"email\" IS NULL;"
    }
  ],
  "risk_score": 72,
  "remediation_plan": [
    {
      "priority": "HIGH",
      "action": "Investigate missing data sources...",
      "sql": "SELECT ..."
    }
  ]
}
```

### GET /api/report/:tableId/pdf

Download PDF report.

## Local Development

### AI Service

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\Activate.ps1   # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Requires: PostgreSQL, `DATABASE_URL`, `GEMINI_API_KEY`.

### Backend

```bash
cd backend
npm install
npm run dev
```

Requires: PostgreSQL running, `DATABASE_URL` and `AI_SERVICE_URL` set.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Project Structure

```
data-quality-copilot/
├── backend/                 # Node.js API Gateway
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── db/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   └── package.json
├── ai-service/             # Python Profiling + LLM
│   ├── app/
│   │   ├── config.py
│   │   ├── db.py
│   │   ├── main.py
│   │   └── services/
│   │       ├── profiler.py
│   │       ├── quality_checks.py
│   │       ├── llm_service.py
│   │       ├── report_generator.py
│   │       └── pdf_generator.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
|   |   ├── App.css
|   |   ├── App.tsx
|   |   ├── main.tsx
├── .env.example
└── README.md
```

## LLM Prompt Template

The LLM receives profiling JSON and rule-based issues, and outputs strict JSON. See `ai-service/app/services/llm_service.py` for the full template. Key instructions:

- Classify severity: LOW, MEDIUM, HIGH
- Provide business_impact and recommendation per issue
- Generate recommended_sql_check (SELECT queries)
- Compute overall_risk_score (0–100) via weighted aggregation

## Risk Scoring

| Category         | Weight |
| ---------------- | ------ |
| Completeness     | 25     |
| Validity         | 30     |
| Uniqueness       | 20     |
| Consistency      | 15     |
| Range Violations | 10     |

Per-issue: HIGH = full weight, MEDIUM = 0.6×, LOW = 0.3×. Sum capped at 100.

## License

MIT
