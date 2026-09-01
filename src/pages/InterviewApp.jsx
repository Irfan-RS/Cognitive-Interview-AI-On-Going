import { useEffect, useRef, useState } from "react";
import { Mic, TimerOff, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import useMediaStream from "../hooks/useMediaStream";
import SetupScreen from "./SetupScreen";
import CalibrationScreen from "./CalibrationScreen";
import InterviewScreen from "./InterviewScreen";
import Stepper from "../components/ui/Stepper";
import { api } from "../lib/api";

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// step: "setup" -> "calibrate" -> "interview" -> (navigates to /dashboard/:id on completion)
export default function InterviewApp() {
  const navigate = useNavigate();
  const [step, setStep] = useState("setup");
  const [session, setSession] = useState(null);
  const [turn, setTurn] = useState(null);
  const [mapper, setMapper] = useState(null);
  const [error, setError] = useState(null);
  const [remainingMs, setRemainingMs] = useState(null);
  const endingRef = useRef(false);

  const media = useMediaStream();
  const goHome = () => navigate("/");

  const handleBegin = async (payload) => {
    setError(null);
    try {
      const res = await api.createSession(payload);
      setSession(res);
      setTurn(res.current_turn);
      setStep("calibrate");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCalibrated = (fittedMapper) => {
    setMapper(fittedMapper);
    setStep("interview");
  };

  // The session bank was exhausted server-side (backend already marked it completed).
  const handleSessionComplete = () => {
    navigate(`/dashboard/${session.id}`);
  };

  // The candidate ended early, or the duration timer ran out — the backend
  // session is still "active" in either case, so it must be explicitly closed.
  const handleEndInterview = async () => {
    if (endingRef.current || !session) return;
    endingRef.current = true;
    try {
      await api.completeSession(session.id);
    } catch {
      // Best-effort — still take the candidate to their report even if this call failed;
      // the dashboard report will simply reflect whatever the session's actual state was.
    }
    navigate(`/dashboard/${session.id}`);
  };

  useEffect(() => {
    if (step !== "interview" || !session) {
      setRemainingMs(null);
      return;
    }

    const endsAt = new Date(session.created_at).getTime() + session.duration_minutes * 60 * 1000;
    const tick = () => {
      const left = endsAt - Date.now();
      setRemainingMs(left);
      if (left <= 0) handleEndInterview();
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, session]);

  return (
    <div className="relative min-h-screen bg-ink-950">
      <div className="ambient-glow" />

      <div className="sticky top-0 z-40 flex items-center justify-between gap-4 border-b border-ink-700/80 bg-ink-950/80 px-4 py-3 backdrop-blur-xl sm:px-6">
        <span className="flex shrink-0 items-center gap-2 text-sm font-semibold text-white">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-glow-400 shadow-[0_0_16px_-2px_rgba(109,91,255,0.7)]">
            <Mic size={14} strokeWidth={2.25} />
          </span>
          <span className="hidden sm:inline">Cognitive Interview AI</span>
        </span>

        <Stepper current={step} />

        <div className="flex shrink-0 items-center gap-2">
          {step === "interview" && remainingMs != null && (
            <span
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold tabular-nums ${
                remainingMs < 60000
                  ? "border-mock-500/40 bg-mock-500/10 text-mock-500"
                  : "border-ink-600 text-mist-300"
              }`}
            >
              {formatCountdown(remainingMs)}
            </span>
          )}

          {step === "interview" ? (
            <button
              onClick={handleEndInterview}
              className="flex items-center gap-1.5 rounded-full border border-ink-600 px-3 py-1.5 text-xs font-medium text-mist-400 transition-colors hover:border-mock-500/50 hover:text-mock-500"
            >
              <TimerOff size={14} />
              <span className="hidden sm:inline">End interview</span>
            </button>
          ) : (
            <button
              onClick={goHome}
              className="flex items-center gap-1.5 rounded-full border border-ink-600 px-3 py-1.5 text-xs font-medium text-mist-400 transition-colors hover:border-mock-500/50 hover:text-mock-500"
            >
              <X size={14} />
              <span className="hidden sm:inline">Exit</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="animate-rise-in mx-auto mt-4 max-w-3xl rounded-xl border border-mock-500/40 bg-mock-500/10 px-4 py-3 text-sm text-mock-500">
          {error}
        </div>
      )}

      {step === "setup" && (
        <div key="setup" className="animate-rise-in">
          <SetupScreen
            mediaStatus={media.status}
            mediaError={media.error}
            onRequestMedia={media.requestAccess}
            onBegin={handleBegin}
          />
        </div>
      )}

      {step === "calibrate" && (
        <CalibrationScreen
          videoRef={media.videoRef}
          videoRefCallback={media.videoRefCallback}
          onCalibrated={handleCalibrated}
          onExit={goHome}
        />
      )}

      {step === "interview" && session && turn && (
        <div key="interview" className="animate-rise-in">
          <InterviewScreen
            session={session}
            turn={turn}
            videoRef={media.videoRef}
            videoRefCallback={media.videoRefCallback}
            stream={media.stream}
            mapper={mapper}
            onTurnChange={setTurn}
            onSessionComplete={handleSessionComplete}
          />
        </div>
      )}
    </div>
  );
}
