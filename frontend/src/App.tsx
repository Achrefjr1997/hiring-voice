import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./components/AuthProvider";
import RecruiterDashboard from "./components/RecruiterDashboard";
import CandidateRoom from "./components/CandidateRoom";
import LoginPage from "./components/LoginPage";
import SessionDetail from "./components/SessionDetail";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function HomeRoute() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <RecruiterDashboard />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<HomeRoute />} />
        <Route path="/history/:sessionId" element={
          <ProtectedRoute><SessionDetail /></ProtectedRoute>
        } />
        <Route path="/interview/:sessionId" element={<CandidateRoom />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
