import type { FaceLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { MEDIAPIPE_VISION_WASM_BASE_PATH } from "./mediapipe-paths";

const LEFT_EYE_OUTER = 33;
const LEFT_EYE_INNER = 133;
const LEFT_EYE_TOP = 159;
const LEFT_EYE_BOTTOM = 145;
const RIGHT_EYE_INNER = 362;
const RIGHT_EYE_OUTER = 263;
const RIGHT_EYE_TOP = 386;
const RIGHT_EYE_BOTTOM = 374;
const FOREHEAD_TOP = 10;
const CHIN = 152;
const LEFT_FACE_EDGE = 234;
const RIGHT_FACE_EDGE = 454;
const NOSE_TIP = 1;

export interface FaceGeometry {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  rotationRadians: number;
  faceCenterX: number;
  faceCenterY: number;
  faceWidth: number;
  faceHeight: number;
}

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

interface Point {
  x: number;
  y: number;
}

function averagePoints(points: Point[]): Point {
  const total = points.reduce((accumulator, point) => ({
    x: accumulator.x + point.x,
    y: accumulator.y + point.y
  }), { x: 0, y: 0 });

  return {
    x: total.x / points.length,
    y: total.y / points.length
  };
}

function distance(left: Point, right: Point): number {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function pointAt(landmarks: NormalizedLandmark[], index: number, width: number, height: number): Point | null {
  const landmark = landmarks[index];
  if (!landmark) {
    return null;
  }

  return {
    x: landmark.x * width,
    y: landmark.y * height
  };
}

function requiredEyePoints(landmarks: NormalizedLandmark[], width: number, height: number): Point[] | null {
  const points = [
    LEFT_EYE_OUTER,
    LEFT_EYE_INNER,
    LEFT_EYE_TOP,
    LEFT_EYE_BOTTOM,
    RIGHT_EYE_INNER,
    RIGHT_EYE_OUTER,
    RIGHT_EYE_TOP,
    RIGHT_EYE_BOTTOM
  ].map((index) => pointAt(landmarks, index, width, height));

  return points.every(Boolean) ? points as Point[] : null;
}

function requiredFacePoints(landmarks: NormalizedLandmark[], width: number, height: number): Point[] | null {
  const points = [
    FOREHEAD_TOP,
    CHIN,
    LEFT_FACE_EDGE,
    RIGHT_FACE_EDGE,
    NOSE_TIP
  ].map((index) => pointAt(landmarks, index, width, height));

  return points.every(Boolean) ? points as Point[] : null;
}

export function computeFaceGeometry(
  landmarks: NormalizedLandmark[],
  width: number,
  height: number
): FaceGeometry | null {
  const eyePoints = requiredEyePoints(landmarks, width, height);
  const facePoints = requiredFacePoints(landmarks, width, height);
  if (!eyePoints || !facePoints) {
    return null;
  }

  const [
    leftOuter,
    leftInner,
    leftTop,
    leftBottom,
    rightInner,
    rightOuter,
    rightTop,
    rightBottom
  ] = eyePoints;
  const [foreheadTop, chin, leftFaceEdge, rightFaceEdge, noseTip] = facePoints;

  const leftEyeCenter = averagePoints([leftOuter, leftInner, leftTop, leftBottom]);
  const rightEyeCenter = averagePoints([rightOuter, rightInner, rightTop, rightBottom]);
  const eyeDistance = distance(leftEyeCenter, rightEyeCenter);
  if (!Number.isFinite(eyeDistance) || eyeDistance <= 0) {
    return null;
  }

  const eyeCenter = averagePoints([leftEyeCenter, rightEyeCenter]);
  const verticalEyeSpan = Math.max(
    distance(leftTop, leftBottom),
    distance(rightTop, rightBottom)
  );
  const frameWidth = eyeDistance * 2.9;
  const frameHeight = Math.max(42, verticalEyeSpan * 4.4);
  const faceWidth = Math.max(frameWidth * 1.1, distance(leftFaceEdge, rightFaceEdge) * 1.18);
  const faceHeight = Math.max(frameHeight * 2.55, distance(foreheadTop, chin) * 1.18);
  const faceCenterX = averagePoints([leftFaceEdge, rightFaceEdge, noseTip]).x;
  const faceCenterY = (foreheadTop.y + chin.y) / 2 + faceHeight * 0.03;

  return {
    centerX: eyeCenter.x,
    centerY: eyeCenter.y + frameHeight * 0.08,
    width: frameWidth,
    height: frameHeight,
    rotationRadians: Math.atan2(rightEyeCenter.y - leftEyeCenter.y, rightEyeCenter.x - leftEyeCenter.x),
    faceCenterX,
    faceCenterY,
    faceWidth,
    faceHeight
  };
}

export async function loadFaceLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_VISION_WASM_BASE_PATH);
      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
        },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false
      });
    })();
  }

  return landmarkerPromise;
}

export function detectPrimaryFaceGeometry(
  landmarker: FaceLandmarker,
  video: HTMLVideoElement,
  width: number,
  height: number
): FaceGeometry | null {
  const result = landmarker.detectForVideo(video, performance.now());
  const landmarks = result.faceLandmarks.at(0);
  if (!landmarks) {
    return null;
  }

  return computeFaceGeometry(landmarks, width, height);
}
