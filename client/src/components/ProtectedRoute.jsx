import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectAuthStatus } from '../store/authSlice.js';
import Logo from './Logo.jsx';

export function FullScreenLoader() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="animate-float"><Logo size={56} /></div>
    </div>
  );
}

export function ProtectedRoute() {
  const status = useSelector(selectAuthStatus);
  if (status === 'loading') return <FullScreenLoader />;
  return status === 'authed' ? <Outlet /> : <Navigate to="/" replace />;
}

// Landing page redirects signed-in users straight to the app.
export function PublicOnly({ children }) {
  const status = useSelector(selectAuthStatus);
  if (status === 'loading') return <FullScreenLoader />;
  return status === 'authed' ? <Navigate to="/app" replace /> : children;
}
