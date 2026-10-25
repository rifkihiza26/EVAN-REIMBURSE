import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole?: UserRole;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRole }) => {
  const { user, profile, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm text-slate-600 font-medium">Memuat sesi pengguna...</p>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Account deactivated
  if (profile && !profile.is_active) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-2xl font-bold mb-4">
          !
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Akun Dinonaktifkan</h2>
        <p className="text-sm text-slate-600 mb-6">
          Akun Anda saat ini telah dinonaktifkan oleh Administrator (Bos). Silakan hubungi atasan Anda untuk informasi lebih lanjut.
        </p>
      </div>
    );
  }

  // Check role authorization
  if (allowedRole && profile && profile.role !== allowedRole) {
    // Redirect to their own dashboard
    const targetDashboard = profile.role === 'boss' ? '/boss/dashboard' : '/employee/dashboard';
    return <Navigate to={targetDashboard} replace />;
  }

  return <>{children}</>;
};
