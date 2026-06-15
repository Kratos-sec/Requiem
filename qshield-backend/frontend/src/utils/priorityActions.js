const normalizeText = (value) => String(value || '').trim().toLowerCase();

const humanizeHeaderInsight = (text) => {
  const raw = String(text || '').trim();
  if (!raw) return raw;

  const cspMatch = raw.match(/^CSP missing on (\d+)\/(\d+) assets?$/i);
  if (cspMatch) {
    const missing = Number(cspMatch[1]);
    const total = Number(cspMatch[2]);
    return `Content Security Policy is missing on ${missing} of ${total} assets. This means browsers are not being told which scripts and resources are allowed to load.`;
  }

  const hstsMatch = raw.match(/^HSTS not enabled on (\d+)\/(\d+) assets?$/i);
  if (hstsMatch) {
    const missing = Number(hstsMatch[1]);
    const total = Number(hstsMatch[2]);
    return `HTTP Strict Transport Security is not enabled on ${missing} of ${total} assets. Without it, browsers may still try insecure HTTP connections first.`;
  }

  if (/TLS 1\.2\+ requirements/i.test(raw)) {
    return raw.replace(
      /All assets meet TLS 1\.2\+ requirements\./i,
      'All scanned assets currently meet TLS 1.2+ requirements. Browsers and clients are consistently using modern transport security.'
    );
  }

  return raw;
};

export function buildPriorityActions(scanData = {}) {
  const assets = Array.isArray(scanData.cbom) && scanData.cbom.length > 0 ? scanData.cbom : (scanData.assets || []);
  const assetList = Array.isArray(assets) ? assets : [];

  const hasNoTls = assetList.some((asset) => {
    const tls = normalizeText(asset?.tls_version);
    const cipher = normalizeText(asset?.cipher);
    return tls === 'not supported' || cipher === 'none';
  });

  const hasQuantumVuln = assetList.some((asset) => {
    const tls = normalizeText(asset?.tls_version);
    const cipher = normalizeText(asset?.cipher);
    return asset?.quantum_vulnerable === true || normalizeText(asset?.risk_level) === 'high' || tls === 'not supported' || cipher === 'none';
  });

  const hasLegacyCrypto = assetList.some((asset) => {
    const keySize = normalizeText(asset?.key_size);
    const algorithm = normalizeText(asset?.algorithm || asset?.certificate_algo);
    const cipher = normalizeText(asset?.cipher);
    return keySize === '1024-bit' || keySize === '2048-bit' || algorithm.includes('sha-1') || algorithm.includes('md5') || cipher === 'none';
  });

  const summary = scanData?.summary || {};
  const cspMissing = Number(summary?.missing_csp || 0);
  const hstsMissing = Number(summary?.missing_hsts || 0);
  const total = Number(summary?.total_assets || assetList.length || 0);

  const items = [];
  items.push(
    hasNoTls
      ? { title: 'Some assets do not support TLS and need immediate remediation.', severity: 'High', icon: 'security' }
      : { title: 'All scanned assets currently meet TLS 1.2+ requirements. Browsers and clients are using modern transport security.', severity: 'Low', icon: 'verified' },
  );
  items.push(
    hasQuantumVuln
      ? { title: 'Some assets remain quantum vulnerable and need PQC migration planning.', severity: 'High', icon: 'memory' }
      : { title: 'No quantum vulnerable assets were flagged in the latest scan.', severity: 'Low', icon: 'check_circle' },
  );
  items.push(
    hasLegacyCrypto
      ? { title: 'Legacy cryptographic algorithms are still present in the inventory.', severity: 'Medium', icon: 'key' }
      : { title: 'No obvious legacy cryptographic algorithms were detected.', severity: 'Low', icon: 'verified' },
  );

  if (cspMissing > 0) {
    items.push({
      title: humanizeHeaderInsight(`CSP missing on ${cspMissing}/${total} assets`),
      severity: 'Medium',
      icon: 'policy',
    });
  }

  if (hstsMissing > 0) {
    items.push({
      title: humanizeHeaderInsight(`HSTS not enabled on ${hstsMissing}/${total} assets`),
      severity: 'Medium',
      icon: 'https',
    });
  }

  const scanInsights = Array.isArray(scanData?.insights) ? scanData.insights : [];
  scanInsights.forEach((insight) => {
    const text = String(insight || '').trim();
    if (!text) return;
    if (/^CSP missing on \d+\/\d+ assets?$/i.test(text) || /^HSTS not enabled on \d+\/\d+ assets?$/i.test(text)) {
      items.push({
        title: humanizeHeaderInsight(text),
        severity: 'Medium',
        icon: text.toLowerCase().includes('csp') ? 'policy' : 'https',
      });
    }
  });

  return items;
}

export function humanizeInsight(text) {
  return humanizeHeaderInsight(text);
}
