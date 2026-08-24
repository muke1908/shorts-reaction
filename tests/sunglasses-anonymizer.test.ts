import test from "node:test";
import assert from "node:assert/strict";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { computeFaceGeometry } from "../src/ui/lib/face-anonymizer";

function createLandmarks(): NormalizedLandmark[] {
  return Array.from({ length: 400 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
}

test("computeFaceGeometry anchors anonymizers from face and eye landmarks", () => {
  const landmarks = createLandmarks();
  landmarks[1] = { x: 0.5, y: 0.5, z: 0, visibility: 1 };
  landmarks[10] = { x: 0.5, y: 0.18, z: 0, visibility: 1 };
  landmarks[152] = { x: 0.5, y: 0.8, z: 0, visibility: 1 };
  landmarks[234] = { x: 0.28, y: 0.48, z: 0, visibility: 1 };
  landmarks[454] = { x: 0.72, y: 0.48, z: 0, visibility: 1 };
  landmarks[33] = { x: 0.36, y: 0.4, z: 0, visibility: 1 };
  landmarks[133] = { x: 0.44, y: 0.4, z: 0, visibility: 1 };
  landmarks[159] = { x: 0.4, y: 0.38, z: 0, visibility: 1 };
  landmarks[145] = { x: 0.4, y: 0.42, z: 0, visibility: 1 };
  landmarks[362] = { x: 0.56, y: 0.41, z: 0, visibility: 1 };
  landmarks[263] = { x: 0.64, y: 0.41, z: 0, visibility: 1 };
  landmarks[386] = { x: 0.6, y: 0.39, z: 0, visibility: 1 };
  landmarks[374] = { x: 0.6, y: 0.43, z: 0, visibility: 1 };

  const geometry = computeFaceGeometry(landmarks, 1000, 1000);

  assert.ok(geometry);
  assert.ok(Math.abs(geometry.centerX - 500) < 10);
  assert.ok(Math.abs(geometry.centerY - 409) < 20);
  assert.ok(geometry.width > 300);
  assert.ok(geometry.height >= 26);
  assert.ok(Math.abs(geometry.faceCenterX - 500) < 10);
  assert.ok(Math.abs(geometry.faceCenterY - 508) < 25);
  assert.ok(geometry.faceWidth > geometry.width);
  assert.ok(geometry.faceHeight > geometry.height * 2);
  assert.ok(geometry.rotationRadians > 0);
});
