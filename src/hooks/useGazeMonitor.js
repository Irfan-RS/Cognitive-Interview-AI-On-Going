import { useEffect, useRef, useState } from "react";
import { sampleAttentionVector, isWithinBounds } from "../lib/gaze";
import { api } from "../lib/api";

const CHECK_INTERVAL_MS = 400;
const REPORT_INTERVAL_MS = 2000;
const NUDGE_AFTER_MS = 2000; // sustained inattention before we bother the candidate
const STATUS_DEBOUNCE_MS = 900; // suppresses single-frame flicker on the live badge —
// MediaPipe's per-frame iris read is noisy (a blink or micro head movement is enough
// to misclassify one frame), so the badge only flips after the SAME reading holds for
// this long, instead of mirroring every raw frame and looking "wrong" half the time.
const GAZE_SMOOTHING = 0.35; // EMA weight on each new sample — the raw per-frame
// dx/dy estimate jitters enough on its own to occasionally read as "off screen"
// while genuinely looking at the screen; smoothing it before the bounds check
// removes most of that without adding noticeable lag.

/** Runs the continuous "is the candidate still looking at the screen" loop while a question is live. */
export default function useGazeMonitor({ videoRef, mapper, active, sessionId, sessionQuestionId }) {
  const [inBounds, setInBounds] = useState(true);
  const [faceDetected, setFaceDetected] = useState(true);
  const [facePartial, setFacePartial] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const awaySinceRef = useRef(null);
  const lastReportRef = useRef(0);
  const pendingStatusRef = useRef(null); // { status: "face-in" | "face-out" | "face-partial" | "no-face", since }
  const committedStatusRef = useRef("face-in"); // last DEBOUNCED status — what the badge/report/nudge actually act on
  const smoothedRef = useRef(null); // EMA of {dx, dy}, so one noisy frame can't swing the estimate on its own

  useEffect(() => {
    if (!active || !mapper || !videoRef.current) {
      setShowNudge(false);
      return;
    }

    let cancelled = false;
    let timer;

    const tick = async () => {
      if (cancelled) return;
      const raw = await sampleAttentionVector(videoRef.current, performance.now());
      const faceFound = raw != null;

      smoothedRef.current = faceFound
        ? smoothedRef.current
          ? {
              dx: smoothedRef.current.dx + GAZE_SMOOTHING * (raw.dx - smoothedRef.current.dx),
              dy: smoothedRef.current.dy + GAZE_SMOOTHING * (raw.dy - smoothedRef.current.dy),
            }
          : { dx: raw.dx, dy: raw.dy }
        : null;

      const point = smoothedRef.current ? mapper.estimate(smoothedRef.current) : null;
      const nowInBounds = faceFound && isWithinBounds(point);
      const fullyVisible = !faceFound || raw.faceFullyVisible;

      if (!cancelled) {
        const now = performance.now();

        // Debounced status: a face genuinely being out of frame, only PARTLY in frame
        // (too close / off-center — the gaze estimate itself is unreliable then), and
        // in frame but looking away are three different situations — conflating any of
        // them as "looking away" is misleading about what's actually wrong.
        const rawStatus = !faceFound
          ? "no-face"
          : !fullyVisible
            ? "face-partial"
            : nowInBounds
              ? "face-in"
              : "face-out";
        if (pendingStatusRef.current?.status !== rawStatus) {
          pendingStatusRef.current = { status: rawStatus, since: now };
        }
        if (now - pendingStatusRef.current.since >= STATUS_DEBOUNCE_MS) {
          committedStatusRef.current = rawStatus;
          setFaceDetected(rawStatus !== "no-face");
          setFacePartial(rawStatus === "face-partial");
          setInBounds(rawStatus === "face-in");
        }

        // Nudge banner + persisted report both key off the COMMITTED status, not the
        // raw per-tick read — otherwise a single noisy frame could log a false
        // "looking_away" event even when the live badge never flips.
        const attentive = committedStatusRef.current === "face-in";
        if (!attentive) {
          if (awaySinceRef.current == null) awaySinceRef.current = now;
          setShowNudge(now - awaySinceRef.current >= NUDGE_AFTER_MS);
        } else {
          awaySinceRef.current = null;
          setShowNudge(false);
        }

        if (now - lastReportRef.current >= REPORT_INTERVAL_MS) {
          lastReportRef.current = now;
          const status = committedStatusRef.current;
          api.postMonitoringEvent({
            session_id: sessionId,
            session_question_id: sessionQuestionId,
            in_bounds: status === "face-in",
            gaze_x: point?.x ?? null,
            gaze_y: point?.y ?? null,
            reason:
              status === "no-face"
                ? "no_face"
                : status === "face-partial"
                  ? "face_partial"
                  : status === "face-in"
                    ? "on_screen"
                    : "looking_away",
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
      committedStatusRef.current = "face-in";
      smoothedRef.current = null;
    };
  }, [active, mapper, videoRef, sessionId, sessionQuestionId]);

  return { inBounds, faceDetected, facePartial, showNudge };
}
