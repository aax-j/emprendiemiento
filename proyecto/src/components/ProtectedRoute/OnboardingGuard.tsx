import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export const OnboardingGuard: React.FC = () => {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <p>Verificando datos del taller...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // If the user has a session but no profile (or no workshop_id), they need to complete onboarding
  if (!profile || !profile.workshop_id) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
};
