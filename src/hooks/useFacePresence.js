import { useEffect, useRef, useState } from "react";
import { sampleAttentionVector } from "../lib/gaze";

const CHECK_INTERVAL_MS = 400;
const ABSENT_AFTER_MS = 800; // sustained no-face before flagging — avoids single-frame flicker

/**
 * Lightweight "is a face currently visible" poll, independent of a fitted gaze
 * mapper — useGazeMonitor needs one (to classify on/off screen), but calibration
 * runs before a mapper exists, and still needs live feedback that the camera
 * can actually see the candidate.
 */
export default function useFacePresence(videoRef, active) {
  const [faceDetected, setFaceDetected] = useState(true);
  const [facePartial, setFacePartial] = useState(false);
  const absentSinceRef = useRef(null);
  const partialSinceRef = useRef(null);

  useEffect(() => {
    if (!active || !videoRef.current) {
      setFaceDetected(true);
      setFacePartial(false);
      return;
    }

    let cancelled = false;
    let timer;

    const tick = async () => {
      if (cancelled) return;
      const vector = await sampleAttentionVector(videoRef.current, performance.now());

      if (!cancelled) {
        const now = performance.now();
        if (!vector) {
          if (absentSinceRef.current == null) absentSinceRef.current = now;
          setFaceDetected(now - absentSinceRef.current < ABSENT_AFTER_MS);
          partialSinceRef.current = null;
          setFacePartial(false);
        } else {
          absentSinceRef.current = null;
          setFaceDetected(true);
          if (!vector.faceFullyVisible) {
            if (partialSinceRef.current == null) partialSinceRef.current = now;
            setFacePartial(now - partialSinceRef.current >= ABSENT_AFTER_MS);
          } else {
            partialSinceRef.current = null;
            setFacePartial(false);
          }
        }
      }

      timer = setTimeout(tick, CHECK_INTERVAL_MS);
    };

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      absentSinceRef.current = null;
      partialSinceRef.current = null;
    };
  }, [active, videoRef]);

  return { faceDetected, facePartial };
}
