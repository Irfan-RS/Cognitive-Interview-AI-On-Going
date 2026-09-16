import { useCallback, useEffect, useRef, useState } from "react";
import { detectFaces } from "../lib/faceModel";
import { computeAttentionVector, fitCalibration } from "../lib/gazeBounds";
import { isFaceFullyVisible, embedFace } from "../lib/faceIdentity";
import { checkFaceForCapture } from "./useFaceMonitor";

// Normalized screen positions for the 5 calibration dots — 4 corners plus center.
export const CALIBRATION_POINTS = [
  { key: "top-left", x: 0, y: 0 },
  { key: "top-right", x: 1, y: 0 },
  { key: "bottom-left", x: 0, y: 1 },
  { key: "bottom-right", x: 1, y: 1 },
  { key: "center", x: 0.5, y: 0.5 },
];

const SAMPLES_PER_POINT = 10;
const SAMPLE_INTERVAL_MS = 35;
const LIVE_CHECK_INTERVAL_MS = 400; // polling cadence while waiting to capture the reference face
const REFERENCE_SAMPLES = 5; // spread of reference embeddings captured, not just one frame
const REFERENCE_SAMPLE_INTERVAL_MS = 150;

/**
 * Two-stage calibration:
 *
 * 1. Reference capture — the candidate must be alone in frame, fully visible,
 *    before anything else can happen. This is the face later interview-time
 *    monitoring compares against to catch someone else taking over mid-session.
 * 2. 5-point gaze calibration — the candidate looks at each dot and CLICKS it
 *    themselves to confirm "I'm looking here right now" (rather than the app
 *    guessing when they're ready on a timer), which is what ties a screen
 *    position to a gaze reading. Every sample in the capture window must show
 *    exactly one, fully-visible face — any lapse fails the whole point
 *    immediately, since calibration data captured while the candidate wasn't
 *    cleanly in frame would bake that distortion into the fitted mapping for
 *    the entire interview.
 *
 * Returns a fitted vector->screen mapper and a spread of reference face embeddings
 * once both stages are done.
 */
export default function useCalibration(videoRef) {
  const [stage, setStage] = useState("reference"); // "reference" | "dots" | "done"
  const [liveStatus, setLiveStatus] = useState("no-face"); // "no-face" | "multi-face" | "partial" | "ready"
  const [captureBusy, setCaptureBusy] = useState(false);
  const [referenceEmbeddings, setReferenceEmbeddings] = useState(null);

  const [pointIndex, setPointIndex] = useState(-1);
  const [capturing, setCapturing] = useState(false);
  const [done, setDone] = useState(false);
  const [mapper, setMapper] = useState(null);
  const [captureError, setCaptureError] = useState(null);
  const collected = useRef([]);

  // Live status poll, only while waiting to capture the reference face — drives the
  // capture button's enabled state and the on-screen "no face / multiple faces /
  // partial" feedback before the candidate has clicked anything.
  useEffect(() => {
    if (stage !== "reference" || !videoRef.current) return;

    let cancelled = false;
    let timer;
    const poll = async () => {
      if (cancelled) return;
      const { status } = await checkFaceForCapture(videoRef.current);
      if (!cancelled) setLiveStatus(status);
      timer = setTimeout(poll, LIVE_CHECK_INTERVAL_MS);
    };
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [stage, videoRef]);

  const captureReference = useCallback(async () => {
    if (captureBusy || stage !== "reference") return;
    setCaptureBusy(true);
    setCaptureError(null);

    try {
      // Several samples across a short window, not one frame — the embedder is a
      // general-purpose model, not a dedicated face-recognition one, so its
      // similarity scores for the SAME face vary with ordinary pose/lighting/
      // expression changes. Comparing later frames against a spread of reference
      // samples (best match wins, see faceIdentity.matchesReference) is far less
      // prone to false "unrecognized candidate" flags than comparing against a
      // single reference frame.
      const embeddings = [];
      for (let i = 0; i < REFERENCE_SAMPLES; i++) {
        // Re-check fresh each sample rather than trusting the live poll's last
        // tick — this capture is what everything else gets compared against for
        // the rest of the interview, so every sample in it must be clean.
        const check = await checkFaceForCapture(videoRef.current);
        if (check.status !== "ready") {
          setCaptureError(
            check.status === "no-face"
              ? "Couldn't see your face — make sure you're centered and well lit, then try again."
              : check.status === "multi-face"
                ? "More than one face is visible — only the candidate should be in frame for this."
                : "Part of your face is out of frame — move back a little so your whole face is visible."
          );
          return;
        }

        const embedding = await embedFace(videoRef.current, check.landmarks);
        if (embedding) embeddings.push(embedding);
        await new Promise((r) => setTimeout(r, REFERENCE_SAMPLE_INTERVAL_MS));
      }

      if (embeddings.length === 0) {
        setCaptureError("Couldn't capture a reference photo — please try again.");
        return;
      }

      setReferenceEmbeddings(embeddings);
      setStage("dots");
      setPointIndex(0);
    } catch (err) {
      setCaptureError(err.message || "Something went wrong capturing your reference photo — please try again.");
    } finally {
      setCaptureBusy(false);
    }
  }, [captureBusy, stage, videoRef]);

  const confirmCurrentPoint = useCallback(async () => {
    if (capturing || pointIndex < 0 || pointIndex >= CALIBRATION_POINTS.length) return;
    setCapturing(true);
    setCaptureError(null);

    // try/finally is essential here: if a sample throws (e.g. a transient model
    // hiccup), capturing must still be reset — otherwise the button stays disabled
    // forever and every future click silently no-ops.
    try {
      const vectors = [];
      for (let i = 0; i < SAMPLES_PER_POINT; i++) {
        const faces = await detectFaces(videoRef.current);

        if (faces.length !== 1 || !isFaceFullyVisible(faces[0])) {
          setCaptureError(
            faces.length === 0
              ? "Lost sight of your face mid-capture — make sure you stay in frame, then try again."
              : faces.length > 1
                ? "More than one face was visible — only the candidate should be in frame for this."
                : "Part of your face went out of frame — move back a little, then try again."
          );
          return;
        }

        vectors.push(computeAttentionVector(faces[0]));
        await new Promise((r) => setTimeout(r, SAMPLE_INTERVAL_MS));
      }

      const avg = vectors.reduce(
        (acc, v) => ({ dx: acc.dx + v.dx / vectors.length, dy: acc.dy + v.dy / vectors.length }),
        { dx: 0, dy: 0 }
      );
      collected.current.push({
        vector: avg,
        screen: { x: CALIBRATION_POINTS[pointIndex].x, y: CALIBRATION_POINTS[pointIndex].y },
      });

      if (pointIndex + 1 < CALIBRATION_POINTS.length) {
        setPointIndex(pointIndex + 1);
      } else {
        setMapper(fitCalibration(collected.current));
        setPointIndex(-1);
        setStage("done");
        setDone(true);
      }
    } catch (err) {
      setCaptureError(err.message || "Something went wrong loading eye tracking — please try again.");
    } finally {
      setCapturing(false);
    }
  }, [capturing, pointIndex, videoRef]);

  return {
    stage,
    liveStatus,
    captureBusy,
    captureReference,
    confirmCurrentPoint,
    pointIndex,
    capturing,
    done,
    mapper,
    referenceEmbeddings,
    captureError,
    activePoint: CALIBRATION_POINTS[pointIndex],
  };
}
