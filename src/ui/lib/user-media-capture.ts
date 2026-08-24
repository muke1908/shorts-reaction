import type { UserMediaAnonymizerKind } from "../../shared/types";
import { getUserMediaAnonymizerDefinition } from "./user-media-anonymizers";

export interface PreparedUserMediaCapture {
  sourceStream: MediaStream;
  recordingStream: MediaStream;
  cleanup: () => void;
}

export function supportsUserMediaRecording(): boolean {
  return typeof navigator !== "undefined"
    && Boolean(navigator.mediaDevices?.getUserMedia)
    && typeof MediaRecorder !== "undefined";
}

export async function prepareUserMediaCapture(
  anonymizer: UserMediaAnonymizerKind,
  previewElement: HTMLVideoElement | null
): Promise<PreparedUserMediaCapture> {
  const sourceStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });
  const definition = getUserMediaAnonymizerDefinition(anonymizer);
  const session = await definition.start(sourceStream, previewElement);

  return {
    sourceStream,
    recordingStream: session.recordingStream,
    cleanup: () => {
      session.cleanup();
      sourceStream.getTracks().forEach((track) => track.stop());
      if (previewElement) {
        previewElement.srcObject = null;
      }
    }
  };
}
