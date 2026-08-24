import type { UserMediaAnonymizerKind } from "../../shared/types";
import {
  detectPrimaryFaceGeometry,
  loadFaceLandmarker,
  type FaceGeometry
} from "./face-anonymizer";
import { drawVideoFrameWithPixelatedFace } from "./pixelated-anonymizer";
import { drawVideoFrameWithSunglasses, loadSunglassesOverlayImage } from "./sunglasses-anonymizer";

export interface UserMediaAnonymizerSession {
  recordingStream: MediaStream;
  cleanup: () => void;
}

export interface UserMediaAnonymizerDefinition {
  id: UserMediaAnonymizerKind;
  description: string;
  start: (stream: MediaStream, previewElement: HTMLVideoElement | null) => Promise<UserMediaAnonymizerSession>;
}

type FaceFrameRenderer = (
  context: CanvasRenderingContext2D,
  sourceVideo: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  geometry: FaceGeometry | null
) => void;

async function startPassthroughAnonymizer(
  stream: MediaStream,
  previewElement: HTMLVideoElement | null
): Promise<UserMediaAnonymizerSession> {
  if (previewElement) {
    previewElement.srcObject = stream;
    await previewElement.play().catch(() => undefined);
  }

  return {
    recordingStream: stream,
    cleanup: () => {
      if (previewElement) {
        previewElement.srcObject = null;
      }
    }
  };
}

async function startFaceTrackedAnonymizer(
  stream: MediaStream,
  previewElement: HTMLVideoElement | null,
  createRenderer: () => Promise<FaceFrameRenderer>
): Promise<UserMediaAnonymizerSession> {
  const sourceVideo = document.createElement("video");
  sourceVideo.muted = true;
  sourceVideo.playsInline = true;
  sourceVideo.srcObject = stream;
  await sourceVideo.play();

  const [landmarker, renderFrame] = await Promise.all([
    loadFaceLandmarker(),
    createRenderer()
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = sourceVideo.videoWidth || 720;
  canvas.height = sourceVideo.videoHeight || 1280;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create a drawing context for the selected anonymizer.");
  }

  const processedStream = canvas.captureStream(30);
  stream.getAudioTracks().forEach((track) => processedStream.addTrack(track));

  let animationFrameId: number | null = null;
  const drawFrame = () => {
    const geometry = detectPrimaryFaceGeometry(
      landmarker,
      sourceVideo,
      canvas.width,
      canvas.height
    );
    renderFrame(context, sourceVideo, canvas, geometry);
    animationFrameId = window.requestAnimationFrame(drawFrame);
  };

  drawFrame();

  if (previewElement) {
    previewElement.srcObject = processedStream;
    await previewElement.play().catch(() => undefined);
  }

  return {
    recordingStream: processedStream,
    cleanup: () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }

      processedStream.getVideoTracks().forEach((track) => track.stop());
      sourceVideo.pause();
      sourceVideo.srcObject = null;
      if (previewElement) {
        previewElement.srcObject = null;
      }
    }
  };
}

async function startSunglassesAnonymizer(
  stream: MediaStream,
  previewElement: HTMLVideoElement | null
): Promise<UserMediaAnonymizerSession> {
  return startFaceTrackedAnonymizer(stream, previewElement, async () => {
    const overlayImage = await loadSunglassesOverlayImage();
    return (context, sourceVideo, canvas, geometry) => {
      drawVideoFrameWithSunglasses(context, sourceVideo, canvas, geometry, overlayImage);
    };
  });
}

async function startPixelatedAnonymizer(
  stream: MediaStream,
  previewElement: HTMLVideoElement | null
): Promise<UserMediaAnonymizerSession> {
  return startFaceTrackedAnonymizer(stream, previewElement, async () => (
    (context, sourceVideo, canvas, geometry) => {
      drawVideoFrameWithPixelatedFace(context, sourceVideo, canvas, geometry);
    }
  ));
}

const ANONYMIZER_DEFINITIONS: Record<UserMediaAnonymizerKind, UserMediaAnonymizerDefinition> = {
  none: {
    id: "none",
    description: "Record your reaction. The camera turns off automatically after you stop recording.",
    start: startPassthroughAnonymizer
  },
  sunglasses: {
    id: "sunglasses",
    description: "Record your reaction with a live anonymity filter. The processed video is what gets uploaded.",
    start: startSunglassesAnonymizer
  },
  pixelated: {
    id: "pixelated",
    description: "Record your reaction with live face pixelation. The processed video is what gets uploaded.",
    start: startPixelatedAnonymizer
  }
};

export function getUserMediaAnonymizerDefinition(
  anonymizer: UserMediaAnonymizerKind
): UserMediaAnonymizerDefinition {
  return ANONYMIZER_DEFINITIONS[anonymizer];
}
