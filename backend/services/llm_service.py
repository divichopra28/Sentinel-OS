"""Provider-agnostic structured LLM completion: OpenAI primary, Gemini fallback.

Every agent asks for one Pydantic model back as strict JSON. If neither
provider is configured (no API key) or both fail, callers fall back to a
deterministic heuristic so the pipeline always completes end-to-end — this
keeps local/offline demos and CI runs from hard-failing on a missing key.
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Optional, Type, TypeVar

from pydantic import BaseModel

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")

_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL)


def _strip_code_fence(text: str) -> str:
    match = _JSON_FENCE_RE.search(text)
    return match.group(1).strip() if match else text.strip()


def _openai_complete(system: str, user: str) -> Optional[str]:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return None
    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        return response.choices[0].message.content
    except Exception as exc:  # noqa: BLE001 - any provider failure should trigger fallback
        logger.warning("OpenAI completion failed, trying fallback provider: %s", exc)
        return None


def _gemini_complete(system: str, user: str) -> Optional[str]:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None
    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(GEMINI_MODEL, system_instruction=system)
        response = model.generate_content(
            user,
            generation_config={"response_mime_type": "application/json"},
        )
        return response.text
    except Exception as exc:  # noqa: BLE001
        logger.warning("Gemini completion failed: %s", exc)
        return None


def structured_complete(system: str, user: str, schema: Type[T]) -> Optional[T]:
    """Ask an LLM to produce `schema` as JSON. Returns None if unavailable/unparseable."""
    schema_hint = (
        f"{user}\n\nRespond with ONLY a single JSON object matching this JSON Schema "
        f"(no prose, no markdown fence):\n{json.dumps(schema.model_json_schema())}"
    )
    raw = _openai_complete(system, schema_hint) or _gemini_complete(system, schema_hint)
    if raw is None:
        return None
    try:
        data = json.loads(_strip_code_fence(raw))
        return schema.model_validate(data)
    except Exception as exc:  # noqa: BLE001
        logger.warning("failed to parse structured LLM output for %s: %s", schema.__name__, exc)
        return None


def llm_available() -> bool:
    return bool(os.environ.get("OPENAI_API_KEY") or os.environ.get("GEMINI_API_KEY"))


def run_crewai_task(agent, description: str, expected_output: str, output_model: Type[T]) -> Optional[T]:
    """Run one CrewAI Task on `agent` and return its parsed Pydantic output, or None on failure."""
    if agent is None:
        return None
    try:
        from crewai import Task

        task = Task(
            description=description,
            expected_output=expected_output,
            agent=agent,
            output_pydantic=output_model,
        )
        task_output = task.execute_sync(agent=agent)
        parsed = task_output.pydantic
        return parsed if isinstance(parsed, output_model) else None
    except Exception as exc:  # noqa: BLE001 - caller falls back to heuristic/direct-call path
        logger.warning("crewai task failed for %s: %s", output_model.__name__, exc)
        return None


def get_crewai_llm():
    """Build a crewai.LLM for whichever provider has a key configured.

    Returns None if crewai isn't installed or no provider key is set — callers
    should treat that as "run the heuristic fallback path instead of a real
    CrewAI agent", not as an error.
    """
    try:
        from crewai import LLM
    except ImportError:
        return None

    if os.environ.get("OPENAI_API_KEY"):
        return LLM(model=f"openai/{OPENAI_MODEL}", api_key=os.environ["OPENAI_API_KEY"], temperature=0.2)
    if os.environ.get("GEMINI_API_KEY"):
        return LLM(model=f"gemini/{GEMINI_MODEL}", api_key=os.environ["GEMINI_API_KEY"], temperature=0.2)
    return None
