from backend.app.services.compliance_mapping import map_compliance


def test_rsa_weak_key_mapping():
    result = map_compliance(
        [
            {
                "domain": "example.com",
                "key_size": 1024,
                "algorithm": "RSA",
                "certificate_algo": "RSA",
            }
        ]
    )

    assert result["total_affected_findings"] == 1
    finding = result["findings"][0]
    assert "NIST_PQC" in finding["compliance_flags"]
    assert "ISO_27001" in finding["compliance_flags"]
    assert finding["compliance_confidence"] == "high"


def test_sha1_mapping():
    result = map_compliance(
        [
            {
                "domain": "example.org",
                "signature": "SHA-1",
            }
        ]
    )

    assert result["total_affected_findings"] == 1
    assert "GDPR" in result["findings"][0]["compliance_flags"]
    assert result["framework_counts"]["GDPR"] >= 1


def test_tls_downgrade_mapping():
    result = map_compliance(
        [
            {
                "domain": "legacy.example.net",
                "tls_version": "TLSv1.1",
                "cipher": "TLS_RSA_WITH_AES_128_CBC_SHA",
            }
        ]
    )

    assert result["total_affected_findings"] == 1
    finding = result["findings"][0]
    assert "ISO_27001" in finding["compliance_flags"]
    assert finding["compliance_reason"]


def test_empty_no_match_case():
    result = map_compliance(
        [
            {
                "domain": "safe.example.com",
                "tls_version": "TLSv1.3",
                "cipher": "TLS_AES_256_GCM_SHA384",
                "key_size": 4096,
            }
        ]
    )

    assert result["total_affected_findings"] == 0
    assert result["findings"] == []
    assert result["framework_counts"] == {}
