// Client-side face/gaze tracking built on MediaPipe's FaceLandmarker
// (runs fully in-browser via WASM, no frames ever leave the device).
//
// We don't attempt true infrared-grade gaze estimation — that needs
// specialized hardware. Instead we combine two cheap, robust signals from
// the 478-point face mesh into one 2D "attention vector" per frame:
//   - head yaw/pitch: how far the nose tip sits from the face's own center,
//     normalized by face size (turning your head away from the screen)
//   - iris offset: how far the iris centers sit from their eye corners,
//     normalized by eye width (looking away without turning your head)
// The 5-point calibration (4 corners + center) then fits a linear map from
// that vector space to normalized screen space, exactly like calibrating a
// mouse-free pointer: we don't know the camera's intrinsics, but we do know
// where the user was looking at 5 known moments, which is enough to fit a
// plane.

let _visionModulePromise = null;
let _landmarkerPromise = null;

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// Landmark indices from MediaPipe's canonical face mesh topology.
const LEFT_EYE_CORNERS = [33, 133];
const RIGHT_EYE_CORNERS = [362, 263];
const LEFT_EYE_LID = { upper: [160, 158], lower: [144, 153] };
const RIGHT_EYE_LID = { upper: [385, 387], lower: [380, 373] };
const LEFT_IRIS = [468, 469, 470, 471, 472];
const RIGHT_IRIS = [473, 474, 475, 476, 477];
const FACE_LEFT = 234;
const FACE_RIGHT = 454;
const FACE_TOP = 10;
const FACE_BOTTOM = 152;
const NOSE_TIP = 1;

/** Kicks off loading the WASM runtime + face model ahead of time (cached, so a
 * later sampleAttentionVector call reuses it) — call this as soon as a screen
 * that will need face tracking mounts, rather than paying the multi-second
 * cold-load cost silently on the user's first calibration click. */
export function preloadFaceTracking() {
  return getLandmarker();
}

async function createLandmarker(vision, delegate) {
  const { FaceLandmarker } = await import("@mediapipe/tasks-vision");
  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: "VIDEO",
    numFaces: 1,
    refineLandmarks: true,
  });
}

async function getLandmarker() {
  if (_landmarkerPromise) return _landmarkerPromise;

  _landmarkerPromise = (async () => {
    const { FilesetResolver } = await import("@mediapipe/tasks-vision");
    if (!_visionModulePromise) _visionModulePromise = FilesetResolver.forVisionTasks(WASM_BASE);
    const vision = await _visionModulePromise;

    // GPU delegate is faster but unsupported on some systems/browsers (no WebGL2,
    // driver blocklisted, etc.) — fall back to CPU rather than failing outright.
    try {
      return await createLandmarker(vision, "GPU");
    } catch {
      return await createLandmarker(vision, "CPU");
    }
  })();

  // A cached REJECTED promise would permanently break calibration for the rest of
  // the session (every future call returns the same failure, with no retry) — so
  // on failure, clear the cache and let the next call try again from scratch.
  _landmarkerPromise.catch(() => {
    _landmarkerPromise = null;
  });

  return _landmarkerPromise;
}

function centroid(points, landmarks) {
  let x = 0;
  let y = 0;
  for (const i of points) {
    x += landmarks[i].x;
    y += landmarks[i].y;
  }
  return { x: x / points.length, y: y / points.length };
}

