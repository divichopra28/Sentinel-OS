"""Clone a public GitHub repo or extract an uploaded archive into a scan workspace."""
from __future__ import annotations

import os
import shutil
import tarfile
import tempfile
import zipfile
from pathlib import Path

import git

WORKSPACE_DIR = Path(os.environ.get("SCAN_WORKSPACE_DIR", tempfile.gettempdir() + "/sentinelos-scans"))


class UnsupportedArchiveError(ValueError):
    pass


def workspace_for(scan_id: str) -> Path:
    path = WORKSPACE_DIR / scan_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def clone_repo(repo_url: str, scan_id: str) -> Path:
    dest = workspace_for(scan_id) / "repo"
    if dest.exists():
        shutil.rmtree(dest)
    git.Repo.clone_from(repo_url, dest, depth=1)
    return dest


def _single_top_level_dir_or_root(dest: Path) -> Path:
    entries = list(dest.iterdir())
    if len(entries) == 1 and entries[0].is_dir():
        return entries[0]
    return dest


def extract_zip(zip_path: Path, scan_id: str) -> Path:
    dest = workspace_for(scan_id) / "repo"
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(dest)
    return _single_top_level_dir_or_root(dest)


def extract_tarball(tar_path: Path, scan_id: str) -> Path:
    dest = workspace_for(scan_id) / "repo"
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True, exist_ok=True)
    with tarfile.open(tar_path, mode="r:*") as tf:
        tf.extractall(dest, filter="data")
    return _single_top_level_dir_or_root(dest)


def extract_archive(archive_path: Path, scan_id: str) -> Path:
    """Dispatch to the right extractor based on the uploaded file's extension.

    Only .zip and .tar.gz/.tgz are real, tested extraction paths (both stdlib,
    zipfile/tarfile). .rar is deliberately not supported: it needs an external
    `unrar` binary this app doesn't ship, so pretending to accept it would
    just fail confusingly later — the upload route rejects it up front with a
    clear error instead.
    """
    name = archive_path.name.lower()
    if name.endswith(".zip"):
        return extract_zip(archive_path, scan_id)
    if name.endswith(".tar.gz") or name.endswith(".tgz") or name.endswith(".tar"):
        return extract_tarball(archive_path, scan_id)
    raise UnsupportedArchiveError(f"unsupported archive type: {archive_path.name}")


def cleanup(scan_id: str) -> None:
    path = WORKSPACE_DIR / scan_id
    if path.exists():
        shutil.rmtree(path, ignore_errors=True)
