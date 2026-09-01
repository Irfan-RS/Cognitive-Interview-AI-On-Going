import { useEffect, useRef, useState } from "react";
import { sampleAttentionVector, isWithinBounds } from "../lib/gaze";
import { api } from "../lib/api";

const CHECK_INTERVAL_MS = 400;
const REPORT_INTERVAL_MS = 2000;
const NUDGE_AFTER_MS = 2000; // sustained out-of-bounds before we bother the candidate

/** Runs the continuous "is the candidate still looking at the screen" loop while a question is live. */
export default function useGazeMonitor({ videoRef, mapper, active, sessionId, sessionQuestionId }) {
  const [inBounds, setInBounds] = useState(true);
  const [showNudge, setShowNudge] = useState(false);
  const outOfBoundsSinceRef = useRef(null);
  const lastReportRef = useRef(0);

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
      const nowInBounds = point ? isWithinBounds(point) : false;

      if (!cancelled) {
        setInBounds(nowInBounds);

        const now = performance.now();
        if (!nowInBounds) {
          if (outOfBoundsSinceRef.current == null) outOfBoundsSinceRef.current = now;
          setShowNudge(now - outOfBoundsSinceRef.current >= NUDGE_AFTER_MS);
        } else {
          outOfBoundsSinceRef.current = null;
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
            reason: nowInBounds ? "on_screen" : "looking_away",
          });
        }
      }

      timer = setTimeout(tick, CHECK_INTERVAL_MS);
    };

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active, mapper, videoRef, sessionId, sessionQuestionId]);

  return { inBounds, showNudge };
}
