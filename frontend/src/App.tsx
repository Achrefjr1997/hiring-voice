import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./components/AuthProvider";
import LayoutShell from "./components/LayoutShell";
import RecruiterDashboard from "./components/RecruiterDashboard";
import CandidateRoom from "./components/CandidateRoom";
import LoginPage from "./components/LoginPage";
import ReportPage from "./components/ReportPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <LayoutShell>{children}</LayoutShell>;
}

function HomeRoute() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return (
    <LayoutShell>
      <RecruiterDashboard />
    </LayoutShell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<HomeRoute />} />
        <Route path="/report/:sessionId" element={
          <ProtectedRoute><ReportPage /></ProtectedRoute>
        } />
        <Route path="/history/:sessionId" element={
          <Navigate to={`/report/${window.location.pathname.split("/").pop()}?back=history`} replace />
        } />
        <Route path="/interview/:sessionId" element={<CandidateRoom />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
