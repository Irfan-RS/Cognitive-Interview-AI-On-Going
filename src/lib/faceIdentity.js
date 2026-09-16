// Everything about WHO is in frame, as opposed to WHERE they're looking
// (gazeBounds.js): how many faces, whether the primary one is fully visible,
// and whether it still matches the reference face captured at calibration
// time. Kept separate from gaze math on purpose — a candidate letting someone
// else answer for them is a different failure than looking off-screen, and
// the two shouldn't be tangled into one signal.

import { embedFaceRegion, embeddingSimilarity } from "./faceModel";

const FACE_LEFT = 234;
const FACE_RIGHT = 454;
const FACE_TOP = 10;
const FACE_BOTTOM = 152;

// How close a face landmark is allowed to get to the video frame's edge before we
// treat the face as clipped (part of it is out of the camera's view). MediaPipe's
// mesh model will happily extrapolate landmarks for a partially-cropped face rather
// than failing outright, so "a face was detected" alone doesn't mean the whole face
// is visible — we have to check the mesh's own bounding box against the frame.
const FACE_EDGE_MARGIN = 0.035;

// Below this cosine similarity, the current face is treated as NOT the person
// who calibrated. This is a general-purpose image embedder (MobileNetV3), not a
// dedicated face-recognition model like FaceNet/ArcFace — its similarity scores
// for two crops of the SAME face vary a lot more with ordinary pose/lighting/
// expression changes than a purpose-built face-recognition model's would, so this
// threshold is deliberately lenient (a coarse "does this look like a clearly
// different person" signal, not an identity-verification guarantee) and paired
// with matching against several reference samples + requiring sustained
// disagreement before flagging (see useFaceMonitor's mismatch streak) rather than
// trusting any single frame-to-frame comparison. Tune based on real-world rates.
export const IDENTITY_MATCH_THRESHOLD = 0.55;

// The landmark mesh's own bounding box hugs the facial features tightly (eyes,
// brows, jaw) — cropping exactly to it for embedding loses context (hair, ears,
// chin, shoulders) that helps distinguish faces. Pad it out generously before use
// as a region of interest.
const CROP_PADDING = 0.35;

/** The normalized bounding box of one face's landmarks, in the video frame's own [0,1] space. */
export function faceBoundingBox(landmarks) {
  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  for (const p of landmarks) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY };
}

/** Whether a face's whole mesh sits comfortably inside the frame (not cropped by an edge). */
export function isFaceFullyVisible(landmarks) {
  const faceLeft = landmarks[FACE_LEFT];
  const faceRight = landmarks[FACE_RIGHT];
  const faceTop = landmarks[FACE_TOP];
  const faceBottom = landmarks[FACE_BOTTOM];
  // Guard against a degenerate mesh (missing expected indices) reading as "visible".
  if (!faceLeft || !faceRight || !faceTop || !faceBottom) return false;

  const { minX, maxX, minY, maxY } = faceBoundingBox(landmarks);
  return minX > FACE_EDGE_MARGIN && maxX < 1 - FACE_EDGE_MARGIN && minY > FACE_EDGE_MARGIN && maxY < 1 - FACE_EDGE_MARGIN;
}

function paddedRegionOfInterest(bbox) {
  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;
  const padX = width * CROP_PADDING;
  const padY = height * CROP_PADDING;
  return {
    left: Math.max(0, bbox.minX - padX),
    top: Math.max(0, bbox.minY - padY),
    right: Math.min(1, bbox.maxX + padX),
    bottom: Math.min(1, bbox.maxY + padY),
  };
}

/** Embeds one face (by its landmarks) for later identity comparison — used both to
 * capture the calibration-time reference and to check a later frame against it. */
export function embedFace(videoEl, landmarks) {
  const region = paddedRegionOfInterest(faceBoundingBox(landmarks));
  return embedFaceRegion(videoEl, region);
}

/** Compares a freshly-embedded face against a SET of reference embeddings (captured
 * as several samples at calibration time, to average out normal per-frame variation
 * in pose/lighting/expression) and takes the best match among them — the candidate
 * only needs to resemble ONE of their own reference samples, not all of them.
 * Returns { matches, similarity }; similarity is null if there's nothing to compare. */
export async function matchesReference(embedding, referenceEmbeddings) {
  if (!embedding || !referenceEmbeddings?.length) return { matches: true, similarity: null };
  const similarities = await Promise.all(referenceEmbeddings.map((ref) => embeddingSimilarity(embedding, ref)));
  const bestSimilarity = Math.max(...similarities);
  return { matches: bestSimilarity >= IDENTITY_MATCH_THRESHOLD, similarity: bestSimilarity };
}
