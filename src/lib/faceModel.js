// Low-level MediaPipe model loading + raw detection. Pure infrastructure —
// no gaze math, no identity logic. gazeBounds.js and faceIdentity.js both
// build on top of this; nothing else should import MediaPipe directly.

let _visionModulePromise = null;
let _landmarkerPromise = null;
let _embedderPromise = null;

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const EMBEDDER_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/image_embedder/mobilenet_v3_small/float32/1/mobilenet_v3_small.tflite";

// Detect up to 3 faces, not 1 — the whole point of multi-face monitoring is
// noticing when someone ELSE is in frame, which is invisible if the model is
// configured to only ever look for one.
const MAX_FACES = 3;

async function getVisionFileset() {
  if (!_visionModulePromise) {
    _visionModulePromise = (async () => {
      const { FilesetResolver } = await import("@mediapipe/tasks-vision");
      return FilesetResolver.forVisionTasks(WASM_BASE);
    })();
  }
  return _visionModulePromise;
}

async function createLandmarker(vision, delegate) {
  const { FaceLandmarker } = await import("@mediapipe/tasks-vision");
  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate },
    // IMAGE mode, not VIDEO — VIDEO mode's internal tracker is built for continuous,
    // evenly-timed frames and smooths a face's position across them, including
    // briefly still "tracking" a face that has actually left the frame or become
    // occluded. This app polls one frame every few hundred ms (sparse, irregular),
    // so that tracking assumption doesn't hold. IMAGE mode has no tracking state:
    // every call is an independent, from-scratch detection on exactly the frame
    // handed to it.
    runningMode: "IMAGE",
    numFaces: MAX_FACES,
    refineLandmarks: true,
  });
}

async function createEmbedder(vision, delegate) {
  const { ImageEmbedder } = await import("@mediapipe/tasks-vision");
  return ImageEmbedder.createFromOptions(vision, {
    baseOptions: { modelAssetPath: EMBEDDER_MODEL_URL, delegate },
    runningMode: "IMAGE",
  });
}

function withGpuFallback(create) {
  let promise;
  const load = async () => {
    const vision = await getVisionFileset();
    // GPU delegate is faster but unsupported on some systems/browsers (no WebGL2,
    // driver blocklisted, etc.) — fall back to CPU rather than failing outright.
    try {
      return await create(vision, "GPU");
    } catch {
      return await create(vision, "CPU");
    }
  };
  return () => {
    if (!promise) {
      promise = load();
      // A cached REJECTED promise would permanently break face tracking for the
      // rest of the session (every future call returns the same failure, with no
      // retry) — so on failure, clear the cache and let the next call try again.
      promise.catch(() => {
        promise = null;
      });
    }
    return promise;
  };
}

const getLandmarker = withGpuFallback(createLandmarker);
const getEmbedder = withGpuFallback(createEmbedder);

/** Kicks off loading both models ahead of time (cached) — call this as soon as a
 * screen that will need face tracking mounts, rather than paying the multi-second
 * cold-load cost silently on the user's first interaction. */
export function preloadFaceModels() {
  return Promise.all([getLandmarker(), getEmbedder()]);
}

function videoFrameReady(videoEl) {
  // MediaPipe's ROI stage throws "width and height must be > 0" if asked to process
  // a frame before the video actually has decoded pixels.
  return !!videoEl && videoEl.readyState >= 2 && videoEl.videoWidth > 0 && videoEl.videoHeight > 0;
}

/** Detects every face in the current video frame. Returns an array of MediaPipe
 * face-mesh landmark arrays (one per face; empty array if none, or the video isn't
 * ready yet). Never throws — a detection failure just reads as "no faces". */
export async function detectFaces(videoEl) {
  if (!videoFrameReady(videoEl)) return [];

  const landmarker = await getLandmarker();
  try {
    const result = landmarker.detect(videoEl);
    return result.faceLandmarks ?? [];
  } catch {
    return [];
  }
}

/** Embeds the face crop described by a normalized region-of-interest
 * ({left, top, right, bottom} in [0,1]) for identity comparison. Returns null on
 * failure (model not loaded, invalid region, etc.) rather than throwing, since a
 * failed embed should read as "can't verify identity right now", not crash the
 * monitoring loop. */
export async function embedFaceRegion(videoEl, regionOfInterest) {
  if (!videoFrameReady(videoEl)) return null;

  const embedder = await getEmbedder();
  try {
    const result = embedder.embed(videoEl, { regionOfInterest });
    return result.embeddings?.[0] ?? null;
  } catch {
    return null;
  }
}

/** Cosine similarity between two embeddings, in [-1, 1] — higher means more alike. */
export async function embeddingSimilarity(a, b) {
  const { ImageEmbedder } = await import("@mediapipe/tasks-vision");
  return ImageEmbedder.cosineSimilarity(a, b);
}