/** Reads one video frame and returns a normalized {dx, dy} attention vector, or null if no face was found. */
export async function sampleAttentionVector(videoEl, timestampMs) {
  // MediaPipe's ROI stage throws "width and height must be > 0" if asked to process a
  // frame before the video actually has decoded pixels — guard against that instead of
  // letting one bad frame take down the whole detection graph.
  if (!videoEl || videoEl.readyState < 2 || videoEl.videoWidth === 0 || videoEl.videoHeight === 0) {
    return null;
  }

  const landmarker = await getLandmarker();
  let result;
  try {
    result = landmarker.detectForVideo(videoEl, timestampMs);
  } catch {
    return null;
  }
  const landmarks = result.faceLandmarks?.[0];
  if (!landmarks) return null;

  const faceLeft = landmarks[FACE_LEFT];
  const faceRight = landmarks[FACE_RIGHT];
  const faceTop = landmarks[FACE_TOP];
  const faceBottom = landmarks[FACE_BOTTOM];
  const nose = landmarks[NOSE_TIP];
  const faceWidth = Math.abs(faceRight.x - faceLeft.x) || 1e-6;
  const faceHeight = Math.abs(faceBottom.y - faceTop.y) || 1e-6;
  const faceCenterX = (faceLeft.x + faceRight.x) / 2;
  const faceCenterY = (faceTop.y + faceBottom.y) / 2;

  const headYaw = (nose.x - faceCenterX) / faceWidth;
  const headPitch = (nose.y - faceCenterY) / faceHeight;

  const leftEyeCorners = LEFT_EYE_CORNERS.map((i) => landmarks[i]);
  const rightEyeCorners = RIGHT_EYE_CORNERS.map((i) => landmarks[i]);
  const leftIris = centroid(LEFT_IRIS, landmarks);
  const rightIris = centroid(RIGHT_IRIS, landmarks);

  const leftEyeWidth = Math.abs(leftEyeCorners[1].x - leftEyeCorners[0].x) || 1e-6;
  const rightEyeWidth = Math.abs(rightEyeCorners[1].x - rightEyeCorners[0].x) || 1e-6;
  const leftEyeCenterX = (leftEyeCorners[0].x + leftEyeCorners[1].x) / 2;
  const rightEyeCenterX = (rightEyeCorners[0].x + rightEyeCorners[1].x) / 2;

  const irisOffsetX =
    ((leftIris.x - leftEyeCenterX) / leftEyeWidth + (rightIris.x - rightEyeCenterX) / rightEyeWidth) / 2;

  // Vertical iris offset must be normalized by eye HEIGHT (upper-to-lower lid gap),
  // not eye width — the eye is much wider than it is tall, so dividing a vertical
  // offset by the width compresses it to near-zero and effectively blinds the
  // system to up/down gaze.
  const leftLidUpper = centroid(LEFT_EYE_LID.upper, landmarks);
  const leftLidLower = centroid(LEFT_EYE_LID.lower, landmarks);
  const rightLidUpper = centroid(RIGHT_EYE_LID.upper, landmarks);
  const rightLidLower = centroid(RIGHT_EYE_LID.lower, landmarks);
  const leftEyeHeight = Math.abs(leftLidLower.y - leftLidUpper.y) || 1e-6;
  const rightEyeHeight = Math.abs(rightLidLower.y - rightLidUpper.y) || 1e-6;
  const leftLidMidY = (leftLidUpper.y + leftLidLower.y) / 2;
  const rightLidMidY = (rightLidUpper.y + rightLidLower.y) / 2;

  const irisOffsetY =
    ((leftIris.y - leftLidMidY) / leftEyeHeight + (rightIris.y - rightLidMidY) / rightEyeHeight) / 2;

  return {
    dx: headYaw * 0.6 + irisOffsetX * 0.4,
    dy: headPitch * 0.6 + irisOffsetY * 0.4,
  };
}

/** Solves the 3x3 normal-equations system for a least-squares plane fit a*dx + b*dy + c = target. */
function fitPlane(samples, target) {
  let sxx = 0, sxy = 0, sx = 0, syy = 0, sy = 0, n = samples.length;
  let sxt = 0, syt = 0, st = 0;

  samples.forEach((s, i) => {
    const { dx, dy } = s;
    const t = target[i];
    sxx += dx * dx;
    sxy += dx * dy;
    sx += dx;
    syy += dy * dy;
    sy += dy;
    sxt += dx * t;
    syt += dy * t;
    st += t;
  });

  // Solve [[sxx,sxy,sx],[sxy,syy,sy],[sx,sy,n]] * [a,b,c]^T = [sxt,syt,st]^T via Cramer's rule.
  const A = [
    [sxx, sxy, sx],
    [sxy, syy, sy],
    [sx, sy, n],
  ];
  const B = [sxt, syt, st];

  const det3 = (m) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

  const detA = det3(A);
  if (Math.abs(detA) < 1e-9) return { a: 0, b: 0, c: target.reduce((s, t) => s + t, 0) / n };

  const withCol = (col) => A.map((row, i) => row.map((v, j) => (j === col ? B[i] : v)));
  return {
    a: det3(withCol(0)) / detA,
    b: det3(withCol(1)) / detA,
    c: det3(withCol(2)) / detA,
  };
}

/** Fits a linear map from attention-vector space to normalized [0,1] screen space using 5 calibration points. */
export function fitCalibration(samples) {
  // samples: [{ vector: {dx,dy}, screen: {x,y} }, ...] — one per calibration dot.
  const vectors = samples.map((s) => s.vector);
  const xTargets = samples.map((s) => s.screen.x);
  const yTargets = samples.map((s) => s.screen.y);

  const xFit = fitPlane(vectors, xTargets);
  const yFit = fitPlane(vectors, yTargets);

  return {
    estimate({ dx, dy }) {
      return {
        x: xFit.a * dx + xFit.b * dy + xFit.c,
        y: yFit.a * dx + yFit.b * dy + yFit.c,
      };
    },
  };
}

export function isWithinBounds(point, margin = 0.22) {
  return point.x >= -margin && point.x <= 1 + margin && point.y >= -margin && point.y <= 1 + margin;
}
