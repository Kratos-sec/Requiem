from __future__ import annotations

import json
import logging
import os
import requests
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

BASE_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
SCAN_CONTEXT_FILE = BASE_DATA_DIR / "scan_context.json"
logger = logging.getLogger(__name__)


def _ensure_file() -> None:
    BASE_DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not SCAN_CONTEXT_FILE.exists():
        SCAN_CONTEXT_FILE.write_text("{}", encoding="utf-8")


def load_scan_context() -> dict[str, Any]:
    _ensure_file()
    try:
        return json.loads(SCAN_CONTEXT_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, FileNotFoundError):
        return {}


def save_scan_context(payload: dict[str, Any]) -> None:
    _ensure_file()
    SCAN_CONTEXT_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def build_scan_context(
    *,
    assets: list[dict[str, Any]] | None = None,
    threat_surface: list[dict[str, Any]] | None = None,
    vulnerabilities: list[dict[str, Any]] | None = None,
    cbom: list[dict[str, Any]] | None = None,
    summary: dict[str, Any] | None = None,
    domain: str | None = None,
) -> dict[str, Any]:
    context = load_scan_context()
    if domain is not None:
        context["domain"] = domain
    if assets is not None:
        context["assets"] = assets
    if threat_surface is not None:
        context["threat_surface"] = threat_surface
    if vulnerabilities is not None:
        context["vulnerabilities"] = vulnerabilities
    if cbom is not None:
        context["cbom"] = cbom
    if summary is not None:
        context["summary"] = summary
    save_scan_context(context)
    return context


def _truncate_text(value: Any, limit: int = 240) -> Any:
    if not isinstance(value, str):
        return value
    text = value.strip()
    if len(text) <= limit:
        return text
    return text[: max(limit - 3, 0)] + "..."


def _pick_top_entries(entries: list[dict[str, Any]], limit: int, score_fields: tuple[str, ...]) -> list[dict[str, Any]]:
    def _score(item: dict[str, Any]) -> tuple:
        parts: list[int] = []
        for field in score_fields:
            value = item.get(field)
            if isinstance(value, bool):
                parts.append(int(value))
            elif isinstance(value, (int, float)):
                parts.append(int(value))
            elif isinstance(value, str):
                parts.append(1 if value and value not in {"Unknown", "None", "N/A"} else 0)
            else:
                parts.append(0)
        return tuple(parts)

    sorted_entries = sorted(entries or [], key=_score, reverse=True)
    return sorted_entries[:limit]


def _risk_weight(value: Any) -> int:
    if not isinstance(value, str):
        return 0
    normalized = value.strip().upper()
    return {
        "CRITICAL": 4,
        "HIGH": 3,
        "MEDIUM": 2,
        "LOW": 1,
    }.get(normalized, 0)


