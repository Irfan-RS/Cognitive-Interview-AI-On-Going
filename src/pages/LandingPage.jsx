import { useNavigate } from "react-router-dom";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import Hero from "../components/sections/Hero";
import Problem from "../components/sections/Problem";
import HowItWorks from "../components/sections/HowItWorks";
import Modes from "../components/sections/Modes";
import Tracks from "../components/sections/Tracks";
import Monitoring from "../components/sections/Monitoring";
import Intelligence from "../components/sections/Intelligence";
import VoicePipeline from "../components/sections/VoicePipeline";
import QuestionBank from "../components/sections/QuestionBank";
import Architecture from "../components/sections/Architecture";
import Deployment from "../components/sections/Deployment";
import FinalCta from "../components/sections/FinalCta";

export default function LandingPage() {
  const navigate = useNavigate();
  const startApp = () => navigate("/app");

  return (
    <div className="min-h-screen bg-ink-950">
      <Navbar onStart={startApp} />
      <main>
        <Hero onStart={startApp} />
        <Problem />
        <HowItWorks />
        <Modes />
        <Tracks />
        <Monitoring />
        <Intelligence />
        <VoicePipeline />
        <QuestionBank />
        <Architecture />
        <Deployment />
        <FinalCta onStart={startApp} />
      </main>
      <Footer />
    </div>
  );
}
