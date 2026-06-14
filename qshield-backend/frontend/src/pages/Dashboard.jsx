import { AssetDistributionCard, RiskDistributionCard } from '../components/Charts';
import ThreatBanner from '../components/ThreatBanner';
import LiveActivity from '../components/LiveActivity';
import Recommendations from '../components/Recommendations';
import { CertificateExpiryCard, IpVersionCard } from '../components/AnalyticsWidgets';
import TopAssets from '../components/TopAssets';
import { useNavigate } from 'react-router-dom';

export default function Dashboard({ scanData, isLoading, error }) {
  const navigate = useNavigate();
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <span className="material-symbols-outlined animate-spin text-4xl text-secondary mb-4">autorenew</span>
        <h3 className="font-bold text-lg text-on-surface">Scanning Infrastructure...</h3>
        <p className="text-sm text-on-surface-variant mt-2">Running PQC Risk Assessment and CBOM Generation</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-error-container text-on-error-container p-4 flex items-center gap-3 rounded-lg shadow-sm border border-error/20">
        <span className="material-symbols-outlined text-error">error</span>
        <div className="flex-1">
          <h4 className="font-bold text-sm">Scan Failed</h4>
          <p className="text-xs">{error}</p>
        </div>
      </div>
    );
  }

  if (!scanData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] opacity-50">
        <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-4" style={{ fontVariationSettings: "'wght' 200" }}>manage_search</span>
        <h3 className="font-bold text-lg text-on-surface">No Active Scan Data</h3>
        <p className="text-sm text-on-surface-variant mt-2">Enter a domain in the top search bar to initiate a scan.</p>
      </div>
    );
  }

  const { score, risk, quantum_status, summary, rating, insights, cbom, inventory, counts } = scanData;
  const sourceAssets = Array.isArray(scanData.cbom) && scanData.cbom.length ? scanData.cbom : (scanData.assets || []);

  const totalAssets = sourceAssets.length;
  const highRisk = sourceAssets.filter((a) => (a.risk_level || '').toLowerCase() === 'high').length || summary?.high_risk_assets || 0;
  const expiringSoon = summary?.expiring_soon || 0;
  
  const apis = sourceAssets.filter((asset) => (asset.type || '').toLowerCase() === 'api').length;
  const servers = sourceAssets.filter((asset) => (asset.type || '').toLowerCase() === 'server').length;

  const kpiCards = [
    { title: 'Total Assets', value: totalAssets, accentClass: 'border-l-4 border-blue-500', filter: '', delay: '0ms' },
    { title: 'High Risk Assets', value: highRisk, accentClass: 'border-l-4 border-primary', filter: 'high', delay: '60ms' },
    { title: 'Expiring Soon', value: expiringSoon, accentClass: 'border-l-4 border-secondary', filter: 'expiring', delay: '120ms' },
    { title: 'APIs', value: apis, accentClass: 'border-l-4 border-indigo-500', filter: 'api', delay: '180ms' },
    { title: 'Servers', value: servers, accentClass: 'border-l-4 border-emerald-500', filter: 'server', delay: '240ms' },
  ];

  const handleCardClick = (filter) => {
    if (filter) {
      navigate('/assets', { state: { filter } });
      return;
    }
    navigate('/assets');
  };

  return (
    <div className="grid grid-cols-12 gap-4 auto-rows-min">
      <ThreatBanner risk={risk} rating={rating} />
      <section
        className="col-span-12 rounded-lg p-4 shadow-xl border border-[#e5dfd3]"
        style={{ background: 'linear-gradient(135deg, #fdfbf6 0%, #f8f4ec 100%)' }}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-headline text-sm font-semibold text-on-surface tracking-[0.2em]">Dashboard Overview</h3>
            <p className="text-on-surface-variant text-xs mt-1">High-level security and compliance metrics.</p>
          </div>
          <span className="bg-primary/5 border border-primary/20 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Executive</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-on-surface-variant/70">Security Score</span>
            <div className="text-2xl font-bold text-primary leading-tight">{score || 0}</div>
            <div className="flex items-center gap-1 text-[11px] text-on-surface-variant font-semibold mt-1 leading-tight tracking-wide">
              <span className="material-symbols-outlined text-[12px]">analytics</span> Overall rating
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-on-surface-variant/70">Risk Level</span>
            <div className={`text-2xl font-bold leading-tight ${risk === 'Low' ? 'text-green-600' :
              risk === 'Medium' ? 'text-secondary' :
                'text-error'
              }`}>
              {risk || 'Unknown'}
            </div>
            <div className={`flex items-center gap-1 text-[11px] font-semibold mt-1 leading-tight tracking-wide ${risk === 'Low' ? 'text-green-600' :
              risk === 'Medium' ? 'text-secondary' :
                'text-error'
              }`}>
              <span className="material-symbols-outlined text-[12px]">{risk === 'Low' ? 'verified' : 'warning'}</span> Assessment
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-on-surface-variant/70">Quantum Status</span>
            <div className="text-2xl font-bold text-on-surface pt-1 pb-1 leading-tight">{quantum_status || 'Unknown'}</div>
            <div className="flex items-center gap-1 text-[11px] text-secondary font-semibold mt-1 leading-tight tracking-wide">
              <span className="material-symbols-outlined text-[12px]">memory</span> PQC Check
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-on-surface-variant/70">Total Assets</span>
            <div className="text-2xl font-bold text-on-surface leading-tight">{totalAssets}</div>
            <div className="flex items-center gap-1 text-[11px] text-on-surface-variant font-semibold mt-1 leading-tight tracking-wide">
              <span className="material-symbols-outlined text-[12px]">hub</span> Discovered endpoints
            </div>
          </div>
        </div>
      </section>
      <section className="col-span-12">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {kpiCards.map((card) => (
            <div
              key={card.title}
              role="button"
              tabIndex={0}
              onClick={() => handleCardClick(card.filter)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleCardClick(card.filter);
                }
              }}
              className={`glass-card card-rise rounded-2xl w-full min-w-0 p-3 flex flex-col justify-between gap-1 overflow-hidden truncate text-slate-800 ${card.accentClass} cursor-pointer transition-all duration-200 ease-out transform hover:-translate-y-1 hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary`}
              style={{ background: 'linear-gradient(135deg, #fdfbf6 0%, #f8f4ec 100%)', animationDelay: card.delay }}
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 truncate leading-tight">{card.title}</span>
              <div className="text-3xl font-black text-slate-800 leading-tight mt-1">{card.value}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="col-span-12">
        <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <AssetDistributionCard data={scanData} />
          <RiskDistributionCard data={scanData} />
          <CertificateExpiryCard data={scanData} />
          <IpVersionCard data={scanData} />
        </div>
      </section>
      <LiveActivity summary={summary} />
      <Recommendations insights={insights} />
      <TopAssets data={scanData} />
    </div>
  );
}
