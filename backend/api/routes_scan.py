"""Scan lifecycle routes: create a scan, stream its progress, fetch its result."""
from __future__ import annotations

import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from sse_starlette.sse import EventSourceResponse

from models.schemas import LogEntry, ScanCreatedResponse, ScanResult
from orchestrator.crew import run_pipeline
from services import repo_service, scan_store

router = APIRouter(prefix="/api/scan", tags=["scan"])


SUPPORTED_ARCHIVE_SUFFIXES = (".zip", ".tar.gz", ".tgz", ".tar")


@router.post("", response_model=ScanCreatedResponse)
async def create_scan(
    background_tasks: BackgroundTasks,
    repo_url: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
) -> ScanCreatedResponse:
    if not repo_url and file is None:
        raise HTTPException(status_code=400, detail="provide either repo_url or an archive file")

    archive_path: Optional[Path] = None
    if file is not None:
        filename = (file.filename or "").lower()
        if not filename.endswith(SUPPORTED_ARCHIVE_SUFFIXES):
            raise HTTPException(
                status_code=400,
                detail="unsupported archive type — upload a .zip or .tar.gz (.rar is not supported)",
            )

    scan_id = uuid.uuid4().hex[:12]
    scan_store.create_scan(scan_id, repo_url)

    if file is not None:
        workspace = repo_service.workspace_for(scan_id)
        archive_path = workspace / f"upload-{file.filename}"
        archive_path.write_bytes(await file.read())

    background_tasks.add_task(run_pipeline, scan_id, repo_url, archive_path)
    return ScanCreatedResponse(scan_id=scan_id)


@router.get("", response_model=list[ScanResult])
async def list_scans() -> list[ScanResult]:
    return scan_store.list_scans()


@router.get("/{scan_id}", response_model=ScanResult)
async def get_scan(scan_id: str) -> ScanResult:
    result = scan_store.get_scan(scan_id)
    if result is None:
        raise HTTPException(status_code=404, detail="scan not found")
    return result


@router.get("/{scan_id}/stream")
async def stream_scan(scan_id: str) -> EventSourceResponse:
    if scan_store.get_scan(scan_id) is None:
        raise HTTPException(status_code=404, detail="scan not found")

    async def event_generator():
        queue = scan_store.subscribe(scan_id)
        finished = False
        try:
            current = scan_store.get_scan(scan_id)
            if current is not None:
                yield {"event": "snapshot", "data": current.model_dump_json()}
            while True:
                item = await queue.get()
                if isinstance(item, LogEntry):
                    yield {"event": "log", "data": item.model_dump_json()}
                    continue
                yield {"event": "agent", "data": item.model_dump_json()}
                if item.agent == "report" and item.status in ("done", "error"):
                    finished = True
                    break
            # Drain any log lines still queued behind the final agent event
            # (e.g. the report agent's own closing log line) before closing.
            while finished and not queue.empty():
                item = queue.get_nowait()
                if isinstance(item, LogEntry):
                    yield {"event": "log", "data": item.model_dump_json()}
        finally:
            scan_store.unsubscribe(scan_id, queue)

    return EventSourceResponse(event_generator())
