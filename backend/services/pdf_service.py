"""Render a ScanResult into a downloadable PDF security report.

Uses Jinja2 for templating. HTML-to-PDF rendering tries WeasyPrint first —
the primary path, and the only one installed on the Linux deploy target
(Railway/Render, via apt-installed Pango/Cairo). WeasyPrint's native libs are
often missing on a bare Windows dev machine, though, so as a local-dev
fallback this shells out to headless Chrome/Edge's built-in print-to-PDF
(`--headless --print-to-pdf`) — genuine PDF rendering via a real browser
engine, not a stub. Only if neither is available does report download
actually fail.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

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


def _render_with_weasyprint(html: str) -> bytes:
    from weasyprint import HTML  # noqa: PLC0415 - deferred: only imported when actually used

    return HTML(string=html, base_url=str(TEMPLATE_DIR)).write_pdf()


_CHROMIUM_CANDIDATES = (
    os.environ.get("CHROME_PATH"),
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "google-chrome",
    "google-chrome-stable",
    "chromium-browser",
    "chromium",
    "msedge",
)


def _find_chromium() -> Optional[str]:
    for candidate in _CHROMIUM_CANDIDATES:
        if not candidate:
            continue
        if os.path.isabs(candidate):
            if Path(candidate).is_file():
                return candidate
        else:
            resolved = shutil.which(candidate)
            if resolved:
                return resolved
    return None


def _render_with_headless_browser(html: str) -> bytes:
    browser = _find_chromium()
    if browser is None:
        raise PdfRenderingUnavailable(
            "PDF rendering needs either WeasyPrint's native Pango/Cairo libraries or a Chrome/"
            "Edge/Chromium browser on PATH, and neither was found in this environment."
        )

    with tempfile.TemporaryDirectory() as tmp_dir:
        html_path = Path(tmp_dir) / "report.html"
        pdf_path = Path(tmp_dir) / "report.pdf"
        html_path.write_text(html, encoding="utf-8")

        proc = subprocess.run(
            [
                browser,
                "--headless=new",
                "--disable-gpu",
                "--no-sandbox",
                "--no-pdf-header-footer",
                f"--print-to-pdf={pdf_path}",
                html_path.as_uri(),
            ],
            capture_output=True,
            timeout=60,
        )

        if not pdf_path.exists():
            stderr = proc.stderr.decode("utf-8", errors="replace")[:800]
            raise PdfRenderingUnavailable(f"headless browser failed to produce a PDF: {stderr}")

        return pdf_path.read_bytes()


def render_report_pdf(scan: ScanResult) -> bytes:
    html = render_report_html(scan)

    try:
        return _render_with_weasyprint(html)
    except (ImportError, OSError):
        pass  # native libs missing — fall through to the headless-browser path

    return _render_with_headless_browser(html)
