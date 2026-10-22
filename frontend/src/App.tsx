import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';

// Pages (lazy loaded for performance)
import { lazy, Suspense } from 'react';
import LoadingSpinner from './components/ui/LoadingSpinner';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const RepositoriesPage = lazy(() => import('./pages/repositories/RepositoriesPage'));
const RepositoryDetailPage = lazy(() => import('./pages/repositories/RepositoryDetailPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const QAPage = lazy(() => import('./pages/QAPage'));
const EvaluationPage = lazy(() => import('./pages/EvaluationPage'));
const SearchHistoryPage = lazy(() => import('./pages/SearchHistoryPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return !isAuthenticated ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <Suspense fallback={<LoadingSpinner fullscreen />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

        {/* Protected */}
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/repositories" element={<ProtectedRoute><RepositoriesPage /></ProtectedRoute>} />
        <Route path="/repositories/:id" element={<ProtectedRoute><RepositoryDetailPage /></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
        <Route path="/qa" element={<ProtectedRoute><QAPage /></ProtectedRoute>} />
        <Route path="/evaluation" element={<ProtectedRoute><EvaluationPage /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><SearchHistoryPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
