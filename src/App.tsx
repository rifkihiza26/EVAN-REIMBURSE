import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';

// Auth Pages
import { LoginPage } from './features/auth/LoginPage';

// Employee Pages
import { EmployeeDashboard } from './features/dashboard/EmployeeDashboard';
import { NewReimbursementPage } from './features/reimbursements/NewReimbursementPage';
import { EmployeeReimbursementsPage } from './features/reimbursements/EmployeeReimbursementsPage';
import { ReimbursementDetailPage } from './features/reimbursements/ReimbursementDetailPage';

// Boss Pages
import { BossDashboard } from './features/dashboard/BossDashboard';
import { BossApprovalsPage } from './features/approvals/BossApprovalsPage';
import { BossReimbursementDetailPage } from './features/approvals/BossReimbursementDetailPage';
import { BossPaymentsPage } from './features/payments/BossPaymentsPage';
import { BossReportsPage } from './features/reports/BossReportsPage';
import { BossAllReimbursementsPage } from './features/reimbursements/BossAllReimbursementsPage';
import { BossEmployeesPage } from './features/employees/BossEmployeesPage';
import { BossCategoriesPage } from './features/categories/BossCategoriesPage';

// Root redirector based on authenticated user's role
const RootRedirector: React.FC = () => {
  const { user, profile, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (profile?.role === 'boss') {
    return <Navigate to="/boss/dashboard" replace />;
  }

  return <Navigate to="/employee/dashboard" replace />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Root dynamic redirect */}
          <Route path="/" element={<RootRedirector />} />

          {/* EMPLOYEE PROTECTED ROUTES */}
          <Route
            path="/employee/dashboard"
            element={
              <ProtectedRoute allowedRole="employee">
                <AppLayout>
                  <EmployeeDashboard />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/reimbursements"
            element={
              <ProtectedRoute allowedRole="employee">
                <AppLayout>
                  <EmployeeReimbursementsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/reimbursements/new"
            element={
              <ProtectedRoute allowedRole="employee">
                <AppLayout>
                  <NewReimbursementPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/reimbursements/:id"
            element={
              <ProtectedRoute allowedRole="employee">
                <AppLayout>
                  <ReimbursementDetailPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* BOSS PROTECTED ROUTES */}
          <Route
            path="/boss/dashboard"
            element={
              <ProtectedRoute allowedRole="boss">
                <AppLayout>
                  <BossDashboard />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/boss/approvals"
            element={
              <ProtectedRoute allowedRole="boss">
                <AppLayout>
                  <BossApprovalsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/boss/reimbursements/:id"
            element={
              <ProtectedRoute allowedRole="boss">
                <AppLayout>
                  <BossReimbursementDetailPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/boss/payments"
            element={
              <ProtectedRoute allowedRole="boss">
                <AppLayout>
                  <BossPaymentsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/boss/reports"
            element={
              <ProtectedRoute allowedRole="boss">
                <AppLayout>
                  <BossReportsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/boss/reimbursements"
            element={
              <ProtectedRoute allowedRole="boss">
                <AppLayout>
                  <BossAllReimbursementsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/boss/employees"
            element={
              <ProtectedRoute allowedRole="boss">
                <AppLayout>
                  <BossEmployeesPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/boss/categories"
            element={
              <ProtectedRoute allowedRole="boss">
                <AppLayout>
                  <BossCategoriesPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};
