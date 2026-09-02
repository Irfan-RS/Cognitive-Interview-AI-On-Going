import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Eye,
  EyeOff,
  Lightbulb,
  MessageCircleQuestion,
  Mic,
  RotateCcw,
  Send,
  Sparkles,
  Square,
} from "lucide-react";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import useGazeMonitor from "../hooks/useGazeMonitor";
import useRecorder from "../hooks/useRecorder";
import { api } from "../lib/api";

function extensionForMimeType(mimeType) {
  // The recorder picks whatever MediaRecorder codec the browser supports
  // (webm/opus on Chrome/Firefox, but Safari falls back to its own default,
  // typically mp4) — sending a filename that doesn't match the real container
  // is misleading at best and a decode mismatch at worst.
  const subtype = mimeType?.split("/")[1]?.split(";")[0];
  return subtype || "webm";
}

function playAudio(blob) {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.play().catch(() => {});
  audio.onended = () => URL.revokeObjectURL(url);
  return audio;
}

export default function InterviewScreen({
  session,
  turn,
  videoRef,
  videoRefCallback,
  stream,
  mapper,
  onTurnChange,
  onSessionComplete,
}) {
  const [phase, setPhase] = useState("asking"); // asking | recording | recorded | analyzing | submitted
  const [hintAvailable, setHintAvailable] = useState(false);
  const [hintText, setHintText] = useState(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [spokenBanner, setSpokenBanner] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedUrl, setRecordedUrl] = useState(null);

  const recorder = useRecorder(stream);
  const gaze = useGazeMonitor({
    videoRef,
    mapper,
    active: phase === "asking" || phase === "recording",
    sessionId: session.id,
    sessionQuestionId: turn.session_question_id,
  });

  const hintTimerRef = useRef(null);
  const autoRecordTimerRef = useRef(null);
  const recordedUrlRef = useRef(null);
  recordedUrlRef.current = recordedUrl;

  useEffect(() => {
    return () => {
      if (recordedUrlRef.current) URL.revokeObjectURL(recordedUrlRef.current);
    };
  }, []);

  const startRecording = useCallback(() => {
    clearTimeout(autoRecordTimerRef.current);
    const started = recorder.start();
    if (started) {
      setPhase("recording");
    } else {
      setPhase("asking");
    }
  }, [recorder]);

  // Reset per-turn state and (re)arm the hint / auto-record timers whenever a new question arrives.
  useEffect(() => {
    setPhase("asking");
    setHintAvailable(false);
    setHintText(null);
    setAnalysis(null);
    setError(null);
    setSpokenBanner(null);
    setRecordedBlob(null);
    setRecordedUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    recorder.reset();

    api.synthesizeSpeech(turn.question_text).then(({ blob }) => playAudio(blob)).catch(() => {});

    if (turn.hints_enabled) {
      hintTimerRef.current = setTimeout(() => setHintAvailable(true), turn.hint_after_seconds * 1000);
    }
    autoRecordTimerRef.current = setTimeout(() => {
      startRecording();
    }, turn.auto_record_after_seconds * 1000);

    return () => {
      clearTimeout(hintTimerRef.current);
      clearTimeout(autoRecordTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn.session_question_id]);

  const handleStop = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await recorder.stop();
      if (!blob) {
        setError(recorder.recordError || "No audio was captured — check your microphone and try again.");
        setPhase("asking");
        return;
      }
      setRecordedUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
      setRecordedBlob(blob);
      setPhase("recorded");
    } finally {
      setBusy(false);
    }
  };

  const handleReRecord = () => {
    setRecordedBlob(null);
    setRecordedUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setError(null);
    setPhase("asking");
  };

  const handleSubmit = async () => {
    if (!recordedBlob) return;
    setPhase("analyzing");
    setBusy(true);
    setError(null);
    try {
      const filename = `answer.${extensionForMimeType(recordedBlob.type)}`;
      const res = await api.submitAnswer(turn.session_question_id, recordedBlob, filename);
      setAnalysis(res.analysis);
      setPhase("submitted");
    } catch (err) {
      setError(err.message);
      setPhase("recorded");
    } finally {
      setBusy(false);
    }
  };

  const handleHint = async () => {
    setHintLoading(true);
    try {
      const res = await api.getHint(turn.session_question_id);
      setHintText(res.hint);
    } catch (err) {
      setError(err.message);
    } finally {
      setHintLoading(false);
    }
  };

  const handleVoiceCommand = async (command) => {
    try {
      const res = await api.voiceCommand(turn.session_question_id, command);
      setSpokenBanner(res.spoken_text);
      const { blob } = await api.synthesizeSpeech(res.spoken_text);
      playAudio(blob);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFollowUp = async () => {
    setBusy(true);
    setError(null);
    try {
      const nextTurn = await api.requestFollowUp(turn.session_question_id);
      onTurnChange(nextTurn);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleNext = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.requestNext(turn.session_question_id);
      if (res.session_completed) {
        onSessionComplete();
      } else {
        onTurnChange(res.current_turn);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const seconds = Math.floor(recorder.elapsedMs / 1000);

  return (
    <div className="relative mx-auto max-w-6xl px-6 py-10">
      {gaze.showNudge && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center px-6">
          <div className="glass-panel animate-rise-in flex items-center gap-3 border-mock-500/40 px-6 py-4 shadow-[0_20px_60px_-15px_rgba(255,107,107,0.5)]">
            <AlertTriangle size={20} className="shrink-0 text-mock-500" />
            <p className="text-sm font-medium text-white text-balance">
              {gaze.faceDetected
                ? "Eye contact shows confidence — look back at the screen"
                : "We can't see your face — make sure you're centered in the camera"}
            </p>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide ${
              session.mode === "mock"
                ? "border-mock-500/40 bg-mock-500/10 text-mock-500"
                : "border-practice-500/40 bg-practice-500/10 text-practice-500"
            }`}
          >
            {session.mode}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] uppercase tracking-wide text-mist-500">Difficulty</span>
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-3 rounded-full transition-colors ${
                    i < turn.difficulty ? "bg-brand-400" : "bg-ink-600"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {turn.source_project_title && (
            <span className="flex items-center gap-1 rounded-full bg-glow-400/15 px-3 py-1 text-xs font-medium text-glow-400">
              <Briefcase size={12} />
              {turn.source_project_title}
            </span>
          )}
          {turn.is_follow_up && (
            <span className="flex items-center gap-1 rounded-full bg-brand-500/15 px-3 py-1 text-xs font-medium text-brand-300">
              <MessageCircleQuestion size={12} />
              Follow-up
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="flex flex-col gap-6">
        <Card className="animate-rise-in">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/15 text-brand-300">
              <Sparkles size={15} strokeWidth={1.75} />
            </span>
            <p className="text-xs font-semibold uppercase tracking-wide text-mist-400">Question</p>
          </div>
          <p className="mt-4 text-xl font-medium text-white text-balance">{turn.question_text}</p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => handleVoiceCommand("repeat")}>
              <RotateCcw size={14} />
              Repeat
            </Button>
            <Button variant="ghost" onClick={() => handleVoiceCommand("rephrase")}>
              Rephrase
            </Button>
          </div>

          {spokenBanner && (
            <p className="mt-3 rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-mist-300">
              "{spokenBanner}"
            </p>
          )}
        </Card>

        <div className="animate-rise-in relative overflow-hidden rounded-2xl border border-ink-600 bg-ink-900 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.7)]">
          <video
            ref={videoRefCallback}
            autoPlay
            muted
            playsInline
            className="aspect-video w-full scale-x-[-1] object-cover"
          />

          {(phase === "asking" || phase === "recording") && mapper && (
            <div
              className={`absolute right-3 top-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur transition-colors ${
                gaze.inBounds ? "bg-practice-500/20 text-practice-500" : "bg-mock-500/20 text-mock-500"
              }`}
            >
              {gaze.inBounds ? <Eye size={12} /> : <EyeOff size={12} />}
              {!gaze.faceDetected ? "Face not detected" : gaze.inBounds ? "On screen" : "Looking away"}
            </div>
          )}

          {phase === "recording" && (
            <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-ink-950/80 px-3 py-1.5 text-xs text-white backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mock-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-mock-500" />
              </span>
              Recording · {seconds}s
            </div>
          )}
        </div>

        {(phase === "asking" || phase === "recording") && (
          <div className="animate-rise-in flex items-center gap-3">
            {phase === "asking" ? (
              <Button variant="primary" onClick={startRecording} disabled={!stream}>
                <Mic size={16} />
                Start recording
              </Button>
            ) : (
              <Button variant="primary" onClick={handleStop} disabled={busy}>
                <Square size={16} />
                Stop recording
              </Button>
            )}

            {turn.hints_enabled && (
              <Button
                variant="ghost"
                onClick={handleHint}
                disabled={!hintAvailable || hintLoading}
                className={
                  hintAvailable && !hintText ? "border-practice-500 text-practice-500 animate-soft-pulse" : ""
                }
              >
                <Lightbulb size={16} />
                {hintLoading ? "Thinking…" : "Hint"}
              </Button>
            )}
          </div>
        )}

        {phase === "recorded" && recordedUrl && (
          <div className="glass-panel animate-rise-in flex flex-col gap-3 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-mist-400">Review your answer</p>
            <audio controls src={recordedUrl} className="w-full" />
            <div className="flex gap-3">
              <Button variant="ghost" onClick={handleReRecord}>
                <RotateCcw size={16} />
                Re-record
              </Button>
              <Button variant="primary" onClick={handleSubmit} disabled={busy}>
                <Send size={16} />
                Submit answer
              </Button>
            </div>
          </div>
        )}

        {phase === "analyzing" && (
          <div className="glass-panel animate-rise-in flex items-center gap-3 p-4 text-sm text-mist-300">
            <span className="relative flex h-4 w-4 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-50" />
              <span className="relative inline-flex h-4 w-4 rounded-full bg-brand-500" />
            </span>
            Transcribing and analyzing your answer…
          </div>
        )}

        {hintText && (
          <div className="animate-rise-in rounded-xl border border-practice-500/40 bg-practice-500/10 px-4 py-3 text-sm text-mist-100">
            <span className="font-semibold text-practice-500">Hint:</span> {hintText}
          </div>
        )}

        {error && (
          <div className="animate-rise-in rounded-xl border border-mock-500/40 bg-mock-500/10 px-4 py-3 text-sm text-mock-500">
            {error}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <Card className="animate-rise-in">
          <p className="text-xs font-semibold uppercase tracking-wide text-mist-400">Live transcript</p>
          <p className="mt-3 min-h-[4rem] text-sm text-mist-200">
            {analysis
              ? analysis.transcript || "No speech was detected in your recording."
              : "Your transcribed answer will appear here after you submit."}
          </p>
        </Card>

        {analysis && (
          <Card className="animate-rise-in flex flex-col gap-4">
            {!analysis.transcript && (
              <div className="rounded-xl border border-mock-500/40 bg-mock-500/10 px-4 py-3 text-sm text-mock-500">
                You didn't answer this question — no speech was detected in your recording.
              </div>
            )}

            <div className="rounded-xl border border-brand-500/20 bg-brand-500/10 py-3 text-center">
              <p className="text-2xl font-semibold text-brand-300">{analysis.overall_score}/100</p>
              <p className="mt-0.5 text-xs text-mist-400">Overall score</p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 py-3">
                <p className="text-amber-400 text-lg font-semibold">{analysis.category_scores.technical}%</p>
                <p className="mt-0.5 text-mist-400">Technical</p>
              </div>
              <div className="rounded-xl border border-glow-400/20 bg-glow-400/10 py-3">
                <p className="text-glow-400 text-lg font-semibold">{analysis.category_scores.cognitive}%</p>
                <p className="mt-0.5 text-mist-400">Cognitive</p>
              </div>
              <div className="rounded-xl border border-practice-500/20 bg-practice-500/10 py-3">
                <p className="text-lg font-semibold text-practice-500">{analysis.category_scores.communication}%</p>
                <p className="mt-0.5 text-mist-400">Communication</p>
              </div>
              <div className="rounded-xl border border-brand-500/20 bg-brand-500/10 py-3">
                <p className="text-lg font-semibold text-brand-300">{analysis.category_scores.adaptability}%</p>
                <p className="mt-0.5 text-mist-400">Adaptability</p>
              </div>
            </div>

            <p className="flex items-center gap-1.5 text-xs text-mist-500">
              <Eye size={12} />
              Eye contact (not part of your score) · {Math.round(analysis.eye_contact_ratio * 100)}% on screen
            </p>

            {analysis.grammar_issues?.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-mist-400">Grammar</p>
                <ul className="mt-1 list-inside list-disc text-sm text-mist-300">
                  {analysis.grammar_issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}

            {Object.keys(analysis.filler_words || {}).length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-mist-400">Filler words</p>
                <p className="mt-1 text-sm text-mist-300">
                  {Object.entries(analysis.filler_words)
                    .map(([word, count]) => `"${word}" ×${count}`)
                    .join(", ")}
                  {analysis.pause_count > 0 && ` · ${analysis.pause_count} pauses`}
                </p>
              </div>
            )}

            {analysis.llm_model_solution && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-mist-400">Model solution</p>
                <p className="mt-1 text-sm text-mist-300">{analysis.llm_model_solution}</p>
              </div>
            )}

            <div className="flex gap-3 border-t border-ink-700 pt-4">
              <Button variant="ghost" onClick={handleFollowUp} disabled={busy}>
                <MessageCircleQuestion size={16} />
                Follow-up question
              </Button>
              <Button variant="primary" onClick={handleNext} disabled={busy}>
                Next question
                <ArrowRight size={16} />
              </Button>
            </div>
          </Card>
        )}
      </div>
      </div>
    </div>
  );
}
