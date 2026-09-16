import { useEffect, useRef, useState } from "react";
import { detectFaces } from "../lib/faceModel";
import { computeAttentionVector, isWithinBounds } from "../lib/gazeBounds";
import { faceBoundingBox, isFaceFullyVisible, embedFace, matchesReference } from "../lib/faceIdentity";
import { api } from "../lib/api";

const CHECK_INTERVAL_MS = 400;
const REPORT_INTERVAL_MS = 2000;
const NUDGE_AFTER_MS = 2000; // sustained inattention before we bother the candidate
const STATUS_DEBOUNCE_MS = 900; // suppresses single-frame flicker on the live badge —
// MediaPipe's per-frame read is noisy (a blink or micro head movement is enough to
// misclassify one frame), so the badge only flips after the SAME reading holds for
// this long, instead of mirroring every raw frame and looking "wrong" half the time.
const GAZE_SMOOTHING = 0.2; // EMA weight on each new gaze sample — the raw per-frame
// dx/dy estimate jitters enough on its own to occasionally read as "off screen" while
// genuinely looking at the screen; smoothing it before the bounds check removes most
// of that without adding noticeable lag. Lowered from 0.35 (more smoothing, slower to
// react) after real-world testing still showed false "looking away" hits.
const IDENTITY_CHECK_EVERY_N_TICKS = 4; // ~1.6s at CHECK_INTERVAL_MS=400 — embedding a
// face crop is meaningfully heavier than a landmark detection, so it doesn't run
// every tick; it's a "is this still the same person" check, not a per-frame one.
const IDENTITY_MISMATCH_STREAK_REQUIRED = 2; // consecutive failed identity CHECKS
// (so ~2 * IDENTITY_CHECK_EVERY_N_TICKS ticks, ~3.2s) before actually flagging —
// the embedder is a general-purpose model, not a dedicated face-recognition one,
// so any single comparison can read low from ordinary pose/lighting/expression
// changes even for the same person. Only a SUSTAINED run of mismatches, not one
// noisy reading, should ever surface as "this isn't who calibrated".

/**
 * The single continuous "what's happening in frame" loop, used both for calibration's
 * live feedback (videoRef + active only) and full interview monitoring (+ mapper,
 * + referenceEmbeddings, + session ids to report to). One poll loop, one detection
 * call per tick — the gaze-bounds and face-identity interpretation of that one
 * detection result live in their own modules (gazeBounds.js / faceIdentity.js), kept
 * separate from each other and from this hook's scheduling/debounce/reporting glue.
 */
