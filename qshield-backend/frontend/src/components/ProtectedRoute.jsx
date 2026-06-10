import { useContext } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { canAccessRoute } from '../utils/roleAccess';

export default function ProtectedRoute() {
  const { isAuthenticated, isReady, user } = useContext(AuthContext);
  const location = useLocation();

  // Wait for the initial silent-refresh attempt before deciding to redirect.
  // Without this, a page reload would always kick the user to /login
  // while the refresh token is being validated.
  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fdf9f2]">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">autorenew</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccessRoute(user?.role, location.pathname)) {
    return <Navigate to="/unauthorized" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
