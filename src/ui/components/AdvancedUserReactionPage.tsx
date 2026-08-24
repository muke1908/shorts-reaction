import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AdvancedUserReactionPreviewDocument,
  AvatarReactionProviderKind,
  GeneratedVideoSummary,
  ReactionJobRecord
} from "../../shared/types";
import { providerUserMediaAnonymizer } from "../../shared/reaction-providers";
import type { RecordedUserMedia } from "../lib/user-media-recording";
import { mediaBlobToBase64, preferredRecordingMimeType } from "../lib/user-media-recording";
import { prepareUserMediaCapture, supportsUserMediaRecording } from "../lib/user-media-capture";
import { InlineProcessingStageBar } from "../features/processing/InlineProcessingStageBar";
import { isActiveProcessingStatus, statusLabel } from "../features/processing/stages";
import { OutputVideoCell } from "./OutputVideoCell";

interface AdvancedUserReactionPageProps {
  provider: AvatarReactionProviderKind;
  shortId?: string | null;
  requestedDay?: string | null;
  categorySlug?: string | null;
  sourceUrl?: string | null;
  onBack: () => void;
  onJobStarted: (job: ReactionJobRecord) => Promise<void>;
}

interface StageFrame {
  width: number;
  height: number;
  sourceHeight: number;
  cameraTop: number;
  cameraHeight: number;
}

type CapturableVideoElement = HTMLVideoElement & {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
};

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

function buildPreviewPath(props: AdvancedUserReactionPageProps): string {
  const search = new URLSearchParams({
    provider: props.provider
  });

  if (props.shortId) {
    search.set("shortId", props.shortId);
  }
  if (props.requestedDay) {
    search.set("day", props.requestedDay);
  }
  if (props.categorySlug) {
    search.set("categorySlug", props.categorySlug);
  }
  if (props.sourceUrl) {
    search.set("sourceUrl", props.sourceUrl);
  }

  return `/api/user-reaction/preview?${search.toString()}`;
}

