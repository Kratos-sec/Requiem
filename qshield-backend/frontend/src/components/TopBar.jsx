import { useContext, useMemo, useState, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { canAccess } from '../utils/roleAccess';

const domainRegex = /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/i;
const ipRegex    = /^(?:\d{1,3}\.){3}\d{1,3}$/;

const sanitizeDomain = (value) => {
  if (!value) return '';
  let s = value.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '');
  s = s.replace(/^www\./, '');
  s = s.replace(/\/+$/, '');
  return s;
};

const isValidDomain = (value) => domainRegex.test(value) || ipRegex.test(value);

export default function TopBar({ onScan, onStopScan, isScanning = false }) {
  const { user } = useContext(AuthContext);
  const [domain, setDomain]         = useState('');
  const [inputError, setInputError] = useState('');
    const [focused, setFocused]       = useState(false);
  const canRunScan = canAccess(user?.role, 'scan');

  const handleSubmit = () => {
    if (!canRunScan) {
      setInputError('Your role does not allow running scans.');
      return;
    }
    setInputError('');
    const sanitized = sanitizeDomain(domain);
    if (!sanitized) { setInputError('Please enter a domain to scan.'); return; }
    if (!isValidDomain(sanitized)) { setInputError('Enter a valid domain without protocol.'); return; }
    setDomain(sanitized);
      onScan(sanitized);
  };

  const stopScan = async () => { try { await onStopScan?.(); } catch { /* no-op */ } };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!canRunScan) {
        setInputError('Your role does not allow running scans.');
        return;
      }
      isScanning ? stopScan() : handleSubmit();
    }
  };

  // Auto-dismiss helper text after 5 seconds
  useEffect(() => {
    if (inputError) {
      const timer = setTimeout(() => {
        setInputError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [inputError]);

  const helperText = useMemo(() => inputError || null, [inputError]);

  return (
    <header
      className="fixed top-0 right-0 left-64 z-40 flex items-center px-6 gap-5"
      style={{
        height: '64px',
        background: 'linear-gradient(90deg, #7A0518 0%, #9A0820 50%, #C0122F 100%)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
      }}
    >
      {/* Animated accent line at top */}
      <span
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: 'linear-gradient(90deg, transparent 0%, #FABC0A 25%, #fff 50%, #FABC0A 75%, transparent 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 3s linear infinite',
          opacity: 0.6,
        }}
      />

      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(1.3); }
        }
      `}</style>

      {/* ── Left: scan status ────────────────────── */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Scan status badge */}
        {isScanning ? (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            <span style={{ fontSize: '9px', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#fff' }}>
              Scanning…
            </span>
          </div>
        ) : (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#4ade80',
                boxShadow: '0 0 8px rgba(74, 222, 128, 0.6)',
                animation: 'pulse-dot 2.5s ease-in-out infinite',
              }}
            />
            <span style={{ fontSize: '9px', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#86efac' }}>
              Idle
            </span>
          </div>
        )}
      </div>

      {/* ── Center: Search bar ────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center relative">
        <div
          className={`relative flex items-center w-full max-w-2xl transition-all duration-300 ${helperText ? 'input-error-shake' : ''}`}
          style={{
            filter: focused ? 'drop-shadow(0 0 16px rgba(0, 0, 0, 0.3))' : 'none',
          }}
        >
          {/* Search icon */}
          <span
            className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] pointer-events-none transition-colors duration-200"
            style={{ color: focused ? '#fff' : 'rgba(255, 255, 255, 0.4)', fontVariationSettings: "'FILL' 1" }}
          >
            travel_explore
          </span>

          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Scan a domain  e.g. hack2skill.com…"
            aria-invalid={Boolean(inputError)}
            disabled={!canRunScan}
            className="w-full pl-11 pr-40 py-2.5 text-sm font-medium outline-none transition-all duration-200"
            style={{
              background: !canRunScan
                ? 'rgba(255, 255, 255, 0.04)'
                : focused
                  ? 'rgba(255, 255, 255, 0.12)'
                  : 'rgba(255, 255, 255, 0.06)',
              border: !canRunScan
                ? '1.5px solid rgba(255, 255, 255, 0.08)'
                : focused
                  ? '1.5px solid rgba(255, 255, 255, 0.3)'
                  : '1.5px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '12px',
              color: !canRunScan ? 'rgba(255,255,255,0.45)' : '#fff',
              caretColor: '#FABC0A',
              boxShadow: focused
                ? 'inset 0 1px 4px rgba(0, 0, 0, 0.2)'
                : 'inset 0 1px 2px rgba(0, 0, 0, 0.1)',
            }}
          />

          {/* Inline controls */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {canRunScan ? (
              <>
                {!isScanning ? (
                  <button
                    onClick={handleSubmit}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-black text-xs uppercase tracking-widest text-white transition-all duration-200 hover:brightness-115 active:scale-[0.97]"
                    style={{
                      background: 'linear-gradient(135deg, #FABC0A 0%, #D49D00 100%)',
                      boxShadow: '0 2px 10px rgba(250, 188, 10, 0.4)',
                      letterSpacing: '0.15em',
                      color: '#4B3600'
                    }}
                  >
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>radar</span>
                    Run
                  </button>
                ) : (
                  <button
                    onClick={stopScan}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-black text-xs uppercase tracking-widest text-white transition-all duration-200 hover:brightness-115 active:scale-[0.97]"
                    style={{
                      background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                      boxShadow: '0 2px 10px rgba(239, 68, 68, 0.4)',
                      letterSpacing: '0.15em',
                    }}
                  >
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>stop_circle</span>
                    Stop
                  </button>
                )}
              </>
            ) : (
              <div
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: 'rgba(255,255,255,0.72)',
                }}
              >
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
                <span style={{ fontSize: '9px', fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                  Read only
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Error Popup (Toast style) */}
        {helperText && (
          <div
            className="absolute -bottom-12 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-xl shadow-2xl animate-error-pop"
            style={{
              background: 'rgba(239, 68, 68, 0.95)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: 'white',
              whiteSpace: 'nowrap'
            }}
          >
            <span className="material-symbols-outlined text-[16px]">error</span>
            <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.02em' }}>{helperText}</span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes error-pop {
          0% { transform: translate(-50%, 10px); opacity: 0; }
          100% { transform: translate(-50%, 0); opacity: 1; }
        }
        .animate-error-pop {
          animation: error-pop 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .input-error-shake {
          animation: shake 0.2s ease-in-out 2;
        }
      `}</style>

      {/* ── Right: Avatar only ────────────────────────────── */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Avatar */}
        <div
          className="relative w-9 h-9 rounded-full overflow-hidden cursor-pointer transition-all duration-200"
          style={{
            boxShadow: '0 0 0 2px rgba(181,10,46,0.5), 0 2px 10px rgba(0,0,0,0.4)',
          }}
          onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 0 0 2.5px #ff4d6d, 0 4px 14px rgba(181,10,46,0.5)'}
          onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 0 0 2px rgba(181,10,46,0.5), 0 2px 10px rgba(0,0,0,0.4)'}
          title="Admin Profile"
        >
          <img
            alt="Admin"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCI1xeVQb-lbsfGm_1pD2jJVu91VHZjIqoFxvsH_pf5-RAzdw3fUUV8kwk3o4FFp_U2tTxT9KWLX9w6ZjAnkwXk09adXdPhPaOghROJcPuFcxr42btjE9jBYBjNXp5Jnc_Y5RIbBfgWqCT7-_NiLeQuFNRq1-zaY-hk1hkvWyPbCsdhetULrPe9tW_ncKRhzLtuD1pmqKYy4N7xFXCjMi_r8DCDXMF853qh3z0UXnIw3SovrfHpL2LoP1c59PYT1l124X6gFrg5QG8"
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </header>
  );
}
