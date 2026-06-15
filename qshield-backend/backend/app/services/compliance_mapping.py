from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any

COMPLIANCE_RULES: dict[str, dict[str, Any]] = {
    "rsa_weak_key": {
        "keywords": ["RSA"],
        "match": lambda item: (
            _contains_any(item, ("algorithm_type", "certificate_algo", "algorithm"), ("RSA",))
            and _int_value(item.get("key_size")) is not None
            and _int_value(item.get("key_size")) <= 2048
        ),
        "frameworks": ["NIST_PQC", "ISO_27001", "GDPR"],
        "reason": "RSA keys at 2048 bits or below are still legacy cryptography and may not satisfy modern post-quantum migration expectations.",
        "severity_hint": "high",
    },
    "sha1": {
        "keywords": ["SHA-1", "SHA1"],
        "match": lambda item: _contains_any(item, ("signature", "cipher", "algorithm", "certificate_algo"), ("SHA1", "SHA-1")),
        "frameworks": ["NIST_PQC", "ISO_27001", "GDPR"],
        "reason": "SHA-1 is deprecated for trusted security use cases and weakens integrity and trust assurances.",
        "severity_hint": "high",
    },
    "md5": {
        "keywords": ["MD5"],
        "match": lambda item: _contains_any(item, ("signature", "cipher", "algorithm", "certificate_algo"), ("MD5",)),
        "frameworks": ["NIST_PQC", "ISO_27001", "GDPR"],
        "reason": "MD5 is cryptographically broken and should not be used to protect sensitive data.",
        "severity_hint": "high",
    },
    "tls_1_0_1_1": {
        "keywords": ["TLSv1", "TLSv1.1"],
        "match": lambda item: _tls_version(item.get("tls_version")) in {"TLSV1", "TLSV11"},
        "frameworks": ["NIST_PQC", "ISO_27001", "GDPR"],
        "reason": "Legacy TLS versions are outdated and may not meet current secure transmission expectations.",
        "severity_hint": "high",
    },
    "weak_cipher": {
        "keywords": ["CBC", "3DES", "RC4"],
        "match": lambda item: _contains_any(item, ("cipher",), ("CBC", "3DES", "RC4")),
        "frameworks": ["NIST_PQC", "ISO_27001"],
        "reason": "Weak cipher suites undermine confidentiality and are commonly discouraged by modern baselines.",
        "severity_hint": "medium",
    },
    "no_forward_secrecy": {
        "keywords": ["RSA"],
        "match": lambda item: _tls_version(item.get("tls_version")) in {"TLSV1", "TLSV11", "TLSV12"}
        and _contains_any(item, ("cipher",), ("RSA",))
        and not _contains_any(item, ("cipher",), ("ECDHE", "DHE")),
        "frameworks": ["NIST_PQC", "ISO_27001", "GDPR"],
        "reason": "Lack of forward secrecy increases exposure if long-term keys are compromised.",
        "severity_hint": "high",
    },
    "weak_or_expired_certificate": {
        "keywords": ["NO_CERT", "NO_TLS", "UNREACHABLE", "Expired"],
        "match": lambda item: (item.get("certificate_status") in {"NO_CERT", "NO_TLS", "UNREACHABLE"})
        or _certificate_expiring(item),
        "frameworks": ["ISO_27001", "GDPR"],
        "reason": "Weak, missing, or expired certificates weaken secure transport and trust controls.",
        "severity_hint": "medium",
    },
    "deprecated_algorithm": {
        "keywords": ["deprecated"],
        "match": lambda item: _contains_any(item, ("algorithm", "certificate_algo", "signature"), ("RSA", "SHA1", "MD5"))
        or _int_value(item.get("key_size")) in {0, 1024},
        "frameworks": ["NIST_PQC", "ISO_27001", "GDPR"],
        "reason": "Deprecated cryptographic algorithms can undermine data confidentiality and integrity expectations.",
        "severity_hint": "high",
    },
}


def _tls_version(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip().upper().replace("_", "")


def _int_value(value: Any) -> int | None:
    try:
        if value is None:
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _contains_any(item: dict[str, Any], fields: tuple[str, ...], needles: tuple[str, ...]) -> bool:
    for field in fields:
        value = item.get(field)
        if not isinstance(value, str):
            continue
        upper = value.upper()
        if any(needle.upper() in upper for needle in needles):
            return True
    return False


def _certificate_expiring(item: dict[str, Any]) -> bool:
    certificate = item.get("certificate") or {}
    expiry_days = certificate.get("expiry_days")
    try:
        return expiry_days is not None and int(expiry_days) < 0
    except (TypeError, ValueError):
        return False


def map_compliance(findings: list[dict[str, Any]] | None) -> dict[str, Any]:
    mapped_findings: list[dict[str, Any]] = []
    framework_counts: Counter[str] = Counter()
    high_confidence_matches = 0

    for finding in findings or []:
        if not isinstance(finding, dict):
            continue

        flags: list[str] = []
        reasons: list[str] = []
        highest_severity = "low"
        confidence = "low"

        for rule in COMPLIANCE_RULES.values():
            try:
                if rule["match"](finding):
                    for framework in rule["frameworks"]:
                        if framework not in flags:
                            flags.append(framework)
                            framework_counts[framework] += 1
                    reasons.append(rule["reason"])
                    hint = rule["severity_hint"]
                    if hint == "high":
                        highest_severity = "high"
                        confidence = "high"
                    elif hint == "medium" and highest_severity != "high":
                        highest_severity = "medium"
                        confidence = "medium"
            except Exception:
                continue

        enriched = dict(finding)
        enriched["compliance_flags"] = flags
        enriched["compliance_reason"] = " ".join(dict.fromkeys(reasons)) if reasons else ""
        enriched["compliance_confidence"] = confidence if flags else None
        enriched["compliance_severity_hint"] = highest_severity if flags else None
        if flags:
            mapped_findings.append(enriched)
            if confidence == "high":
                high_confidence_matches += 1

    return {
        "total_affected_findings": len(mapped_findings),
        "framework_counts": dict(framework_counts),
        "high_confidence_matches": high_confidence_matches,
        "findings": mapped_findings,
    }
