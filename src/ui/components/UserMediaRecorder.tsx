import { useEffect, useMemo, useRef, useState } from "react";

export interface RecordedUserMedia {
  mimeType: string;
  base64: string;
}

interface UserMediaRecorderProps {
  open: boolean;
  onRecorded: (media: RecordedUserMedia) => void;
  onCancel: () => void;
  onError: (message: string) => void;
}

function preferredMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];

  for (const candidate of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }

  return "";
}

export function UserMediaRecorder({
  open,
  onRecorded,
  onCancel,
  onError
}: UserMediaRecorderProps): JSX.Element | null {
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const discardRecordingRef = useRef(false);
  const onRecordedRef = useRef(onRecorded);
  const onCancelRef = useRef(onCancel);
  const onErrorRef = useRef(onError);
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);

  const canRecord = useMemo(
    () => typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined",
    []
  );

  useEffect(() => {
    onRecordedRef.current = onRecorded;
    onCancelRef.current = onCancel;
    onErrorRef.current = onError;
  }, [onCancel, onError, onRecorded]);

  function releaseCamera(): void {
    streamRef.current?.getTracks().forEach((track) => track.stop());
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

    navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    })
      .then(async (stream) => {
        streamRef.current = stream;
        if (previewRef.current) {
          previewRef.current.srcObject = stream;
          await previewRef.current.play().catch(() => undefined);
        }
        setCameraReady(true);
      })
      .catch((reason: unknown) => {
        onErrorRef.current(reason instanceof Error ? reason.message : String(reason));
        onCancelRef.current();
      });

    return () => {
      releaseCamera();
    };
  }, [canRecord, open]);

  if (!open) {
    return null;
  }

  async function startRecording(): Promise<void> {
    if (!streamRef.current) {
      return;
    }

    const mimeType = preferredMimeType();
    const recorder = mimeType
      ? new MediaRecorder(streamRef.current, { mimeType })
      : new MediaRecorder(streamRef.current);
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
      const base64 = await blob.arrayBuffer().then((buffer) => {
        let binary = "";
        const bytes = new Uint8Array(buffer);
        const chunkSize = 0x8000;
        for (let index = 0; index < bytes.length; index += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
        }
        return btoa(binary);
      });

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
      <div className="small-text">Record your reaction. The camera turns off automatically after you stop recording.</div>
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
