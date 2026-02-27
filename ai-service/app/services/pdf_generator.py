"""
PDF report generation using reportlab.
"""
from io import BytesIO
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
)
from reportlab.lib.enums import TA_CENTER


def generate_pdf_report(report: dict) -> bytes:
    """Generate a PDF from the structured quality report."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=inch,
        leftMargin=inch,
        topMargin=inch,
        bottomMargin=inch,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        name="Title",
        parent=styles["Heading1"],
        fontSize=18,
        alignment=TA_CENTER,
        spaceAfter=12,
    )
    h2_style = ParagraphStyle(
        name="H2",
        parent=styles["Heading2"],
        fontSize=14,
        spaceBefore=12,
        spaceAfter=6,
    )
    body_style = styles["Normal"]

    story = []

    # Title
    story.append(Paragraph("Data Quality Report", title_style))
    story.append(Spacer(1, 0.2 * inch))

    # Executive Summary
    story.append(Paragraph("Executive Summary", h2_style))
    story.append(Paragraph(report.get("executive_summary", ""), body_style))
    story.append(Spacer(1, 0.3 * inch))

    # Dataset Overview
    overview = report.get("dataset_overview", {})
    if overview:
        story.append(Paragraph("Dataset Overview", h2_style))
        overview_data = [
            ["Metric", "Value"],
            ["Rows", str(overview.get("row_count", "N/A"))],
            ["Columns", str(overview.get("column_count", "N/A"))],
            ["Table ID", str(overview.get("table_id", "N/A"))],
        ]
        t = Table(overview_data)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("FONTSIZE", (0, 0), (-1, 0), 12),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
            ("BACKGROUND", (0, 1), (-1, -1), colors.beige),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
        ]))
        story.append(t)
        story.append(Spacer(1, 0.3 * inch))

    # Risk Score
    risk_score = report.get("risk_score", 0)
    story.append(Paragraph("Risk Score", h2_style))
    story.append(Paragraph(f"<b>{risk_score}/100</b>", body_style))
    story.append(Spacer(1, 0.3 * inch))

    # Detailed Findings
    findings = report.get("detailed_findings", [])
    if findings:
        story.append(Paragraph("Detailed Findings", h2_style))
        for i, f in enumerate(findings[:15], 1):
            story.append(Paragraph(
                f"<b>{i}. {f.get('category', '')} - {f.get('column', '')} ({f.get('severity', '')})</b>",
                body_style,
            ))
            story.append(Paragraph(f"Impact: {f.get('business_impact', '')}", body_style))
            story.append(Paragraph(f"Recommendation: {f.get('recommendation', '')}", body_style))
            story.append(Spacer(1, 0.2 * inch))
        story.append(Spacer(1, 0.3 * inch))

    # Remediation Plan
    plan = report.get("remediation_plan", [])
    if plan:
        story.append(Paragraph("Remediation Plan", h2_style))
        plan_data = [["Priority", "Action"]]
        for p in plan[:10]:
            action = p.get("action", "")
            plan_data.append([p.get("priority", ""), action[:80] + ("..." if len(action) > 80 else "")])
        t = Table(plan_data)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
        ]))
        story.append(t)

    doc.build(story)
    return buffer.getvalue()