export default function useFaceMonitor({ videoRef, active, mapper = null, referenceEmbeddings = null, sessionId = null, sessionQuestionId = null }) {
  const [inBounds, setInBounds] = useState(true);
  const [faceDetected, setFaceDetected] = useState(true);
  const [multipleFaces, setMultipleFaces] = useState(false);
  const [facePartial, setFacePartial] = useState(false);
  const [identityMismatch, setIdentityMismatch] = useState(false);
  const [showNudge, setShowNudge] = useState(false);

  const awaySinceRef = useRef(null);
  const lastReportRef = useRef(0);
  // status: "no-face" | "multi-face" | "face-partial" | "identity-mismatch" | "face-in" | "face-out"
  const pendingStatusRef = useRef(null); // { status, since }
  const committedStatusRef = useRef("face-in");
  const smoothedRef = useRef(null); // EMA of {dx, dy}
  const tickCountRef = useRef(0);
  const identityMismatchStreakRef = useRef(0); // consecutive failed identity CHECKS (not ticks)

  useEffect(() => {
    if (!active || !videoRef.current) {
      setShowNudge(false);
      return;
    }

    let cancelled = false;
    let timer;

    const tick = async () => {
      if (cancelled) return;
      const faces = await detectFaces(videoRef.current);
      const faceCount = faces.length;
      const primary = faces[0] ?? null;
      const fullyVisible = primary ? isFaceFullyVisible(primary) : false;

      // TEMPORARY diagnostic — remove once multi-face detection is confirmed working.
      if (faceCount !== 1) {
        console.log("[multiface-debug]", {
          faceCount,
          videoSize: videoRef.current ? `${videoRef.current.videoWidth}x${videoRef.current.videoHeight}` : null,
        });
      }

      // Gaze estimate — only meaningful for exactly one, fully-visible face; with
      // zero, multiple, or a cropped face the vector would be noise or ambiguous.
      const canEstimateGaze = mapper && primary && faceCount === 1 && fullyVisible;
      const rawVector = canEstimateGaze ? computeAttentionVector(primary) : null;
      smoothedRef.current = rawVector
        ? smoothedRef.current
          ? {
              dx: smoothedRef.current.dx + GAZE_SMOOTHING * (rawVector.dx - smoothedRef.current.dx),
              dy: smoothedRef.current.dy + GAZE_SMOOTHING * (rawVector.dy - smoothedRef.current.dy),
            }
          : rawVector
        : null;
      const point = mapper && smoothedRef.current ? mapper.estimate(smoothedRef.current) : null;
      const nowInBounds = !!point && isWithinBounds(point);

      // Identity check — throttled, and only attempted when there's exactly one
      // clean, fully-visible face to compare (same reasoning as the gaze estimate).
      tickCountRef.current += 1;
      if (
        referenceEmbeddings?.length &&
        faceCount === 1 &&
        fullyVisible &&
        tickCountRef.current % IDENTITY_CHECK_EVERY_N_TICKS === 0
      ) {
        const embedding = await embedFace(videoRef.current, primary);
        if (embedding) {
          const { matches } = await matchesReference(embedding, referenceEmbeddings);
          identityMismatchStreakRef.current = matches ? 0 : identityMismatchStreakRef.current + 1;
        }
      }
      const identityOk =
        !referenceEmbeddings?.length ||
        faceCount !== 1 ||
        !fullyVisible ||
        identityMismatchStreakRef.current < IDENTITY_MISMATCH_STREAK_REQUIRED;

      if (cancelled) return;
      const now = performance.now();

      // Priority order when several things are true at once: can't-see-anyone and
      // too-many-people are the most fundamental (nothing else can be evaluated
      // reliably), then a cropped face (gaze estimate untrustworthy), then a face
      // that doesn't match who calibrated, then finally plain looking-away.
      const rawStatus =
        faceCount === 0
          ? "no-face"
          : faceCount > 1
            ? "multi-face"
            : !fullyVisible
              ? "face-partial"
              : !identityOk
                ? "identity-mismatch"
                : mapper
                  ? (nowInBounds ? "face-in" : "face-out")
                  : "face-in"; // no mapper (e.g. calibration's live feedback) — nothing to judge in/out of bounds

      if (pendingStatusRef.current?.status !== rawStatus) {
        pendingStatusRef.current = { status: rawStatus, since: now };
      }
      if (now - pendingStatusRef.current.since >= STATUS_DEBOUNCE_MS) {
        committedStatusRef.current = rawStatus;
        setFaceDetected(rawStatus !== "no-face");
        setMultipleFaces(rawStatus === "multi-face");
        setFacePartial(rawStatus === "face-partial");
        setIdentityMismatch(rawStatus === "identity-mismatch");
        setInBounds(rawStatus === "face-in");
      }

      // Nudge banner + persisted report both key off the COMMITTED status, not the
      // raw per-tick read — otherwise a single noisy frame could log a false event
      // even when the live badge never flips.
      const attentive = committedStatusRef.current === "face-in";
      if (!attentive) {
        if (awaySinceRef.current == null) awaySinceRef.current = now;
        setShowNudge(now - awaySinceRef.current >= NUDGE_AFTER_MS);
      } else {
        awaySinceRef.current = null;
        setShowNudge(false);
      }

      if (sessionId && now - lastReportRef.current >= REPORT_INTERVAL_MS) {
        lastReportRef.current = now;
        const status = committedStatusRef.current;
        const reasonByStatus = {
          "no-face": "no_face",
          "multi-face": "multiple_faces",
          "face-partial": "face_partial",
          "identity-mismatch": "identity_mismatch",
          "face-in": "on_screen",
          "face-out": "looking_away",
        };
        api.postMonitoringEvent({
          session_id: sessionId,
          session_question_id: sessionQuestionId,
          in_bounds: status === "face-in",
          gaze_x: point?.x ?? null,
          gaze_y: point?.y ?? null,
          reason: reasonByStatus[status],
        });
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
      tickCountRef.current = 0;
      identityMismatchStreakRef.current = 0;
    };
  }, [active, mapper, referenceEmbeddings, videoRef, sessionId, sessionQuestionId]);

  return { inBounds, faceDetected, multipleFaces, facePartial, identityMismatch, showNudge };
}

/** One-off (non-polling) read of the current frame's face bounding box, for
 * calibration's reference-capture step which needs a single fresh check rather
 * than the continuous loop above. */
export async function checkFaceForCapture(videoEl) {
  const faces = await detectFaces(videoEl);
  if (faces.length === 0) return { status: "no-face", landmarks: null };
  if (faces.length > 1) return { status: "multi-face", landmarks: null };
  const [landmarks] = faces;
  if (!isFaceFullyVisible(landmarks)) return { status: "partial", landmarks };
  return { status: "ready", landmarks, boundingBox: faceBoundingBox(landmarks) };
}
