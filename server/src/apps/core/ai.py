"""
SmartStudent AI — shared helpers for the local LLM (Ollama).

Every call goes through `get_ollama_client()` so timeouts are consistent: a
model that isn't running fails fast instead of hanging a request thread.
"""

import logging
import time

import httpx
import ollama
from django.conf import settings

logger = logging.getLogger("apps.core")

_client = None


def get_ollama_client() -> ollama.Client:
    global _client
    if _client is None:
        timeout = httpx.Timeout(
            connect=settings.OLLAMA_CONNECT_TIMEOUT,
            read=settings.OLLAMA_READ_TIMEOUT,
            write=30.0,
            pool=5.0,
        )
        _client = ollama.Client(host=settings.OLLAMA_BASE_URL, timeout=timeout)
    return _client


def chat_options() -> dict:
    """Keyword args shared by every chat call (model + keep the model warm)."""
    return {
        "model": settings.OLLAMA_LLM_MODEL,
        "keep_alive": settings.OLLAMA_KEEP_ALIVE,
        "options": {"temperature": 0.2, "num_ctx": settings.OLLAMA_NUM_CTX},
    }


_status_cache: dict = {"at": 0.0, "value": None}


def ollama_status(force: bool = False) -> dict:
    """
    Reachability + model availability, cached for 15 s.
    Returns {"reachable": bool, "model": str, "model_available": bool, "loaded": bool, "error": str|None}
    """
    now = time.monotonic()
    if not force and _status_cache["value"] and now - _status_cache["at"] < 15:
        return _status_cache["value"]

    model = settings.OLLAMA_LLM_MODEL
    result = {"reachable": False, "model": model, "model_available": False, "loaded": False, "error": None}
    try:
        with httpx.Client(timeout=httpx.Timeout(3.0)) as http:
            tags = http.get(f"{settings.OLLAMA_BASE_URL}/api/tags").json()
            names = {m.get("name", "") for m in tags.get("models", [])}
            result["reachable"] = True
            result["model_available"] = model in names or f"{model}:latest" in names
            try:
                running = http.get(f"{settings.OLLAMA_BASE_URL}/api/ps").json()
                result["loaded"] = any(m.get("name", "").split(":")[0] == model.split(":")[0] for m in running.get("models", []))
            except Exception:
                pass
            if not result["model_available"]:
                result["error"] = f"Model '{model}' is not pulled. Run: ollama pull {model}"
    except Exception as exc:
        result["error"] = "Ollama is not reachable. Start it with: ollama serve"
        logger.info(f"Ollama status check failed: {exc}")

    _status_cache.update(at=now, value=result)
    return result


def warm_up_model() -> bool:
    """Load the model into memory so the first real question isn't slow."""
    try:
        get_ollama_client().generate(prompt="ok", **{k: v for k, v in chat_options().items() if k != "options"}, options={"num_predict": 1})
        return True
    except Exception as exc:
        logger.warning(f"Model warm-up failed: {exc}")
        return False


def parse_llm_json(text: str):
    """
    Parse JSON produced by a small local model. Handles code fences, leading prose
    and the most common truncation (missing closing brackets at the end).
    """
    import json
    import re

    t = (text or "").strip()
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", t)
    start = min((i for i in (t.find("{"), t.find("[")) if i != -1), default=-1)
    if start > 0:
        t = t[start:]
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        pass
    # Close any brackets the model forgot, ignoring brackets inside strings.
    stack, in_str, esc = [], False, False
    for ch in t:
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch in "{[":
            stack.append("}" if ch == "{" else "]")
        elif ch in "}]" and stack:
            stack.pop()
    repaired = re.sub(r",\s*$", "", t) + "".join(reversed(stack))
    return json.loads(repaired)
