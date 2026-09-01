import { useCallback, useRef, useState } from "react";
import { sampleAttentionVector, fitCalibration } from "../lib/gaze";

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

/**
 * Drives the calibration sequence: the candidate looks at each dot and
 * CLICKS it themselves to confirm "I'm looking here right now" — rather than
 * the app guessing when they're ready on a timer — which is what actually
 * ties a screen position to a gaze reading. Returns a fitted vector->screen
 * mapper once all 5 points are confirmed.
 */
export default function useCalibration(videoRef) {
  const [pointIndex, setPointIndex] = useState(-1); // -1 = not started
  const [capturing, setCapturing] = useState(false);
  const [done, setDone] = useState(false);
  const [mapper, setMapper] = useState(null);
  const [captureError, setCaptureError] = useState(null);
  const collected = useRef([]);

  const start = useCallback(() => {
    collected.current = [];
    setCaptureError(null);
    setDone(false);
    setMapper(null);
    setPointIndex(0);
  }, []);

  const confirmCurrentPoint = useCallback(async () => {
    if (capturing || pointIndex < 0 || pointIndex >= CALIBRATION_POINTS.length) return;
    setCapturing(true);
    setCaptureError(null);

    // try/finally is essential here: if face-model loading throws (e.g. no WebGL2,
    // a blocked CDN fetch), capturing must still be reset — otherwise the button
    // stays disabled forever and every future click silently no-ops.
    try {
      const vectors = [];
      for (let i = 0; i < SAMPLES_PER_POINT; i++) {
        const vec = await sampleAttentionVector(videoRef.current, performance.now());
        if (vec) vectors.push(vec);
        await new Promise((r) => setTimeout(r, SAMPLE_INTERVAL_MS));
      }

      if (vectors.length < SAMPLES_PER_POINT * 0.4) {
        setCaptureError(
          "Couldn't see your face clearly — make sure your face is well lit and centered, then try again."
        );
        return;
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
        setDone(true);
      }
    } catch (err) {
      setCaptureError(err.message || "Something went wrong loading eye tracking — please try again.");
    } finally {
      setCapturing(false);
    }
  }, [capturing, pointIndex, videoRef]);

  return {
    start,
    confirmCurrentPoint,
    pointIndex,
    capturing,
    done,
    mapper,
    captureError,
    activePoint: CALIBRATION_POINTS[pointIndex],
  };
}
