import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Toaster } from 'react-hot-toast';
import { useMeQuery } from './services/api.js';
import { selectUser } from './store/authSlice.js';
import { useSessionGuard } from './hooks/useSession.js';
import { useWalletWatcher } from './hooks/useWalletWatcher.js';
import { ProtectedRoute, PublicOnly } from './components/ProtectedRoute.jsx';
import KeyGate from './components/KeyGate.jsx';
import Landing from './pages/Landing.jsx';
import Home from './pages/Home.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
  // Restore the session from the httpOnly cookie on page load.
  useMeQuery();
  useSessionGuard();
  useWalletWatcher(useSelector(selectUser));

  return (
    <>
      <Routes>
        <Route path="/" element={<PublicOnly><Landing /></PublicOnly>} />
        <Route element={<ProtectedRoute />}>
          {/* KeyGate blocks the app until the E2EE keys are set up and unlocked with the PIN. */}
          <Route element={<KeyGate />}>
            <Route path="/app/:id?" element={<Home />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3500,
          style: {
            background: 'rgba(18,18,29,0.88)',
            color: '#f1f5f9',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px',
            backdropFilter: 'blur(18px)',
            padding: '12px 16px',
            fontSize: '14px',
            fontWeight: 500,
            boxShadow: '0 16px 48px -12px rgba(0,0,0,0.7)',
          },
          success: { iconTheme: { primary: '#34d399', secondary: '#06060c' } },
          error: { iconTheme: { primary: '#f87171', secondary: '#06060c' } },
        }}
      />
    </>
  );
}
