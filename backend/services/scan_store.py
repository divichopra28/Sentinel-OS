"""In-memory scan state + pub/sub for SSE progress streaming.

A single FastAPI process is enough for this build — no external queue or
database. State lives only as long as the process, which is fine for a scan
that completes within the same run it was started in.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Optional

from models.schemas import AgentEvent, AgentName, LogEntry, LogLevel, ScanResult, ScanStatus

_scans: dict[str, ScanResult] = {}
_subscribers: dict[str, list[asyncio.Queue]] = {}


def create_scan(scan_id: str, repo_url: Optional[str]) -> ScanResult:
    result = ScanResult(
        scan_id=scan_id,
        repo_url=repo_url,
        status=ScanStatus.pending,
        started_at=datetime.now(timezone.utc),
    )
    _scans[scan_id] = result
    _subscribers[scan_id] = []
    return result


def get_scan(scan_id: str) -> Optional[ScanResult]:
    return _scans.get(scan_id)


def list_scans() -> list[ScanResult]:
    return sorted(_scans.values(), key=lambda s: s.started_at, reverse=True)


def subscribe(scan_id: str) -> asyncio.Queue:
    queue: asyncio.Queue = asyncio.Queue()
    _subscribers.setdefault(scan_id, []).append(queue)
    return queue


def unsubscribe(scan_id: str, queue: asyncio.Queue) -> None:
    subscribers = _subscribers.get(scan_id, [])
    if queue in subscribers:
        subscribers.remove(queue)


def publish(scan_id: str, event: AgentEvent) -> None:
    result = _scans.get(scan_id)
    if result is not None:
        result.agent_statuses[event.agent] = event.status
    for queue in _subscribers.get(scan_id, []):
        queue.put_nowait(event)


def publish_log(scan_id: str, level: LogLevel, message: str, agent: Optional[AgentName] = None) -> None:
    """Append one real system/agent log line and fan it out to SSE subscribers."""
    entry = LogEntry(timestamp=datetime.now(timezone.utc), level=level, message=message, agent=agent)
    result = _scans.get(scan_id)
    if result is not None:
        result.logs.append(entry)
    for queue in _subscribers.get(scan_id, []):
        queue.put_nowait(entry)
