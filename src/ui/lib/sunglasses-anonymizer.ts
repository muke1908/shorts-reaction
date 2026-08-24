import type { FaceGeometry } from "./face-anonymizer";
import { computeFaceRegionBounds, drawRoundedRectPath } from "./face-anonymizer-canvas";

let sunglassesImagePromise: Promise<HTMLImageElement> | null = null;
let scratchCanvas: HTMLCanvasElement | null = null;

export async function loadSunglassesOverlayImage(): Promise<HTMLImageElement> {
  if (!sunglassesImagePromise) {
    sunglassesImagePromise = new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not load the SVG sunglasses overlay."));
      image.src = new URL("../assets/sunglasses.svg", import.meta.url).href;
    });
  }

  return sunglassesImagePromise;
}

function getScratchCanvas(width: number, height: number): HTMLCanvasElement {
  if (!scratchCanvas) {
    scratchCanvas = document.createElement("canvas");
  }

  if (scratchCanvas.width !== width || scratchCanvas.height !== height) {
    scratchCanvas.width = width;
    scratchCanvas.height = height;
  }

  return scratchCanvas;
}

function applyWarpedFullFaceAnonymizer(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  geometry: FaceGeometry
): void {
  const { sourceWidth, sourceHeight, sourceX, sourceY } = computeFaceRegionBounds(
    canvas,
    geometry,
    1.18,
    1.16,
    120,
    140
  );
  const scratchWidth = Math.max(1, Math.round(sourceWidth));
  const scratchHeight = Math.max(1, Math.round(sourceHeight));
  const scratch = getScratchCanvas(scratchWidth, scratchHeight);
  const scratchContext = scratch.getContext("2d");
  if (!scratchContext) {
    return;
  }

  scratchContext.clearRect(0, 0, scratchWidth, scratchHeight);
  scratchContext.drawImage(
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

  context.filter = "blur(3px)";
  context.globalAlpha = 0.94;
  context.drawImage(
    scratch,
    -maskWidth * 0.68,
    -maskHeight * 0.64,
    maskWidth * 1.36,
    maskHeight * 1.28
  );
  context.filter = "none";

  context.globalAlpha = 0.28;
  context.fillStyle = "rgba(2, 6, 23, 0.82)";
  drawRoundedRectPath(
    context,
    -maskWidth / 2,
    -maskHeight / 2,
    maskWidth,
    maskHeight,
    radius
  );
  context.fill();

  const stripWidth = geometry.width * 1.18;
  const stripHeight = geometry.height * 1.52;
  const stripRadius = Math.max(18, geometry.height * 0.28);
  context.globalAlpha = 0.42;
  context.fillStyle = "rgba(2, 6, 23, 0.92)";
  drawRoundedRectPath(
    context,
    -stripWidth / 2,
    -stripHeight / 2 + geometry.height * 0.12,
    stripWidth,
    stripHeight,
    stripRadius
  );
  context.fill();
  context.restore();
}

export function drawVideoFrameWithSunglasses(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  geometry: FaceGeometry | null,
  overlayImage: CanvasImageSource | null
): void {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  if (!geometry || !overlayImage) {
    return;
  }

  applyWarpedFullFaceAnonymizer(context, canvas, geometry);

  context.save();
  context.translate(geometry.centerX, geometry.centerY);
  context.rotate(geometry.rotationRadians);
  context.drawImage(
    overlayImage,
    -geometry.width / 2,
    -geometry.height / 2,
    geometry.width,
    geometry.height
  );
  context.restore();
}
