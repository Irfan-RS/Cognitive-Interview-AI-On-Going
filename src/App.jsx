import { Route, Routes } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import InterviewApp from "./pages/InterviewApp";
import Dashboard from "./pages/Dashboard";
import SessionDetail from "./pages/SessionDetail";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/app" element={<InterviewApp />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/dashboard/:sessionId" element={<SessionDetail />} />
    </Routes>
  );
}
