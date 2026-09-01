import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Requests camera + mic once and hands back a live stream plus:
 *   - videoRef: a plain ref object other hooks read `.current` from (gaze sampling)
 *   - videoRefCallback: the ref to actually pass to <video ref={...}> — the
 *     interview flow mounts a fresh <video> element per screen (none on
 *     Setup, one on Calibration, another on Interview), so attaching
 *     srcObject only on `stream` changing (a plain useEffect) misses every
 *     later remount. A callback ref re-attaches on every mount instead.
 */
export default function useMediaStream() {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | requesting | granted | denied
  const videoRef = useRef(null);

  const videoRefCallback = useCallback(
    (node) => {
      videoRef.current = node;
      if (node && stream) node.srcObject = stream;
    },
    [stream]
  );

  const requestAccess = async () => {
    setStatus("requesting");
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: true,
      });
      setStream(mediaStream);
      setStatus("granted");
      return mediaStream;
    } catch (err) {
      setError(err.message || "Camera/microphone access was denied.");
      setStatus("denied");
      return null;
    }
  };

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [stream]);

  return { stream, error, status, videoRef, videoRefCallback, requestAccess };
}
