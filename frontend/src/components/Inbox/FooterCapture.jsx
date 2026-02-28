import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Send, Paperclip, Camera, FileUp, Square, X } from "lucide-react";

export default function FooterCapture({
  onProcessClick,
  pendingCount = 0,
  onAdd,
}) {
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingError, setRecordingError] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const cameraStreamRef = useRef(null);

  const handleAttachClick = () => {
    setAttachMenuOpen((prev) => !prev);
  };

  const handleSubirArchivo = () => {
    setAttachMenuOpen(false);
    fileInputRef.current?.click();
  };

  const stopCameraStream = useCallback(() => {
    const stream = cameraStreamRef.current;
    if (!stream) return;
    stream.getTracks?.().forEach((t) => t.stop());
    cameraStreamRef.current = null;
    if (videoRef.current?.srcObject === stream) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const handleOpenCamera = useCallback(() => {
    setAttachMenuOpen(false);
    setCameraError(null);
    setRecordingError(null);
    setCameraOpen(true);
  }, []);

  const handleCloseCamera = useCallback(() => {
    const video = videoRef.current;
    if (video?.srcObject) {
      const stream = video.srcObject;
      stream.getTracks?.().forEach((t) => t.stop());
      video.srcObject = null;
    }
    cameraStreamRef.current = null;
    setCameraOpen(false);
    setCameraError(null);
  }, []);

  useEffect(() => {
    if (!cameraOpen || !videoRef.current) return;
    const video = videoRef.current;
    const constraints = {
      video: {
        facingMode: "environment",
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    };
    navigator.mediaDevices
      .getUserMedia(constraints)
      .catch(() => navigator.mediaDevices.getUserMedia({ video: true }))
      .then((s) => {
        cameraStreamRef.current = s;
        video.srcObject = s;
        video.play().catch(() => {});
      })
      .catch((err) => {
        setCameraError(err?.message ?? "No se pudo abrir la cámara");
      });
    return () => {
      const stream = cameraStreamRef.current;
      if (stream) {
        stream.getTracks?.().forEach((t) => t.stop());
        cameraStreamRef.current = null;
      }
      if (video.srcObject) {
        video.srcObject = null;
      }
    };
  }, [cameraOpen]);

  const handleCapturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !onAdd) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" });
        handleCloseCamera();
        setSending(true);
        onAdd({ file })
          .catch(() => {})
          .finally(() => setSending(false));
      },
      "image/jpeg",
      0.92
    );
  }, [onAdd, handleCloseCamera]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks?.().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const handleMicClick = useCallback(async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    setRecordingError(null);
    const video = videoRef.current;
    if (video?.srcObject) {
      video.srcObject.getTracks?.().forEach((t) => t.stop());
      video.srcObject = null;
    }
    if (cameraStreamRef.current) cameraStreamRef.current = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const mediaRecorder = new MediaRecorder(stream);
      const chunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        stopStream();
        setRecording(false);
        if (chunks.length === 0 || !onAdd) return;
        const blob = new Blob(chunks, { type: mimeType });
        const file = new File([blob], `nota-voz-${Date.now()}.webm`, { type: blob.type });
        setSending(true);
        try {
          await onAdd({ file });
        } catch {
          // error en App
        } finally {
          setSending(false);
        }
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(200);
      setRecording(true);
    } catch (err) {
      setRecordingError(err?.message ?? "No se pudo acceder al micrófono");
      setRecording(false);
    }
  }, [recording, onAdd, stopStream]);

  const handleSend = async () => {
    const raw = inputValue.trim();
    if (!raw || !onAdd || sending) return;
    setSending(true);
    try {
      const isUrl = /^https?:\/\//i.test(raw);
      await onAdd(isUrl ? { url: raw } : { content: raw });
      setInputValue("");
    } catch {
      // error ya mostrado en App
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !onAdd) return;
    setSending(true);
    try {
      await onAdd({ file });
    } catch {
      // error en App
    } finally {
      setSending(false);
      e.target.value = "";
    }
  };

  return (
    <footer className="shrink-0 bg-white border-t border-zinc-200 safe-bottom dark:bg-zinc-900 dark:border-zinc-800">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="*/*"
        onChange={handleFileChange}
        aria-hidden
      />

      {cameraOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
          {cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/90 p-4">
              <p className="text-white text-center text-sm">{cameraError}</p>
            </div>
          )}
          <div className="absolute top-0 left-0 right-0 flex justify-between items-center p-4 safe-top">
            <button
              type="button"
              onClick={handleCloseCamera}
              className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
              aria-label="Cerrar cámara"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-6 p-6 safe-bottom">
            <button
              type="button"
              onClick={handleCloseCamera}
              className="px-6 py-3 rounded-xl bg-white/20 text-white font-medium text-sm hover:bg-white/30"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCapturePhoto}
              disabled={!!cameraError}
              className="w-16 h-16 rounded-full bg-white border-4 border-white/50 shadow-lg hover:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none"
              aria-label="Capturar foto"
            />
          </div>
        </div>
      )}

      {pendingCount > 0 && (
        <div className="flex justify-center px-4 pt-3 pb-2">
          <div className="w-full max-w-sm rounded-2xl bg-zinc-900/80 backdrop-blur-md border border-zinc-700/50 shadow-2xl shadow-brand-500/20 p-1">
            <button
              type="button"
              onClick={onProcessClick}
              className="w-full py-2.5 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-medium text-sm transition-colors"
            >
              Procesar {pendingCount} notas
            </button>
          </div>
        </div>
      )}

      <div className="relative flex items-center gap-2 px-3 pb-3 pt-2">
        <div className="relative flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleAttachClick}
            className="flex-shrink-0 p-2.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors"
            aria-label="Adjuntar archivo"
            aria-expanded={attachMenuOpen}
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleOpenCamera}
            className="flex-shrink-0 p-2.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors"
            aria-label="Tomar foto"
          >
            <Camera className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleMicClick}
            disabled={sending}
            className={`flex-shrink-0 p-2.5 rounded-full transition-colors ${
              recording
                ? "bg-red-500 text-white hover:bg-red-600"
                : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
            } disabled:opacity-50`}
            aria-label={recording ? "Detener grabación" : "Grabar audio"}
          >
            {recording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          {recordingError && (
            <p className="text-xs text-red-600 dark:text-red-400 absolute left-0 right-0 -top-5 px-2 truncate" role="alert">
              {recordingError}
            </p>
          )}
          {attachMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setAttachMenuOpen(false)}
                aria-hidden
              />
              <div className="absolute bottom-full left-0 mb-2 z-20 min-w-[180px] py-1 rounded-xl bg-white border border-zinc-200 shadow-xl dark:bg-zinc-800 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={handleSubirArchivo}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-left text-sm"
                >
                  <FileUp className="w-4 h-4 text-brand-500 dark:text-zinc-400" />
                  Subir archivo
                </button>
              </div>
            </>
          )}
        </div>

        <div className="flex-1 flex items-center rounded-3xl bg-zinc-100 border border-zinc-200 pl-4 pr-2 py-2 min-h-[44px] dark:bg-zinc-800 dark:border-zinc-700/50">
          <input
            type="text"
            placeholder="Escribe o pega un enlace..."
            className="flex-1 bg-transparent text-zinc-900 placeholder-zinc-500 text-[15px] outline-none min-w-0 dark:text-zinc-100 dark:placeholder-zinc-500"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
            aria-label="Entrada de texto"
          />
        </div>

        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !inputValue.trim()}
          className="flex-shrink-0 w-11 h-11 rounded-full bg-brand-500 hover:bg-brand-600 text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:pointer-events-none"
          aria-label="Enviar"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </footer>
  );
}
