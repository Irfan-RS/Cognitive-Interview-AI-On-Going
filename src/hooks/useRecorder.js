import { useCallback, useEffect, useRef, useState } from "react";

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];

function pickMimeType() {
  return MIME_CANDIDATES.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || "";
}

/** Wraps MediaRecorder for a single answer: manual start/stop, plus an optional auto-start timer. */
export default function useRecorder(stream) {
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [recordError, setRecordError] = useState(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const startTimeRef = useRef(0);
  const tickRef = useRef(null);

  /** Returns true if recording actually started — callers must check this rather than
   * assume success, since a missing/track-less mic stream fails MediaRecorder.start()
   * silently from the UI's point of view otherwise. */
  const start = useCallback(() => {
    if (recorderRef.current) return true;
    setRecordError(null);

    const audioTracks = stream?.getAudioTracks?.() || [];
    if (audioTracks.length === 0) {
      setRecordError("No microphone track available — check that mic access was granted.");
      return false;
    }

    try {
      const audioStream = new MediaStream(audioTracks);
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(audioStream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onerror = (e) => setRecordError(e.error?.message || "Recording failed unexpectedly.");

      recorder.start();
      recorderRef.current = recorder;
      startTimeRef.current = performance.now();
      setElapsedMs(0);
      setRecording(true);
      tickRef.current = setInterval(() => setElapsedMs(performance.now() - startTimeRef.current), 200);
      return true;
    } catch (err) {
      setRecordError(err.message || "Couldn't start recording.");
      return false;
    }
  }, [stream]);

  const stop = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder) {
        resolve(null);
        return;
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        recorderRef.current = null;
        clearInterval(tickRef.current);
        setRecording(false);
        resolve(blob.size > 0 ? blob : null);
      };
      recorder.stop();
    });
  }, []);

  const reset = useCallback(() => {
    chunksRef.current = [];
    setElapsedMs(0);
    setRecordError(null);
  }, []);

  useEffect(() => () => clearInterval(tickRef.current), []);

  return { recording, elapsedMs, recordError, start, stop, reset };
}
