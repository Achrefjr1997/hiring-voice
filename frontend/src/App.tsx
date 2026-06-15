import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import RecruiterDashboard from "./components/RecruiterDashboard";
import CandidateRoom from "./components/CandidateRoom";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RecruiterDashboard />} />
        <Route path="/interview/:sessionId" element={<CandidateRoom />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
