export default function ThreatBanner({ risk, rating }) {
  const isCritical = risk === 'High' || rating === 'Critical';
  if (!isCritical) {
    return null;
  }

  const message =
    rating === 'Critical'
      ? 'Critical Risk Detected - Immediate action required'
      : 'High Risk Assets Found';

  return (
    <section className="col-span-12 bg-primary/95 border border-primary-variant rounded-2xl p-4 shadow-[0_8px_32px_rgba(181,10,46,0.25)] text-white flex items-center gap-4">
      <div className="text-2xl leading-tight drop-shadow-md">!</div>
      <div>
        <p className="text-base font-semibold tracking-tight leading-tight">{message}</p>
        <p className="text-xs opacity-80">Review high risk assets and remediation notes before releasing changes.</p>
      </div>
    </section>
  );
}
