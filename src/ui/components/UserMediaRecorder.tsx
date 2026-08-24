import { useEffect, useMemo, useRef, useState } from "react";
import type { UserMediaAnonymizerKind } from "../../shared/types";
import { getUserMediaAnonymizerDefinition } from "../lib/user-media-anonymizers";
import { prepareUserMediaCapture, supportsUserMediaRecording } from "../lib/user-media-capture";
import type { RecordedUserMedia } from "../lib/user-media-recording";
import { mediaBlobToBase64, preferredRecordingMimeType } from "../lib/user-media-recording";
export type { RecordedUserMedia } from "../lib/user-media-recording";

interface UserMediaRecorderProps {
  anonymizer?: UserMediaAnonymizerKind;
  open: boolean;
  onRecorded: (media: RecordedUserMedia) => void;
  onCancel: () => void;
  onError: (message: string) => void;
}

function preferredMimeType(): string {
  return preferredRecordingMimeType();
}

export function UserMediaRecorder({
  anonymizer = "none",
  open,
  onRecorded,
  onCancel,
  onError
}: UserMediaRecorderProps): JSX.Element | null {
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const anonymizerCleanupRef = useRef<(() => void) | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const discardRecordingRef = useRef(false);
  const onRecordedRef = useRef(onRecorded);
  const onCancelRef = useRef(onCancel);
  const onErrorRef = useRef(onError);
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);

  const canRecord = useMemo(
    () => supportsUserMediaRecording(),
    []
  );

  useEffect(() => {
    onRecordedRef.current = onRecorded;
    onCancelRef.current = onCancel;
    onErrorRef.current = onError;
  }, [onCancel, onError, onRecorded]);

  function releaseCamera(): void {
    anonymizerCleanupRef.current?.();
    anonymizerCleanupRef.current = null;
    recordingStreamRef.current = null;
    streamRef.current = null;
    recorderRef.current = null;
    if (previewRef.current) {
      previewRef.current.srcObject = null;
    }
    setCameraReady(false);
  }

  useEffect(() => {
    if (!open) {
      releaseCamera();
      return;
    }

    if (!canRecord) {
      onErrorRef.current("This browser does not support camera recording for the UserMediaProvider.");
      onCancelRef.current();
      return;
    }

    prepareUserMediaCapture(anonymizer, previewRef.current)
      .then(async (capture) => {
        streamRef.current = capture.sourceStream;
        anonymizerCleanupRef.current = capture.cleanup;
        recordingStreamRef.current = capture.recordingStream;

        setCameraReady(true);
      })
      .catch((reason: unknown) => {
        onErrorRef.current(reason instanceof Error ? reason.message : String(reason));
        onCancelRef.current();
      });

    return () => {
      releaseCamera();
    };
  }, [anonymizer, canRecord, open]);

  if (!open) {
    return null;
  }

  async function startRecording(): Promise<void> {
    const activeStream = recordingStreamRef.current ?? streamRef.current;
    if (!activeStream) {
      return;
    }

    const mimeType = preferredMimeType();
    const recorder = mimeType
      ? new MediaRecorder(activeStream, { mimeType })
      : new MediaRecorder(activeStream);
    chunksRef.current = [];
    discardRecordingRef.current = false;
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "video/webm"
      });
      const base64 = await mediaBlobToBase64(blob);

      releaseCamera();
      setRecording(false);
      if (discardRecordingRef.current) {
        discardRecordingRef.current = false;
        onCancelRef.current();
        return;
      }

      onRecordedRef.current({
        mimeType: blob.type || "video/webm",
        base64
      });
    };

    recorder.start();
    setRecording(true);
  }

  function stopRecording(): void {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }

  function cancel(): void {
    if (recorderRef.current?.state === "recording") {
      discardRecordingRef.current = true;
      recorderRef.current.stop();
      return;
    }

    releaseCamera();
    onCancel();
  }

  return (
    <div className="user-media-recorder">
      <div className="small-text">
        {getUserMediaAnonymizerDefinition(anonymizer).description}
      </div>
      <video ref={previewRef} className="user-media-recorder__preview" autoPlay muted playsInline />
      <div className="user-media-recorder__actions">
        <button className="secondary-button" disabled={!cameraReady || recording} onClick={() => {
          startRecording().catch((reason: unknown) => {
            onError(reason instanceof Error ? reason.message : String(reason));
            setRecording(false);
          });
        }}>
          Start recording
        </button>
        <button className="secondary-button" disabled={!recording} onClick={stopRecording}>
          Stop recording
        </button>
        <button className="secondary-button" onClick={cancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
