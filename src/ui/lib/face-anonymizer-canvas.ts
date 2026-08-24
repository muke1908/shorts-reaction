import type { FaceGeometry } from "./face-anonymizer";

export interface FaceRegionBounds {
  sourceWidth: number;
  sourceHeight: number;
  sourceX: number;
  sourceY: number;
}

export function computeFaceRegionBounds(
  canvas: HTMLCanvasElement,
  geometry: FaceGeometry,
  widthScale: number,
  heightScale: number,
  minWidth: number,
  minHeight: number
): FaceRegionBounds {
  const sourceWidth = Math.min(canvas.width, Math.max(geometry.faceWidth * widthScale, minWidth));
  const sourceHeight = Math.min(canvas.height, Math.max(geometry.faceHeight * heightScale, minHeight));

  return {
    sourceWidth,
    sourceHeight,
    sourceX: Math.max(0, Math.min(canvas.width - sourceWidth, geometry.faceCenterX - sourceWidth / 2)),
    sourceY: Math.max(0, Math.min(canvas.height - sourceHeight, geometry.faceCenterY - sourceHeight / 2))
  };
}

export function drawRoundedRectPath(
  context: CanvasRenderingContext2D,
  left: number,
  top: number,
  rectWidth: number,
  rectHeight: number,
  radius: number
): void {
  context.beginPath();
  context.moveTo(left + radius, top);
  context.lineTo(left + rectWidth - radius, top);
  context.quadraticCurveTo(left + rectWidth, top, left + rectWidth, top + radius);
  context.lineTo(left + rectWidth, top + rectHeight - radius);
  context.quadraticCurveTo(left + rectWidth, top + rectHeight, left + rectWidth - radius, top + rectHeight);
  context.lineTo(left + radius, top + rectHeight);
  context.quadraticCurveTo(left, top + rectHeight, left, top + rectHeight - radius);
  context.lineTo(left, top + radius);
  context.quadraticCurveTo(left, top, left + radius, top);
  context.closePath();
}
