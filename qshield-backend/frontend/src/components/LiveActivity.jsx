import { useEffect, useMemo, useState } from 'react';

const timelineItems = [
  { label: 'Scan initiated', status: 'Operational', valueKey: null },
  { label: 'Assets discovered', status: 'Tracking', valueKey: 'total_assets' },
  { label: 'HTTPS enabled', status: 'Protected', valueKey: 'https_enabled' },
  { label: 'Quantum vulnerabilities detected', status: 'PQC', valueKey: 'quantum_vulnerable' },
  { label: 'Report generated successfully', status: 'Ready', valueKey: null },
];

export default function LiveActivity({ summary }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!summary) return;
    setStep(0);
    const timers = [
      setTimeout(() => setStep(1), 0),
      setTimeout(() => setStep(2), 600),
      setTimeout(() => setStep(3), 1400),
      setTimeout(() => setStep(4), 1800),
      setTimeout(() => setStep(5), 2200),
    ];
    return () => timers.forEach(clearTimeout);
  }, [summary]);

  const items = useMemo(() => timelineItems.map((item, index) => {
    const isVisible = index <= step;
    const isActive = index === step;
    const isComplete = index < step;

    let value = null;
    if (item.valueKey === 'total_assets') value = summary?.total_assets || 0;
    if (item.valueKey === 'https_enabled') value = summary?.https_enabled || 0;
    if (item.valueKey === 'quantum_vulnerable') value = summary?.quantum_vulnerable || 0;

    return {
      ...item,
      isVisible,
      isActive,
      isComplete,
      value,
    };
  }), [step, summary]);

  const renderIcon = (item) => {
    if (item.isComplete) return 'check_circle';
    if (item.isActive && item.valueKey) return 'autorenew';
    if (item.label === 'Quantum vulnerabilities detected') return 'warning';
    return 'bolt';
  };

  const renderStatus = (item) => {
    if (item.isActive && item.valueKey) return 'Processing...';
    if (item.isComplete && item.value !== null) return `${item.value} • ${item.status}`;
    if (item.isComplete) return item.status;
    return item.status;
  };

  if (!summary) return null;

  return (
    <section
      className="col-span-12 md:col-span-6 backdrop-blur rounded-3xl p-4 shadow-lg border border-[#e5dfd3] space-y-3"
      style={{ background: 'linear-gradient(135deg, #fdfbf6 0%, #f8f4ec 100%)' }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-sm text-on-surface tracking-wide">Live Activity</h4>
          <p className="text-xs text-on-surface-variant">Streaming telemetry from the latest scan run</p>
        </div>
        <span className="text-xs font-bold text-secondary uppercase tracking-[0.3em]">Realtime</span>
      </div>
      <div className="space-y-3">
        {items.filter((item) => item.isVisible).map((item) => (
          <div key={item.label} className="flex gap-2 items-start">
            <div className={`flex-shrink-0 h-8 w-8 rounded-full border flex items-center justify-center text-sm ${
              item.isComplete
                ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                : item.isActive
                  ? 'bg-secondary/10 border-secondary/30 text-secondary'
                  : 'bg-surface-container-high border-outline-variant/40 text-on-surface-variant'
            }`}>
              <span className={`material-symbols-outlined text-[18px] ${item.isActive && item.valueKey ? 'animate-spin' : ''}`}>
                {renderIcon(item)}
              </span>
            </div>
            <div className="flex-1">
              <p className="text-sm text-on-surface font-semibold leading-tight">{item.label}</p>
              <p className="text-[11px] text-on-surface-variant leading-tight">{renderStatus(item)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
