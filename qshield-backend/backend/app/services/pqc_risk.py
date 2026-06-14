def _normalize_text(value):
    if value is None:
        return ""
    return str(value).strip()


def calculate_pqc_risk(key_len, tls_version, cipher_suite):
    key_len = _normalize_text(key_len)
    tls_version = _normalize_text(tls_version)
    cipher_suite = _normalize_text(cipher_suite)

    tls_normalized = tls_version.lower()
    cipher_normalized = cipher_suite.lower()

    if tls_normalized in {"not supported", "unknown", ""} or cipher_normalized in {"none", "unknown", ""}:
        return "High"

    if key_len == "256-Bit":
        return "Low"

    if key_len == "2048-Bit":
        return "High"

    return "Medium"


def assess_pqc_risk(cbom):
    overall_risk = "Low"
    risk_order = {"Low": 0, "Medium": 1, "High": 2}

    for item in cbom:
        raw_tls = item.get("tls_version")
        cipher = item.get("cipher")
        key_len = item.get("key_size")

        if isinstance(key_len, int):
            key_len = f"{key_len}-Bit"
        elif key_len is None and item.get("algorithm_type") == "RSA":
            key_len = "2048-Bit"

        risk_level = calculate_pqc_risk(key_len, raw_tls, cipher)

        if item.get("outdated_services"):
            risk_level = "High"

        item["risk_level"] = risk_level
        item["quantum_vulnerable"] = risk_level == "High"

        if risk_order[risk_level] > risk_order[overall_risk]:
            overall_risk = risk_level

    return cbom, overall_risk
