"""
AI Data Quality Service - FastAPI application.
"""
import logging
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from app.config import get_settings, get_table_name
from app.db import fetch_table_data
from app.services.profiler import profile_table
from app.services.report_generator import generate_report
from app.services.pdf_generator import generate_pdf_report

_log_level = getattr(
    logging,
    get_settings().get("log_level", "info").upper(),
    logging.INFO,
)
logging.basicConfig(
    level=_log_level,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Data Quality Copilot - Profiling Service",
    version="1.0.0",
    description="Profiles datasets, runs quality checks, and generates reports via LLM.",
)


class ProfileRequest(BaseModel):
    table_id: str


class ReportRequest(BaseModel):
    table_id: str
    profiling: dict | None = None


@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-data-quality"}


@app.post("/profile")
def profile(request: ProfileRequest):
    """Profile a table and return structured JSON."""
    try:
        table_name = get_table_name(request.table_id)
        rows = fetch_table_data(table_name)
        if not rows:
            raise HTTPException(status_code=404, detail="Table not found or empty")
        result = profile_table(request.table_id, rows)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/report")
def report(request: ReportRequest):
    """Generate full quality report (profiling + LLM)."""
    try:
        result = generate_report(request.table_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Report generation failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/report/{table_id}/pdf")
def report_pdf(table_id: str):
    """Generate PDF report."""
    try:
        report = generate_report(table_id)
        pdf_bytes = generate_pdf_report(report)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="dq_report_{table_id}.pdf"'},
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("PDF generation failed")
        raise HTTPException(status_code=500, detail=str(e))
