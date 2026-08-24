import type { FaceGeometry } from "./face-anonymizer";
import { computeFaceRegionBounds, drawRoundedRectPath } from "./face-anonymizer-canvas";

let sourceScratchCanvas: HTMLCanvasElement | null = null;
let pixelScratchCanvas: HTMLCanvasElement | null = null;

function getScratchCanvas(
  existingCanvas: HTMLCanvasElement | null,
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = existingCanvas ?? document.createElement("canvas");
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  return canvas;
}

function applyPixelatedFaceRegion(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  geometry: FaceGeometry
): void {
  const { sourceWidth, sourceHeight, sourceX, sourceY } = computeFaceRegionBounds(
    canvas,
    geometry,
    1.16,
    1.14,
    120,
    140
  );
  const scratchWidth = Math.max(1, Math.round(sourceWidth));
  const scratchHeight = Math.max(1, Math.round(sourceHeight));

  sourceScratchCanvas = getScratchCanvas(sourceScratchCanvas, scratchWidth, scratchHeight);
  const sourceContext = sourceScratchCanvas.getContext("2d");
  if (!sourceContext) {
    return;
  }

  sourceContext.clearRect(0, 0, scratchWidth, scratchHeight);
  sourceContext.drawImage(
    canvas,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    scratchWidth,
    scratchHeight
  );

  const pixelWidth = Math.max(16, Math.round(scratchWidth / 22));
  const pixelHeight = Math.max(18, Math.round(scratchHeight / 22));
  pixelScratchCanvas = getScratchCanvas(pixelScratchCanvas, pixelWidth, pixelHeight);
  const pixelContext = pixelScratchCanvas.getContext("2d");
  if (!pixelContext) {
    return;
  }

  pixelContext.imageSmoothingEnabled = false;
  pixelContext.clearRect(0, 0, pixelWidth, pixelHeight);
  pixelContext.drawImage(sourceScratchCanvas, 0, 0, pixelWidth, pixelHeight);

  const maskWidth = geometry.faceWidth;
  const maskHeight = geometry.faceHeight;
  const radius = Math.max(32, geometry.faceWidth * 0.28);

  context.save();
  context.translate(geometry.faceCenterX, geometry.faceCenterY);
  context.rotate(geometry.rotationRadians);
  drawRoundedRectPath(
    context,
    -maskWidth / 2,
    -maskHeight / 2,
    maskWidth,
    maskHeight,
    radius
  );
  context.clip();
  context.imageSmoothingEnabled = false;
  context.drawImage(
    pixelScratchCanvas,
    -maskWidth / 2,
    -maskHeight / 2,
    maskWidth,
    maskHeight
  );
  context.imageSmoothingEnabled = true;

  context.globalAlpha = 0.16;
  context.fillStyle = "rgba(2, 6, 23, 0.9)";
  drawRoundedRectPath(
    context,
    -maskWidth / 2,
    -maskHeight / 2,
    maskWidth,
    maskHeight,
    radius
  );
  context.fill();
  context.restore();
}

export function drawVideoFrameWithPixelatedFace(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  geometry: FaceGeometry | null
): void {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  if (!geometry) {
    return;
  }

  applyPixelatedFaceRegion(context, canvas, geometry);
}
