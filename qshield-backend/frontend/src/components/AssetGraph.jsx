import { useRef, useMemo, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

export default function AssetGraph({ scanData }) {
  const fgRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef(null);

  const riskMap = useMemo(() => {
    const map = new Map();
    const source = Array.isArray(scanData?.cbom) && scanData.cbom.length ? scanData.cbom : scanData?.assets || [];
    source.forEach((asset) => {
      const domain = String(asset?.domain || '').toLowerCase();
      if (domain) {
        map.set(domain, {
          risk: String(asset?.risk_level || '').toLowerCase(),
          quantum: asset?.quantum_vulnerable,
        });
      }
    });
    return map;
  }, [scanData]);

  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.offsetWidth,
        height: containerRef.current.offsetHeight || 600
      });
    }
  }, []);

  const graphData = useMemo(() => {
    const nodes = [];
    const links = [];
    const nodeIds = new Set();

    const addNode = (id, group, label, color) => {
      if (!id) return;
      if (!nodeIds.has(id)) {
        nodes.push({ id, group, label, color });
        nodeIds.add(id);
      }
    };

    const addLink = (source, target) => {
      if (source && target && source !== target) {
        links.push({ source, target });
      }
    };

    const sourceAssets = Array.isArray(scanData?.cbom) && scanData.cbom.length
      ? scanData.cbom
      : scanData?.assets || [];

    sourceAssets.forEach((asset) => {
      const domainId = asset.domain;
      const ipId = asset.ip;
      const assetRisk = riskMap.get(String(domainId || '').toLowerCase()) || {};
      const riskLevel = String(assetRisk.risk || asset.risk_level || '').toLowerCase();
      const quantumVulnerable = assetRisk.quantum ?? asset.quantum_vulnerable;
      const isHighRisk = riskLevel === 'high' || riskLevel === 'critical' || quantumVulnerable === true;
      const isMediumRisk = riskLevel === 'medium' || riskLevel === 'moderate';
      const domainColor = isHighRisk ? '#ef4444' : isMediumRisk ? '#f59e0b' : '#22c55e';
      const ipColor = isHighRisk ? '#b91c1c' : isMediumRisk ? '#d97706' : '#0f766e';

      if (domainId && domainId !== 'Unknown') {
        addNode(domainId, 'domain', `Domain: ${domainId}`, domainColor);

        if (ipId && ipId !== 'Unknown') {
          addNode(ipId, 'ip', `IP: ${ipId}`, ipColor);
          addLink(domainId, ipId);
        }
      } else if (ipId && ipId !== 'Unknown') {
        addNode(ipId, 'ip', `IP: ${ipId}`, ipColor);
      }

      // Base target for services
      const linkTarget = domainId && domainId !== 'Unknown' ? domainId : ipId;

      // Add services/tags
      if (linkTarget && asset.services && Array.isArray(asset.services)) {
        asset.services.forEach(svc => {
          const svcName = svc.product || svc.service || 'Unknown';
          const svcId = `${linkTarget}-${svcName}-${svc.port || ''}`;

          let color = isHighRisk ? '#ef4444' : isMediumRisk ? '#f59e0b' : '#f97316';
          let group = 'service';
          if (svcName.toLowerCase().includes('ssh')) { group = 'ssh'; color = '#0d9488'; }
          if (svcName.toLowerCase().includes('ssl')) { group = 'ssl'; color = '#0284c7'; }
          if (isHighRisk) color = '#dc2626';

          addNode(svcId, group, `${group.toUpperCase()}: ${svcName}`, color);
          addLink(linkTarget, svcId);
        });
      }

      // Add certificate/SSL
      if (linkTarget && asset.certificate) {
        const sslId = `${linkTarget}-ssl`;
        addNode(sslId, 'ssl', `SSL: ${asset.certificate.issuer || 'Cert'}`, isHighRisk ? '#dc2626' : '#0284c7');
        addLink(linkTarget, sslId);
      }

      // Tags based on actual asset properties (if any exist in scanData)
      if (linkTarget && asset.tags && Array.isArray(asset.tags)) {
        asset.tags.forEach(tag => {
          const tagId = `${linkTarget}-tag-${tag}`;
          addNode(tagId, 'tag', `Tag: ${tag}`, '#ef4444');
          addLink(linkTarget, tagId);
        });
      }
    });

    return { nodes, links };
  }, [scanData]);

  const handleNodePaint = (node, ctx, globalScale) => {
    const label = node.label;
    const fontSize = Math.max(12 / globalScale, 4);

    const nodeColor = node.color || (
      node.group === 'tag' ? '#d84d2f' :
        node.group === 'domain' ? '#1d86d5' :
          node.group === 'ssl' ? '#395c73' :
            node.group === 'ssh' ? '#205a5d' :
              node.group === 'file' ? '#843936' : '#13665a'
    );

    // Draw outer glow/border
    ctx.beginPath();
    ctx.arc(node.x, node.y, 14, 0, 2 * Math.PI, false);
    ctx.fillStyle = '#111827'; // Dark background
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = nodeColor;
    ctx.stroke();

    // Draw inner circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, 10, 0, 2 * Math.PI, false);
    ctx.fillStyle = nodeColor;
    ctx.fill();

    // Node generic icon text (WWW, IP, TAG, SSL, SSH)
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let iconText = 'IP';
    if (node.group === 'domain') iconText = 'WWW';
    if (node.group === 'tag') iconText = 'TAG';
    if (node.group === 'ssl') iconText = 'SSL';
    if (node.group === 'ssh') iconText = 'SSH';
    if (node.group === 'service') iconText = 'SVC';
    if (node.group === 'file') iconText = 'FILE';

    ctx.font = `bold ${5}px Sans-Serif`;
    ctx.fillText(iconText, node.x, node.y);

    // Label block below node
    ctx.font = `${4}px Sans-Serif`;
    const textWidth = ctx.measureText(label).width;
    const bckgDimensions = [textWidth, 4].map(n => n + 4);

    // Draw dark rounded rect for label background
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    const rectX = node.x - bckgDimensions[0] / 2;
    const rectY = node.y + 16;
    const rectH = bckgDimensions[1];
    const rectW = bckgDimensions[0];
    const radius = 2;
    ctx.moveTo(rectX + radius, rectY);
    ctx.lineTo(rectX + rectW - radius, rectY);
    ctx.quadraticCurveTo(rectX + rectW, rectY, rectX + rectW, rectY + radius);
    ctx.lineTo(rectX + rectW, rectY + rectH - radius);
    ctx.quadraticCurveTo(rectX + rectW, rectY + rectH, rectX + rectW - radius, rectY + rectH);
    ctx.lineTo(rectX + radius, rectY + rectH);
    ctx.quadraticCurveTo(rectX, rectY + rectH, rectX, rectY + rectH - radius);
    ctx.lineTo(rectX, rectY + radius);
    ctx.quadraticCurveTo(rectX, rectY, rectX + radius, rectY);
    ctx.fill();

    // Text label
    ctx.fillStyle = '#fff';
    ctx.fillText(label, node.x, node.y + 16 + rectH / 2);
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[600px] rounded-2xl overflow-hidden relative shadow-inner"
      style={{
        background: 'radial-gradient(circle at center, #ffd659 0%, #e6a822 50%, #c47600 100%)'
      }}
    >
      <div className="absolute top-4 left-4 z-10 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full border border-white/40 shadow-sm">
        <h3 className="text-gray-900 font-bold tracking-wider text-sm">Asset Topology Map</h3>
      </div>

      {dimensions.width > 0 && (
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          nodeCanvasObject={handleNodePaint}
          nodePointerAreaPaint={(node, color, ctx) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(node.x, node.y, 20, 0, 2 * Math.PI, false);
            ctx.fill();
          }}
          linkColor={() => '#059669'} // Green connecting lines
          linkWidth={1.5}
          linkDirectionalParticles={2}
          linkDirectionalParticleSpeed={0.005}
          linkDirectionalParticleWidth={2}
          linkDirectionalParticleColor={() => '#10b981'}
          cooldownTicks={100}
        />
      )}
    </div>
  );
}
