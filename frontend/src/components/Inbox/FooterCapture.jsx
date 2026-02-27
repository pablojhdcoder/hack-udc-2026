import { useState, useRef } from "react";
import { Mic, Send, Paperclip, Camera, FileUp } from "lucide-react";

export default function FooterCapture({
  onProcessClick,
  pendingCount = 0,
  onFileAdd,
  onImageCapture,
}) {
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleAttachClick = () => {
    setAttachMenuOpen((prev) => !prev);
  };

  const handleSubirArchivo = () => {
    setAttachMenuOpen(false);
    fileInputRef.current?.click();
  };

  const handleCameraClick = () => {
    setAttachMenuOpen(false);
    cameraInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !onFileAdd) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const isImage = /^(jpg|jpeg|png|gif|webp|heic)$/.test(ext);
    onFileAdd({
      id: crypto.randomUUID?.() ?? `f-${Date.now()}`,
      type: "file",
      filename: file.name,
      fileType: isImage ? "image" : ext || "file",
      createdAt: new Date().toISOString(),
      previewUrl: isImage ? URL.createObjectURL(file) : null,
    });
    e.target.value = "";
  };

  const handleCameraCapture = (e) => {
    const file = e.target.files?.[0];
    if (!file || !onImageCapture) return;
    onImageCapture({
      id: crypto.randomUUID?.() ?? `img-${Date.now()}`,
      type: "file",
      filename: file.name,
      fileType: "image",
      createdAt: new Date().toISOString(),
      previewUrl: URL.createObjectURL(file),
    });
    e.target.value = "";
  };

  return (
    <footer className="sticky bottom-0 bg-zinc-900/95 backdrop-blur-md border-t border-zinc-800 safe-bottom">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="*/*"
        onChange={handleFileChange}
        aria-hidden
      />
      <input
        ref={cameraInputRef}
        type="file"
        className="hidden"
        accept="image/*"
        capture="environment"
        onChange={handleCameraCapture}
        aria-hidden
      />

      {/* Botón flotante Procesar: glassmorphism + sombra */}
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

      {/* Barra de input estilo mensajería: [clip + mic] [input] [enviar] */}
      <div className="relative flex items-center gap-2 px-3 pb-3 pt-2">
        <div className="relative flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleAttachClick}
            className="flex-shrink-0 p-2.5 rounded-full hover:bg-zinc-800 text-zinc-400 transition-colors"
            aria-label="Adjuntar archivo"
            aria-expanded={attachMenuOpen}
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleCameraClick}
            className="flex-shrink-0 p-2.5 rounded-full hover:bg-zinc-800 text-zinc-400 transition-colors"
            aria-label="Tomar foto"
          >
            <Camera className="w-5 h-5" />
          </button>
          <button
            type="button"
            className="flex-shrink-0 p-2.5 rounded-full hover:bg-zinc-800 text-zinc-400 transition-colors"
            aria-label="Micrófono"
          >
            <Mic className="w-5 h-5" />
          </button>
          {attachMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setAttachMenuOpen(false)}
                aria-hidden
              />
              <div className="absolute bottom-full left-0 mb-2 z-20 min-w-[180px] py-1 rounded-xl bg-zinc-800 border border-zinc-700 shadow-xl">
                <button
                  type="button"
                  onClick={handleSubirArchivo}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-zinc-700 text-zinc-200 text-left text-sm"
                >
                  <FileUp className="w-4 h-4 text-zinc-400" />
                  Subir archivo
                </button>
              </div>
            </>
          )}
        </div>

        <div className="flex-1 flex items-center rounded-3xl bg-zinc-800 border border-zinc-700/50 pl-4 pr-2 py-2 min-h-[44px]">
          <input
            type="text"
            placeholder="Escribe o pega un enlace..."
            className="flex-1 bg-transparent text-zinc-100 placeholder-zinc-500 text-[15px] outline-none min-w-0"
            readOnly
            aria-label="Entrada de texto"
          />
        </div>

        <button
          type="button"
          className="flex-shrink-0 w-11 h-11 rounded-full bg-brand-500 hover:bg-brand-600 text-white flex items-center justify-center transition-colors"
          aria-label="Enviar"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </footer>
  );
}
