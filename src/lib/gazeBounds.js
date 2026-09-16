// Turns one face's MediaPipe landmarks into a 2D "attention vector", and turns
// 5 calibration samples into a fitted vector->screen mapping. Pure math only —
// no face-count, visibility, or identity logic; that's faceIdentity.js's job.
//
// We don't attempt true infrared-grade gaze estimation — that needs specialized
// hardware. Instead we combine two cheap, robust signals from the 478-point face
// mesh into one 2D "attention vector" per frame:
//   - head yaw/pitch: how far the nose tip sits from the face's own center,
//     normalized by face size (turning your head away from the screen)
//   - iris offset: how far the iris centers sit from their eye corners,
//     normalized by eye width (looking away without turning your head)
// The 5-point calibration (4 corners + center) then fits a linear map from that
// vector space to normalized screen space, exactly like calibrating a mouse-free
// pointer: we don't know the camera's intrinsics, but we do know where the user
// was looking at 5 known moments, which is enough to fit a plane.

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

function centroid(points, landmarks) {
  let x = 0;
  let y = 0;
  for (const i of points) {
    x += landmarks[i].x;
    y += landmarks[i].y;
  }
  return { x: x / points.length, y: y / points.length };
}

/** Turns one face's landmarks into a normalized {dx, dy} attention vector. */
export function computeAttentionVector(landmarks) {
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

// This is a heuristic head-pose + iris estimate, not true infrared-grade gaze
// tracking — even with a good calibration it's noisy by nature. A tight margin
// here reads as "constantly told I'm looking away while staring at the screen,"
// which is worse than occasionally missing a genuine glance off-screen. Widened
// from 0.32 after real-world testing still showed false "looking away" hits
// while looking dead at the screen.
export function isWithinBounds(point, margin = 0.45) {
  return point.x >= -margin && point.x <= 1 + margin && point.y >= -margin && point.y <= 1 + margin;
}
