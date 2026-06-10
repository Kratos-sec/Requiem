import { Link, useLocation } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { getRoleLabel } from '../utils/roleAccess';

export default function Unauthorized() {
  const location = useLocation();
  const { user, logout } = useContext(AuthContext);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-dim tech-pattern px-6">
      <div className="max-w-lg w-full rounded-3xl border border-outline-variant/20 bg-surface/90 shadow-2xl p-8 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-error-container text-on-error-container flex items-center justify-center mb-5">
          <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            lock
          </span>
        </div>
        <p className="text-xs uppercase tracking-[0.25em] text-on-surface-variant/50 font-bold mb-3">
          Access restricted
        </p>
        <h1 className="text-2xl font-black text-on-surface mb-3">You do not have permission to view this page</h1>
        <p className="text-sm text-on-surface-variant leading-relaxed">
          {user?.role ? (
            <>
              Your account is signed in as <strong>{getRoleLabel(user.role)}</strong>, which cannot access{' '}
              <code className="px-1.5 py-0.5 rounded bg-surface-container-high text-xs">{location.state?.from || location.pathname}</code>.
            </>
          ) : (
            'Your session is active, but your role does not allow access to this area.'
          )}
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary transition-transform hover:scale-[1.01]"
          >
            <span className="material-symbols-outlined text-[18px]">home</span>
            Go to dashboard
          </Link>
          <button
            onClick={logout}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant/40 px-5 py-3 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
