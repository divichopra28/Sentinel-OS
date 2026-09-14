"""Render a ScanResult into a downloadable PDF security report.

Uses Jinja2 for templating and WeasyPrint for HTML-to-PDF rendering.
WeasyPrint needs native Pango/Cairo libraries that are straightforward to
install on the Linux deploy target (Railway/Render) but can be missing on a
bare Windows dev machine — import is deferred so the rest of the API keeps
working even if PDF rendering isn't available locally.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from models.schemas import ScanResult

TEMPLATE_DIR = Path(__file__).parent / "templates"

_env = Environment(
    loader=FileSystemLoader(str(TEMPLATE_DIR)),
    autoescape=select_autoescape(["html"]),
)


class PdfRenderingUnavailable(RuntimeError):
    """Raised when WeasyPrint's native dependencies aren't installed."""


def _build_context(scan: ScanResult) -> dict:
    finding_by_id = {f.id: f for f in scan.findings}
    analysis_by_id = {a.finding_id: a for a in scan.threat_analyses}
    patch_by_id = {p.finding_id: p for p in scan.patches}
    chain_by_finding_id = {
        fid: chain for chain in scan.attack_chains for fid in chain.related_finding_ids
    }

    ranked = sorted(scan.risk_scores, key=lambda s: s.priority_rank)
    ranked_rows = [
        {
            "rank": score.priority_rank,
            "file_path": finding_by_id[score.finding_id].file_path,
            "severity": finding_by_id[score.finding_id].severity.value,
            "composite_score": score.composite_score,
            "likelihood": score.likelihood,
            "business_impact": score.business_impact.value,
        }
        for score in ranked
        if score.finding_id in finding_by_id
    ]

    appendix_rows = [
        {
            "rank": score.priority_rank,
            "finding": finding_by_id[score.finding_id],
            "analysis": analysis_by_id.get(score.finding_id),
            "chain": chain_by_finding_id.get(score.finding_id),
            "patch": patch_by_id.get(score.finding_id),
        }
        for score in ranked
        if score.finding_id in finding_by_id
    ]

    return {
        "scan": scan,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "ranked_rows": ranked_rows,
        "appendix_rows": appendix_rows,
    }


def render_report_html(scan: ScanResult) -> str:
    template = _env.get_template("report.html.j2")
    return template.render(**_build_context(scan))


def render_report_pdf(scan: ScanResult) -> bytes:
    try:
        from weasyprint import HTML
    except (ImportError, OSError) as exc:
        raise PdfRenderingUnavailable(
            "PDF rendering requires WeasyPrint's native Pango/Cairo libraries, which are not "
            "available in this environment."
        ) from exc

    html = render_report_html(scan)
    return HTML(string=html, base_url=str(TEMPLATE_DIR)).write_pdf()
