"""PDF report generation/download route."""
from __future__ import annotations

import io

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from services import pdf_service, scan_store

router = APIRouter(prefix="/api/scan", tags=["reports"])


@router.get("/{scan_id}/report")
async def download_report(scan_id: str) -> StreamingResponse:
    result = scan_store.get_scan(scan_id)
    if result is None:
        raise HTTPException(status_code=404, detail="scan not found")
    if result.status != "completed":
        raise HTTPException(
            status_code=409, detail=f"scan is not completed yet (status={result.status.value})"
        )

    try:
        pdf_bytes = pdf_service.render_report_pdf(result)
    except pdf_service.PdfRenderingUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="sentinelos-report-{scan_id}.pdf"'},
    )