export function AdvancedUserReactionPage(props: AdvancedUserReactionPageProps): JSX.Element {
  const stageAreaRef = useRef<HTMLDivElement | null>(null);
  const stageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderCleanupRef = useRef<(() => void) | null>(null);
  const sourceStreamRef = useRef<MediaStream | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [cameraFeedElement, setCameraFeedElement] = useState<HTMLVideoElement | null>(null);
  const [sourceFeedElement, setSourceFeedElement] = useState<HTMLVideoElement | null>(null);
  const [previewDocument, setPreviewDocument] = useState<AdvancedUserReactionPreviewDocument | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [sourcePlaying, setSourcePlaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recordedMedia, setRecordedMedia] = useState<RecordedUserMedia | null>(null);
  const [summary, setSummary] = useState<GeneratedVideoSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stageFrame, setStageFrame] = useState<StageFrame | null>(null);
  const canRecord = useMemo(() => supportsUserMediaRecording(), []);
  const anonymizer = providerUserMediaAnonymizer(props.provider);
  const running = summary ? isActiveProcessingStatus(summary.status) : false;
  const canToggleCamera = !recording && !saving;
  const canStartRecording = cameraEnabled && cameraReady && !loadingPreview && !recording && !saving && !running;
  const canTogglePlayback = Boolean(sourceFeedElement);
  const canSave = !recording && !saving && Boolean(recordedMedia);
  const canRestart = !recording;
  const statusMessage = recording
    ? "Recording is live. Use Play to start the source clip and Pause to stop it."
    : recordedMedia
      ? "Recording draft is ready. Save opens it in a new tab, or reset to discard it."
      : cameraReady
        ? "The source stays stopped until you press Play."
        : "";

  const bindVideoStream = useCallback(async (
    element: HTMLVideoElement | null,
    stream: MediaStream | null
  ) => {
    if (!element) {
      return;
    }

    element.srcObject = stream;
    if (stream) {
      await element.play().catch(() => undefined);
    } else {
      element.pause();
    }
  }, []);

  const releaseCapture = useCallback(() => {
    recorderCleanupRef.current?.();
    recorderCleanupRef.current = null;
    cleanupRef.current?.();
    cleanupRef.current = null;
    sourceStreamRef.current = null;
    recordingStreamRef.current = null;
    recorderRef.current = null;
    void bindVideoStream(cameraFeedElement, null);
    setCameraReady(false);
  }, [bindVideoStream, cameraFeedElement]);

  useEffect(() => {
    setLoadingPreview(true);
    setError(null);
    fetchJson<AdvancedUserReactionPreviewDocument>(buildPreviewPath(props))
      .then((payload) => {
        setPreviewDocument(payload);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        setLoadingPreview(false);
      });
  }, [props.categorySlug, props.provider, props.requestedDay, props.shortId, props.sourceUrl]);

  useEffect(() => {
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

  useEffect(() => {
    if (!cameraEnabled) {
      releaseCapture();
      return;
    }

    if (!canRecord) {
      setError("This browser does not support camera recording for the UserMediaProvider.");
      return;
    }

    if (!cameraFeedElement) {
      return;
    }

    let cancelled = false;
    prepareUserMediaCapture(anonymizer, null)
      .then(async (capture) => {
        if (cancelled) {
          capture.cleanup();
          return;
        }

        sourceStreamRef.current = capture.sourceStream;
        recordingStreamRef.current = capture.recordingStream;
        cleanupRef.current = capture.cleanup;
        await bindVideoStream(cameraFeedElement, capture.recordingStream);
        setCameraReady(true);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      });

    return () => {
      cancelled = true;
      releaseCapture();
    };
  }, [anonymizer, bindVideoStream, cameraEnabled, cameraFeedElement, canRecord, releaseCapture]);

  useEffect(() => {
    const element = stageAreaRef.current;
    if (!element) {
      return;
    }

    const updateStageFrame = () => {
      const availableWidth = element.clientWidth;
      const availableHeight = element.clientHeight;
      if (availableWidth <= 0 || availableHeight <= 0) {
        return;
      }

      let width = Math.floor((availableHeight * 9) / 16);
      let height = availableHeight;

      if (width > availableWidth) {
        width = availableWidth;
        height = Math.floor((width * 16) / 9);
      }

      const cameraHeight = Math.floor(height * 0.4);
      const cameraTop = height - cameraHeight;
      const sourceHeight = cameraTop;

      setStageFrame({
        width,
        height,
        sourceHeight,
        cameraTop,
        cameraHeight
      });
    };

    updateStageFrame();
    const observer = new ResizeObserver(() => {
      updateStageFrame();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!sourceFeedElement || !previewDocument?.previewVideoUrl) {
      return;
    }

    sourceFeedElement.currentTime = 0;
    sourceFeedElement.pause();
    setSourcePlaying(false);
  }, [previewDocument?.previewVideoUrl, sourceFeedElement]);

  useEffect(() => {
    const element = sourceFeedElement;
    if (!element) {
      return;
    }

    const handlePlay = () => setSourcePlaying(true);
    const handlePause = () => setSourcePlaying(false);
    const handleEnded = () => setSourcePlaying(false);

    element.addEventListener("play", handlePlay);
    element.addEventListener("pause", handlePause);
    element.addEventListener("ended", handleEnded);
    return () => {
      element.removeEventListener("play", handlePlay);
      element.removeEventListener("pause", handlePause);
      element.removeEventListener("ended", handleEnded);
    };
  }, [sourceFeedElement]);

  useEffect(() => {
    const canvas = stageCanvasRef.current;
    if (!canvas || !stageFrame) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(stageFrame.width * devicePixelRatio));
    canvas.height = Math.max(1, Math.floor(stageFrame.height * devicePixelRatio));
    canvas.style.width = `${stageFrame.width}px`;
    canvas.style.height = `${stageFrame.height}px`;
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

    const drawContainedVideo = (
      video: HTMLVideoElement,
      left: number,
      top: number,
      frameWidth: number,
      frameHeight: number
    ) => {
      if (
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
        || video.videoWidth <= 0
        || video.videoHeight <= 0
      ) {
        return;
      }

      const scale = Math.min(frameWidth / video.videoWidth, frameHeight / video.videoHeight);
      const drawWidth = video.videoWidth * scale;
      const drawHeight = video.videoHeight * scale;
      const drawLeft = left + ((frameWidth - drawWidth) / 2);
      const drawTop = top + ((frameHeight - drawHeight) / 2);
      context.drawImage(video, drawLeft, drawTop, drawWidth, drawHeight);
    };

    const drawDisabledCameraGlyph = (
      left: number,
      top: number,
      frameWidth: number,
      frameHeight: number
    ) => {
      const iconSize = Math.max(42, Math.min(84, Math.floor(frameHeight * 0.22)));
      const iconLeft = left + ((frameWidth - iconSize) / 2);
      const iconTop = top + ((frameHeight - iconSize) / 2);

      context.save();
      context.strokeStyle = "rgba(148, 163, 184, 0.9)";
      context.lineWidth = Math.max(2, iconSize * 0.06);
      context.lineJoin = "round";
      context.lineCap = "round";

      const bodyX = iconLeft + (iconSize * 0.14);
      const bodyY = iconTop + (iconSize * 0.24);
      const bodyWidth = iconSize * 0.5;
      const bodyHeight = iconSize * 0.34;
      const bodyRadius = iconSize * 0.08;
      const lensWidth = iconSize * 0.16;
      const lensHeight = iconSize * 0.16;
      const lensX = bodyX + bodyWidth;
      const lensY = iconTop + (iconSize * 0.33);

      context.beginPath();
      context.roundRect(bodyX, bodyY, bodyWidth, bodyHeight, bodyRadius);
      context.stroke();

      context.beginPath();
      context.moveTo(lensX, lensY + (lensHeight * 0.12));
      context.lineTo(lensX + lensWidth, lensY);
      context.lineTo(lensX + lensWidth, lensY + lensHeight);
      context.lineTo(lensX, lensY + (lensHeight * 0.88));
      context.closePath();
      context.stroke();

      context.beginPath();
      context.moveTo(iconLeft + (iconSize * 0.18), iconTop + (iconSize * 0.16));
      context.lineTo(iconLeft + (iconSize * 0.82), iconTop + (iconSize * 0.8));
      context.strokeStyle = "rgba(248, 113, 113, 0.92)";
      context.lineWidth = Math.max(3, iconSize * 0.08);
      context.stroke();
      context.restore();
    };

    let animationFrameId: number | null = null;
    const drawFrame = () => {
      context.clearRect(0, 0, stageFrame.width, stageFrame.height);
      context.fillStyle = "#020617";
      context.fillRect(0, 0, stageFrame.width, stageFrame.height);

      context.fillStyle = "#020617";
      context.fillRect(0, 0, stageFrame.width, stageFrame.sourceHeight);
      if (sourceFeedElement) {
        drawContainedVideo(sourceFeedElement, 0, 0, stageFrame.width, stageFrame.sourceHeight);
      }

      context.fillStyle = "#0f172a";
      context.fillRect(0, stageFrame.cameraTop, stageFrame.width, stageFrame.cameraHeight);

      context.fillStyle = "#1e293b";
      context.fillRect(0, stageFrame.cameraTop - 2, stageFrame.width, 2);

      if (cameraFeedElement) {
        drawContainedVideo(
          cameraFeedElement,
          0,
          stageFrame.cameraTop,
          stageFrame.width,
          stageFrame.cameraHeight
        );
      }

      if (!cameraReady) {
        drawDisabledCameraGlyph(0, stageFrame.cameraTop, stageFrame.width, stageFrame.cameraHeight);
      }

      animationFrameId = window.requestAnimationFrame(drawFrame);
    };

    drawFrame();
    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [cameraFeedElement, cameraReady, sourceFeedElement, stageFrame]);

  useEffect(() => {
    if (!previewDocument?.record.id || !summary || !isActiveProcessingStatus(summary.status)) {
      return;
    }

    const timer = window.setInterval(() => {
      fetchJson<GeneratedVideoSummary | null>(`/api/process/by-short/${previewDocument.record.id}`)
        .then((payload) => {
          if (payload) {
            setSummary(payload);
          }
        })
        .catch((reason: unknown) => {
          setError(reason instanceof Error ? reason.message : String(reason));
        });
    }, 1500);

    return () => window.clearInterval(timer);
  }, [previewDocument?.record.id, summary]);

  const createStageRecordingStream = useCallback(async (): Promise<{
    stream: MediaStream;
    cleanup: () => void;
  }> => {
    const canvas = stageCanvasRef.current;
    if (!canvas) {
      throw new Error("Stage canvas is not ready yet.");
    }

    const canvasStream = canvas.captureStream(30);
    const outputStream = new MediaStream();
    canvasStream.getVideoTracks().forEach((track) => outputStream.addTrack(track));

    const audioContext = new AudioContext();
    await audioContext.resume().catch(() => undefined);
    const destination = audioContext.createMediaStreamDestination();
    const audioSources: MediaStreamAudioSourceNode[] = [];

    const capturableSourceElement = sourceFeedElement as CapturableVideoElement | null;
    const sourcePlaybackStream = capturableSourceElement?.captureStream?.()
      ?? capturableSourceElement?.mozCaptureStream?.()
      ?? null;
    const sourceAudioTracks = sourcePlaybackStream?.getAudioTracks() ?? [];
    if (sourceAudioTracks.length > 0) {
      const sourceAudioStream = new MediaStream(sourceAudioTracks);
      const sourceAudioNode = audioContext.createMediaStreamSource(sourceAudioStream);
      sourceAudioNode.connect(destination);
      audioSources.push(sourceAudioNode);
    }

    const microphoneAudioTracks = sourceStreamRef.current?.getAudioTracks() ?? [];
    if (microphoneAudioTracks.length > 0) {
      const microphoneAudioStream = new MediaStream(microphoneAudioTracks);
      const microphoneAudioNode = audioContext.createMediaStreamSource(microphoneAudioStream);
      microphoneAudioNode.connect(destination);
      audioSources.push(microphoneAudioNode);
    }

    destination.stream.getAudioTracks().forEach((track) => outputStream.addTrack(track));

    return {
      stream: outputStream,
      cleanup: () => {
        canvasStream.getTracks().forEach((track) => track.stop());
        outputStream.getTracks().forEach((track) => track.stop());
        audioSources.forEach((sourceNode) => sourceNode.disconnect());
        destination.disconnect();
        void audioContext.close().catch(() => undefined);
      }
    };
  }, [sourceFeedElement]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    setRecording(false);
  }, []);

  const playSource = useCallback(() => {
    if (!sourceFeedElement) {
      return;
    }

    void sourceFeedElement.play().catch(() => undefined);
  }, [sourceFeedElement]);

  const pauseSource = useCallback(() => {
    sourceFeedElement?.pause();
  }, [sourceFeedElement]);

  const toggleSourcePlayback = useCallback(() => {
    if (sourcePlaying) {
      pauseSource();
      return;
    }

    playSource();
  }, [pauseSource, playSource, sourcePlaying]);

  const restartFlow = useCallback(() => {
    if (sourceFeedElement) {
      sourceFeedElement.pause();
      sourceFeedElement.currentTime = 0;
    }
    setRecordedMedia(null);
    setError(null);
    setSourcePlaying(false);
  }, [sourceFeedElement]);

  const toggleCamera = useCallback(() => {
    if (!canToggleCamera) {
      return;
    }

    setError(null);
    setCameraEnabled((current) => !current);
  }, [canToggleCamera]);

  async function startRecording(): Promise<void> {
    if (!previewDocument) {
      throw new Error("Source preview is still loading.");
    }

    if (!cameraReady) {
      throw new Error("Camera preview is not ready yet.");
    }

    setError(null);
    setRecordedMedia(null);
    recorderCleanupRef.current?.();
    const stageRecording = await createStageRecordingStream();
    recorderCleanupRef.current = stageRecording.cleanup;
    const mimeType = preferredRecordingMimeType();
    const recorder = mimeType
      ? new MediaRecorder(stageRecording.stream, { mimeType })
      : new MediaRecorder(stageRecording.stream);
    chunksRef.current = [];
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = async () => {
      try {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "video/webm"
        });
        setRecordedMedia({
          mimeType: blob.type || "video/webm",
          base64: await mediaBlobToBase64(blob)
        });
      } catch (reason: unknown) {
        setError(reason instanceof Error ? reason.message : String(reason));
      } finally {
        recorderCleanupRef.current?.();
        recorderCleanupRef.current = null;
      }
    };

    recorder.start();
    setRecording(true);
  }

  async function saveDraftRecording(): Promise<void> {
    if (!recordedMedia) {
      throw new Error("No recorded draft is ready to save yet.");
    }

    setSaving(true);
    try {
      const blob = new Blob([Uint8Array.from(atob(recordedMedia.base64), (character) => character.charCodeAt(0))], {
        type: recordedMedia.mimeType
      });
      const previewUrl = URL.createObjectURL(blob);
      window.open(previewUrl, "_blank", "noopener,noreferrer");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="layout layout--immersive">
      <section className="panel advanced-reaction-page advanced-reaction-page--reset">
        <div className="advanced-reaction-page__close">
          <button className="advanced-reaction-page__close-button" type="button" aria-label="Close advanced user reaction" onClick={props.onBack}>
            ×
          </button>
        </div>

        {error ? <div className="panel error">{error}</div> : null}

        <div
          ref={stageAreaRef}
          className={`advanced-reaction-page__stage-area${recording ? " advanced-reaction-page__stage-area--recording" : ""}`}
        >
          <canvas ref={stageCanvasRef} className="advanced-stage-canvas" />
          <video
            ref={setSourceFeedElement}
            className="advanced-stage-preview__feed"
            src={previewDocument?.previewVideoUrl}
            muted
            playsInline
            preload="auto"
          />
          <video
            ref={setCameraFeedElement}
            className="advanced-stage-preview__feed"
            autoPlay
            muted
            playsInline
          />
        </div>

        <div className="advanced-reaction-page__controls">
          <div className="advanced-reaction-page__actions">
            <div className="advanced-reaction-page__action-group advanced-reaction-page__action-group--start">
              <button
                className={`advanced-reaction-page__action-button advanced-reaction-page__action-button--icon${cameraEnabled ? " advanced-reaction-page__action-button--danger" : ""}`}
                type="button"
                aria-label={cameraEnabled ? "Turn camera off" : "Turn camera on"}
                disabled={!canToggleCamera}
                onClick={toggleCamera}
              >
                <span className="advanced-reaction-page__action-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M9 6.5 10.4 5h3.2L15 6.5h2.5A2.5 2.5 0 0 1 20 9v6a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 15V9a2.5 2.5 0 0 1 2.5-2.5H9Zm3 2.25A3.25 3.25 0 1 0 12 15.25 3.25 3.25 0 0 0 12 8.75Zm0 1.75A1.5 1.5 0 1 1 10.5 12 1.5 1.5 0 0 1 12 10.5Z" />
                  </svg>
                </span>
              </button>
              <button
                className={`advanced-reaction-page__action-button advanced-reaction-page__action-button--icon ${recording ? "advanced-reaction-page__action-button--danger" : "advanced-reaction-page__action-button--primary"}`}
                type="button"
                aria-label={recording ? "Stop recording" : "Start recording"}
                disabled={recording ? false : !canStartRecording}
                onClick={() => {
                  if (recording) {
                    stopRecording();
                    return;
                  }

                  startRecording().catch((reason: unknown) => {
                    setError(reason instanceof Error ? reason.message : String(reason));
                  });
                }}
              >
                <span className="advanced-reaction-page__action-icon" aria-hidden="true">
                  {recording ? (
                    <svg viewBox="0 0 24 24" focusable="false">
                      <rect x="6" y="6" width="12" height="12" rx="1.5" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" focusable="false">
                      <circle cx="12" cy="12" r="6" />
                    </svg>
                  )}
                </span>
              </button>
            </div>

            <div className="advanced-reaction-page__action-group advanced-reaction-page__action-group--live">
              <button
                className={`advanced-reaction-page__action-button advanced-reaction-page__action-button--icon${recording ? " advanced-reaction-page__action-button--focus" : ""}`}
                type="button"
                aria-label={sourcePlaying ? "Pause source video" : "Play source video"}
                disabled={!canTogglePlayback}
                onClick={toggleSourcePlayback}
              >
                <span className="advanced-reaction-page__action-icon" aria-hidden="true">
                  {sourcePlaying ? (
                    <svg viewBox="0 0 24 24" focusable="false">
                      <rect x="6" y="5" width="4" height="14" rx="1" />
                      <rect x="14" y="5" width="4" height="14" rx="1" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" focusable="false">
                      <path d="M8 5.5v13l10-6.5-10-6.5Z" />
                    </svg>
                  )}
                </span>
              </button>
            </div>

            <div className="advanced-reaction-page__action-group advanced-reaction-page__action-group--persist">
              <button
                className="advanced-reaction-page__action-button advanced-reaction-page__action-button--icon"
                type="button"
                aria-label="Open recorded video in a new tab"
                disabled={!canSave}
                onClick={() => {
                  saveDraftRecording().catch((reason: unknown) => {
                    setError(reason instanceof Error ? reason.message : String(reason));
                  });
                }}
              >
                <span className="advanced-reaction-page__action-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M12 3a1 1 0 0 1 1 1v8.59l2.3-2.29 1.4 1.41-4.7 4.7-4.7-4.7 1.4-1.41 2.3 2.29V4a1 1 0 0 1 1-1Z" />
                    <path d="M5 18a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1Z" />
                  </svg>
                </span>
              </button>
              <button
                className="advanced-reaction-page__action-button advanced-reaction-page__action-button--icon"
                type="button"
                aria-label="Reset recording flow"
                disabled={!canRestart}
                onClick={restartFlow}
              >
                <span className="advanced-reaction-page__action-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M12 5a7 7 0 1 1-6.52 9.56l1.86-.73A5 5 0 1 0 8 8.1V11H3V6h2v1.7A8.96 8.96 0 0 1 12 5Z" />
                  </svg>
                </span>
              </button>
            </div>
          </div>
          <div className="small-text advanced-reaction-page__status">
            {statusMessage || "\u00A0"}
          </div>
        </div>

        {summary ? (
          <div className="advanced-reaction-page__result">
            <div className="process-status small-text">Status: {statusLabel(summary.status)}</div>
            <InlineProcessingStageBar summary={summary} />
            {summary.error ? <div className="process-meta processing-error small-text">{summary.error}</div> : null}
            <OutputVideoCell summary={summary} />
          </div>
        ) : null}
      </section>
    </main>
  );
}
