import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export const OnboardingGuard: React.FC = () => {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <p>Verificando sesión...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Clientes B2C globales (sin owner_workshop_id): van al portal de cliente
  if (profile?.role_type === 'client') {
    // Si intentan entrar a rutas B2B (/), redirigir a /client
    if (!location.pathname.startsWith('/client')) {
      return <Navigate to="/client" replace />;
    }
    return <Outlet />;
  }

  // Mecánicos o Shadow Profiles: verificar que tienen workshop_id
  if (!profile || !profile.workshop_id) {
    return <Navigate to="/onboarding" replace />;
  }

  // Si un mecánico intenta entrar a /client, lo devolvemos a /
  if (location.pathname.startsWith('/client')) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

