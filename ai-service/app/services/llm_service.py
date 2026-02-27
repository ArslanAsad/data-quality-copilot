"""
LLM reasoning layer for data quality analysis.
Uses Google Gemini API with strict JSON output.
"""
import json
import logging
from typing import Any

from google import genai

from app.config import get_settings

logger = logging.getLogger(__name__)

LLM_PROMPT_TEMPLATE = """You are an enterprise data quality analyst. Analyze the following data profiling results and rule-based quality issues.

## Profiling Summary
{profiling_json}

## Rule-Based Issues (pre-computed)
{rule_issues_json}

## Your Task
1. Review all findings and classify severity: LOW, MEDIUM, or HIGH.
2. For each issue, provide:
   - category: One of Completeness, Uniqueness, Validity, Consistency, Range Violations
   - column: column name
   - severity: LOW | MEDIUM | HIGH
   - business_impact: 1-2 sentence impact on business
   - recommendation: Concrete remediation step
   - recommended_sql_check: A valid SQL SELECT query to identify problematic rows (use "table_name" as placeholder)

3. Compute overall_risk_score (0-100) using weighted aggregation:
   - Completeness issues: weight 25
   - Validity issues: weight 30
   - Uniqueness issues: weight 20
   - Consistency issues: weight 15
   - Range Violations: weight 10
   Each HIGH = full weight, MEDIUM = 0.6, LOW = 0.3. Sum and cap at 100.

4. Add any additional issues the LLM identifies from the profiling data that were not in the rule-based list.

Output ONLY valid JSON. No markdown. No explanations. Use this exact schema:

{{
  "issues": [
    {{
      "category": "string",
      "column": "string",
      "severity": "LOW|MEDIUM|HIGH",
      "business_impact": "string",
      "recommendation": "string",
      "recommended_sql_check": "string"
    }}
  ],
  "overall_risk_score": number
}}
"""


def _get_client():
    """Configure and return a Gemini client instance."""
    settings = get_settings()
    return genai.Client(api_key=settings["gemini_api_key"])


def analyze_with_llm(
    profiling: dict, rule_issues: list[dict]
) -> dict[str, Any]:
    """
    Call LLM with profiling + rule issues. Returns structured JSON.
    """
    settings = get_settings()
    if not settings["gemini_api_key"]:
        logger.warning("GEMINI_API_KEY not set; returning rule-based issues only")
        return _fallback_response(rule_issues)

    prompt = LLM_PROMPT_TEMPLATE.format(
        profiling_json=json.dumps(profiling, indent=2),
        rule_issues_json=json.dumps(rule_issues, indent=2),
    )

    try:
        client = _get_client()
        generation_config = {
            "response_mime_type": "application/json",
            "temperature": 0.1,
        }
        response = client.models.generate_content(
            model=settings["gemini_model"],
            contents=prompt,
            config=generation_config,
        )
        content = response.text
    except Exception as e:
        logger.exception("Gemini API error; falling back to rule-based response")
        return _fallback_response(rule_issues, parse_error=str(e))

    if not content:
        logger.warning("Gemini returned empty response; falling back to rule-based response")
        return _fallback_response(rule_issues)

    try:
        return json.loads(content)
    except json.JSONDecodeError as e:
        logger.error("LLM returned invalid JSON", extra={"content": content[:500]})
        return _fallback_response(rule_issues, parse_error=str(e))


def _fallback_response(
    rule_issues: list[dict], parse_error: str | None = None
) -> dict[str, Any]:
    """Fallback when LLM is unavailable or returns invalid JSON."""
    severity_weights = {"HIGH": 1.0, "MEDIUM": 0.6, "LOW": 0.3}
    category_weights = {
        "Completeness": 25,
        "Validity": 30,
        "Uniqueness": 20,
        "Consistency": 15,
        "Range Violations": 10,
    }
    score = 0
    for issue in rule_issues:
        cat = issue.get("category", "Completeness")
        sev = issue.get("severity", "MEDIUM")
        w = category_weights.get(cat, 10) * severity_weights.get(sev, 0.5)
        score += w
    return {
        "issues": rule_issues,
        "overall_risk_score": min(100, int(score)),
    }