def build_ai_context(context: dict[str, Any], *, max_assets: int = 12, max_cbom: int = 12, max_threats: int = 8, max_vulnerabilities: int = 8) -> dict[str, Any]:
    """
    Create a compact context for LLM prompts.

    The saved scan context may contain hundreds of assets and dozens of nested
    fields per asset, which can easily exceed model limits. This version keeps
    the most useful summary fields plus a bounded sample of detailed entries.
    """
    if not context:
        return {}

    assets = context.get("assets") or []
    cbom = context.get("cbom") or []
    threat_surface = context.get("threat_surface") or []
    vulnerabilities = context.get("vulnerabilities") or []

    compact_assets: list[dict[str, Any]] = []
    ranked_assets = sorted(
        [asset for asset in assets if isinstance(asset, dict)],
        key=lambda item: (
            int(bool(item.get("live_httpx"))),
            int(bool(item.get("is_live"))),
            len(item.get("services") or []),
            int(bool(item.get("ip"))),
        ),
        reverse=True,
    )
    for asset in ranked_assets[:max_assets]:
        if not isinstance(asset, dict):
            continue
        compact_assets.append(
            {
                "domain": asset.get("domain"),
                "ip": asset.get("ip"),
                "type": asset.get("type"),
                "is_live": asset.get("is_live"),
                "live_httpx": asset.get("live_httpx"),
                "services": [
                    {
                        "port": service.get("port"),
                        "service": service.get("service"),
                        "product": _truncate_text(service.get("product"), 80),
                        "version": _truncate_text(service.get("version"), 40),
                    }
                    for service in (asset.get("services") or [])[:3]
                    if isinstance(service, dict)
                ],
            }
        )

    compact_cbom: list[dict[str, Any]] = []
    ranked_cbom = sorted(
        [entry for entry in cbom if isinstance(entry, dict)],
        key=lambda item: (
            _risk_weight(item.get("risk_level")),
            int(bool(item.get("quantum_vulnerable"))),
            int(bool(item.get("outdated_services"))),
            int(bool(item.get("certificate_status") in {"UNREACHABLE", "NO_CERT", "NO_TLS"})),
        ),
        reverse=True,
    )
    for entry in ranked_cbom[:max_cbom]:
        if not isinstance(entry, dict):
            continue
        compact_cbom.append(
            {
                "domain": entry.get("domain"),
                "ip": entry.get("ip"),
                "type": entry.get("type"),
                "risk_level": entry.get("risk_level"),
                "tls_version": entry.get("tls_version"),
                "cipher": entry.get("cipher"),
                "certificate_status": entry.get("certificate_status"),
                "quantum_vulnerable": entry.get("quantum_vulnerable"),
                "key_strength": entry.get("key_strength"),
                "headers_label": entry.get("headers_label"),
                "certificate_label": entry.get("certificate_label"),
                "outdated_services": entry.get("outdated_services"),
            }
        )

    compact_threats: list[dict[str, Any]] = []
    for entry in threat_surface[:max_threats]:
        if not isinstance(entry, dict):
            continue
        compact_threats.append(
            {
                "domain": entry.get("domain"),
                "type": entry.get("type"),
                "risk": entry.get("risk"),
                "has_mx": entry.get("has_mx"),
            }
        )

    compact_vulnerabilities: list[dict[str, Any]] = []
    for entry in vulnerabilities[:max_vulnerabilities]:
        if not isinstance(entry, dict):
            continue
        compact_vulnerabilities.append(
            {
                "name": _truncate_text(entry.get("name"), 140),
                "severity": entry.get("severity"),
                "template": entry.get("template"),
                "matched": _truncate_text(entry.get("matched"), 140),
            }
        )

    compact_context = {
        "domain": context.get("domain"),
        "summary": context.get("summary") or {},
        "assets_sample": compact_assets,
        "cbom_sample": compact_cbom,
        "threat_surface_sample": compact_threats,
        "vulnerabilities_sample": compact_vulnerabilities,
    }

    return compact_context


def call_local_gemini(prompt: str) -> dict[str, str]:
    ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate").strip()
    ollama_model = os.getenv("OLLAMA_MODEL", "gemma4:e4b-it-q4_k_m").strip()

    def _request_json(url: str, payload: dict[str, Any], headers: dict[str, str], timeout: int) -> dict[str, Any]:
        request = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw or "{}")

    try:
        logger.info("Calling Ollama API...")
        logger.info(f"Model: {ollama_model}")
        logger.info(f"URL: {ollama_url}")
        data = _request_json(
            ollama_url,
            {
                "model": ollama_model,
                "prompt": prompt,
                "stream": False,
            },
            {
                "Content-Type": "application/json",
            },
            timeout=45,
        )
        logger.info(f"Ollama raw response: {data}")
        response_text = str(data.get("response") or "")
        if response_text.strip():
            logger.info("Ollama succeeded model=%s", ollama_model)
            return {
                "response": response_text,
                "provider": "ollama",
                "model": ollama_model,
            }
        raise RuntimeError("Ollama returned an empty response")
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as exc:
        logger.error("Ollama request failed model=%s error=%s", ollama_model, exc, exc_info=True)
        raise RuntimeError(f"Ollama error: {exc}") from exc


def call_nvidia_llm(prompt: str) -> dict[str, str]:
    api_key = os.getenv("NVIDIA_API_KEY", "").strip()
    logger.info(f"NVIDIA KEY PRESENT: {bool(api_key)}")
    if not api_key:
        raise RuntimeError("NVIDIA API failed: missing NVIDIA_API_KEY")

    url = "https://integrate.api.nvidia.com/v1/chat/completions"
    model = "google/gemma-3n-e4b-it"
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 512,
        "temperature": 0.2,
        "top_p": 0.7,
        "stream": False,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        logger.info("Calling NVIDIA API...")
        response = requests.post(url, headers=headers, json=payload, timeout=60)

        if response.status_code != 200:
            raise RuntimeError(f"NVIDIA error {response.status_code}: {response.text}")

        data = response.json()
        logger.info(f"NVIDIA RAW RESPONSE: {data}")

        try:
            content = data["choices"][0]["message"]["content"]
        except Exception:
            raise RuntimeError(f"Invalid NVIDIA response: {data}")

        logger.info("NVIDIA success")
        return {
            "response": content,
            "provider": "nvidia",
            "model": model,
        }
    except Exception as exc:
        logger.error("NVIDIA API failed: %s", exc, exc_info=True)
        raise RuntimeError(f"NVIDIA API failed: {exc}") from exc
