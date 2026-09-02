import { useEffect, useRef, useState } from "react";
import { sampleAttentionVector, isWithinBounds } from "../lib/gaze";
import { api } from "../lib/api";

const CHECK_INTERVAL_MS = 400;
const REPORT_INTERVAL_MS = 2000;
const NUDGE_AFTER_MS = 2000; // sustained inattention before we bother the candidate
const STATUS_DEBOUNCE_MS = 600; // suppresses single-frame flicker on the live badge —
// MediaPipe's per-frame iris read is noisy (a blink or micro head movement is enough
// to misclassify one frame), so the badge only flips after the SAME reading holds for
// this long, instead of mirroring every raw frame and looking "wrong" half the time.

/** Runs the continuous "is the candidate still looking at the screen" loop while a question is live. */
export default function useGazeMonitor({ videoRef, mapper, active, sessionId, sessionQuestionId }) {
  const [inBounds, setInBounds] = useState(true);
  const [faceDetected, setFaceDetected] = useState(true);
  const [showNudge, setShowNudge] = useState(false);
  const awaySinceRef = useRef(null);
  const lastReportRef = useRef(0);
  const pendingStatusRef = useRef(null); // { status: "face-in" | "face-out" | "no-face", since }

  useEffect(() => {
    if (!active || !mapper || !videoRef.current) {
      setShowNudge(false);
      return;
    }

    let cancelled = false;
    let timer;

    const tick = async () => {
      if (cancelled) return;
      const vector = await sampleAttentionVector(videoRef.current, performance.now());
      const point = vector ? mapper.estimate(vector) : null;
      const faceFound = vector != null;
      const nowInBounds = faceFound && isWithinBounds(point);

      if (!cancelled) {
        const now = performance.now();

        // Debounced badge state: a face genuinely being out of frame is a different
        // situation from being in frame but looking away — don't conflate them, since
        // "looking away" is misleading when the real issue is the camera can't see them.
        const rawStatus = !faceFound ? "no-face" : nowInBounds ? "face-in" : "face-out";
        if (pendingStatusRef.current?.status !== rawStatus) {
          pendingStatusRef.current = { status: rawStatus, since: now };
        }
        if (now - pendingStatusRef.current.since >= STATUS_DEBOUNCE_MS) {
          setFaceDetected(rawStatus !== "no-face");
          setInBounds(rawStatus === "face-in");
        }

        // Nudge banner: sustained inattention (no face OR looking away), unchanged threshold —
        // already resistant to flicker since it resets the moment a single attentive frame lands.
        const attentive = faceFound && nowInBounds;
        if (!attentive) {
          if (awaySinceRef.current == null) awaySinceRef.current = now;
          setShowNudge(now - awaySinceRef.current >= NUDGE_AFTER_MS);
        } else {
          awaySinceRef.current = null;
          setShowNudge(false);
        }

        if (now - lastReportRef.current >= REPORT_INTERVAL_MS) {
          lastReportRef.current = now;
          api.postMonitoringEvent({
            session_id: sessionId,
            session_question_id: sessionQuestionId,
            in_bounds: nowInBounds,
            gaze_x: point?.x ?? null,
            gaze_y: point?.y ?? null,
            reason: !faceFound ? "no_face" : nowInBounds ? "on_screen" : "looking_away",
          });
        }
      }

      timer = setTimeout(tick, CHECK_INTERVAL_MS);
    };

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      // Otherwise stale state survives to the next question/session: if the candidate
      // was away the instant this effect stopped, the next activation would see an
      // ancient timestamp and fire the nudge/badge instantly instead of after a
      // genuine sustained period.
      awaySinceRef.current = null;
      lastReportRef.current = 0;
      pendingStatusRef.current = null;
    };
  }, [active, mapper, videoRef, sessionId, sessionQuestionId]);

  return { inBounds, faceDetected, showNudge };
}
