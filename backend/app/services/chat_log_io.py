"""Read/write AI tutor transcripts on disk (JSON) and export plain text for gap/heatmap AI."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

TRANSCRIPT_VERSION = 1


def _project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def chat_transcript_path(history_id) -> str:
    """Relative path stored on ``ChatHistory.file_path`` (under project root)."""
    return str(Path("uploads") / "chat_logs" / f"{history_id}.json")


def ensure_chat_file(path: str) -> None:
    """Create parent directories for a transcript file."""
    full = _project_root() / path
    full.parent.mkdir(parents=True, exist_ok=True)


def full_path(relative: str) -> Path:
    return _project_root() / relative


def resolve_chat_file(stored_path: str) -> Path:
    """Resolve DB ``file_path`` (relative or absolute) to a readable path."""
    p = Path(stored_path)
    if p.is_file():
        return p
    cand = full_path(stored_path)
    if cand.is_file():
        return cand
    raise FileNotFoundError(f"Chat log file not found: {stored_path}")


def load_transcript(stored_path: str) -> dict[str, Any]:
    """Load JSON transcript; return empty structure if missing."""
    try:
        p = resolve_chat_file(stored_path)
    except FileNotFoundError:
        return {"version": TRANSCRIPT_VERSION, "turns": []}
    with open(p, encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, dict):
        return {"version": TRANSCRIPT_VERSION, "turns": []}
    if "turns" not in data:
        data["turns"] = []
    return data


def save_transcript(relative_path: str, data: dict[str, Any]) -> None:
    """Write transcript; ``relative_path`` is stored on ``ChatHistory.file_path``."""
    ensure_chat_file(relative_path)
    p = full_path(relative_path)
    with open(p, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)


def append_exchange(
    relative_path: str,
    user_text: str,
    assistant_text: str,
    sources: list[str] | None = None,
) -> dict[str, Any]:
    """Append one user + assistant turn and return updated transcript dict."""
    data = load_transcript(relative_path)
    now = datetime.now(timezone.utc).isoformat()
    data["version"] = TRANSCRIPT_VERSION
    turns: list[dict[str, Any]] = data.setdefault("turns", [])
    turns.append({"role": "user", "content": user_text.strip(), "ts": now})
    turns.append({
        "role": "assistant",
        "content": assistant_text.strip(),
        "ts": now,
        "sources": sources or [],
    })
    save_transcript(relative_path, data)
    return data


def turns_to_plain_text(turns: list[dict[str, Any]]) -> str:
    """Format transcript turns for ``/quiz/detect-gaps`` and heatmap AI (natural dialogue)."""
    parts: list[str] = []
    for t in turns:
        role = t.get("role", "")
        content = (t.get("content") or "").strip()
        if not content:
            continue
        label = "User" if role == "user" else "Assistant"
        parts.append(f"{label}: {content}")
    return "\n\n".join(parts)


def read_as_plain_text(stored_path: str) -> str:
    """Read a transcript file; support legacy plain-text logs or JSON transcripts."""
    p = resolve_chat_file(stored_path)
    with open(p, encoding="utf-8") as fh:
        raw = fh.read()
    stripped = raw.strip()
    if stripped.startswith("{"):
        try:
            data = json.loads(raw)
            turns = data.get("turns", []) if isinstance(data, dict) else []
            return turns_to_plain_text(turns)
        except json.JSONDecodeError:
            pass
    return raw
