import { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowLeft,
  CalendarPlus,
  Loader2,
  Link2,
  Mic,
  FileText,
  File,
  Image,
  Video,
  Trash2,
  Pencil,
  Check,
  Save,
  X,
  Play,
  Pause,
} from "lucide-react";
import { getInbox, processItems, discardItem, updateInboxEnrichment } from "../../api/client";
import { useAppLanguage } from "../../context/LanguageContext";

const ICON_BY_KIND = {
  link: Link2,
  note: FileText,
  audio: Mic,
  file: File,
  photo: Image,
  video: Video,
};

/** Destino por tipo de ítem (la IA / sistema decide, no el usuario). */
function getDestinationFromKind(kind) {
  const map = { note: "notas", link: "enlaces", file: "archivos", photo: "fotos", audio: "audio", video: "videos" };
  return map[kind] ?? "notas";
}

/** Etiqueta para el badge "Se guardará en: [Tipo]" */
function getTypeLabel(item, t) {
  if (!item) return t("processing.typeNote");
  const keyMap = { note: "processing.typeNote", link: "processing.typeLink", file: "processing.typeFile", photo: "processing.typePhoto", audio: "processing.typeAudio", video: "processing.typeVideo" };
  return t(keyMap[item.kind] ?? "processing.typeNote");
}

/** Extrae resumen de la IA del ítem (aiEnrichment.summary o aiSummary). */
function getAISummary(item) {
  if (!item) return null;
  if (item.aiSummary && typeof item.aiSummary === "string") return item.aiSummary.trim();
  if (item.aiEnrichment) {
    try {
      const data = typeof item.aiEnrichment === "string" ? JSON.parse(item.aiEnrichment) : item.aiEnrichment;
      if (data?.summary) return String(data.summary).trim();
    } catch {}
  }
  return null;
}

/** True si el ítem ya tiene resumen/título de la IA (no está esperando enriquecimiento). */
function hasRealEnrichment(item) {
  const summary = getAISummary(item);
  return !!summary && String(summary).trim().length > 0;
}

/** Extrae el título de la IA del ítem (aiEnrichment.title o aiTitle). Solo título IA; filename es fallback aparte. */
function getAITitle(item) {
  if (item?.aiTitle && String(item.aiTitle).trim()) return String(item.aiTitle).trim();
  if (!item?.aiEnrichment) return null;
  try {
    const data = typeof item.aiEnrichment === "string" ? JSON.parse(item.aiEnrichment) : item.aiEnrichment;
    if (data?.title) return String(data.title).trim();
  } catch {}
  return null;
}

/** Título a mostrar: primero título IA (aiEnrichment), solo si no hay usa filename. */
function getDisplayTitle(item, fallbackLabel) {
  const ai = getAITitle(item);
  if (ai) return ai;
  if (item?.filename && String(item.filename).trim()) return item.filename;
  return fallbackLabel ?? "";
}

/** Topics del ítem para las píldoras (#topic). Lee del nuevo formato aiEnrichment. */
function getItemTopics(item) {
  if (!item?.aiEnrichment) return [];
  try {
    const data = typeof item.aiEnrichment === "string" ? JSON.parse(item.aiEnrichment) : item.aiEnrichment;
    if (Array.isArray(data?.topics)) {
      return [...new Set(data.topics.filter(Boolean).map((t) => String(t).trim()))];
    }
  } catch {}
  return [];
}

function getRawPreview(item, t) {
  if (item.content) return item.content;
  if (item.url) return item.title ? `${item.title}\n${item.url}` : item.url;
  if (item.filename) return item.filename;
  if (item.kind === "audio") {
    const aiTitle = getAITitle(item);
    return aiTitle || t("common.voiceNote");
  }
  return t("common.noContent");
}

/** URL para preview de imagen en /api/uploads (mismo criterio que FilePreview). */
function buildUploadThumbUrl(filePath) {
  if (!filePath || typeof filePath !== "string") return null;
  const normalized = String(filePath).trim().replace(/\\/g, "/");
  const basename = normalized.split("/").pop();
  return basename ? `/api/uploads/${basename}` : null;
}

function AudioPlayerInline({ filePath, durationSeconds }) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(durationSeconds || 0);
  const audioRef = useRef(null);

  const audioUrl = (() => {
    if (!filePath) return null;
    const normalized = String(filePath).trim().replace(/\\/g, "/");
    const basename = normalized.split("/").pop();
    return basename ? `/api/uploads/${basename}` : null;
  })();

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const formatDur = (s) => {
    if (!s || s <= 0) return null;
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  };

  const handlePlayPause = () => {
    if (!audioRef.current || !audioUrl) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); }
  };

  const progress = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;
  const durLabel = formatDur(audioDuration);

  return (
    <div className="flex items-center gap-2 mt-2">
      <button
        type="button"
        onClick={handlePlayPause}
        disabled={!audioUrl}
        className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center hover:bg-brand-600 transition-colors disabled:opacity-40"
        aria-label={playing ? "Pausar" : "Reproducir"}
      >
        {playing
          ? <Pause className="w-3.5 h-3.5 text-white" fill="currentColor" />
          : <Play className="w-3.5 h-3.5 text-white ml-0.5" fill="currentColor" />
        }
      </button>
      <div className="flex-1 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-600 overflow-hidden">
        <div className="h-full rounded-full bg-brand-500 transition-all duration-100" style={{ width: `${progress}%` }} />
      </div>
      {durLabel && <span className="text-xs text-zinc-500 flex-shrink-0">{durLabel}</span>}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
          onLoadedMetadata={() => { if (audioRef.current?.duration) setAudioDuration(Math.round(audioRef.current.duration)); }}
          onEnded={() => { setPlaying(false); setCurrentTime(0); if (audioRef.current) audioRef.current.currentTime = 0; }}
          onPause={() => setPlaying(false)}
          preload="metadata"
        />
      )}
    </div>
  );
}

export default function ProcessScreen({ initialItems, onBack, onProcessDone, onOpenVault }) {
  const { t } = useAppLanguage();
  const [items, setItems] = useState(Array.isArray(initialItems) ? initialItems : []);
  const [loading, setLoading] = useState(!Array.isArray(initialItems));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedSummary, setEditedSummary] = useState("");
  const [editedTopics, setEditedTopics] = useState([]);
  const [topicsInput, setTopicsInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState(null);
  const [successInfo, setSuccessInfo] = useState(null);
  const [processedCount, setProcessedCount] = useState(0);
  const [initialTotal, setInitialTotal] = useState(null);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    try {
      const { items: data } = await getInbox();
      setItems(Array.isArray(data) ? data : []);
      setCurrentIndex(0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (Array.isArray(initialItems)) {
      setItems(initialItems);
      setLoading(false);
      return;
    }
    loadInbox();
  }, [loadInbox, initialItems]);

  useEffect(() => {
    if (items.length > 0 && initialTotal === null) {
      setInitialTotal(items.length);
    }
  }, [items.length, initialTotal]);

  useEffect(() => {
    const item = items[currentIndex];
    const title = item ? getAITitle(item) : null;
    const summary = item ? getAISummary(item) : null;
    const topics = item ? getItemTopics(item) : [];
    setEditedTitle(title || (item?.filename ?? "") || "");
    setEditedSummary(summary || t("processing.aiSummaryFallback"));
    setEditedTopics(topics);
    setTopicsInput(topics.join(", "));
    setIsEditing(false);
  }, [currentIndex, items, t]);

  const currentItem = items[currentIndex];
  const total = items.length;
  const totalForProgress = initialTotal ?? total;
  const progress = totalForProgress > 0 ? (processedCount / totalForProgress) * 100 : 0;

  const isAnalyzing = currentItem && !hasRealEnrichment(currentItem);

  useEffect(() => {
    if (!isAnalyzing || !currentItem) return;
    const id = currentItem.id;
    const kind = currentItem.kind;
    const interval = setInterval(async () => {
      try {
        const { items: fresh } = await getInbox();
        const list = Array.isArray(fresh) ? fresh : [];
        const updated = list.find((i) => i.id === id && i.kind === kind);
        if (updated && hasRealEnrichment(updated)) {
          setItems((prev) => prev.map((it) => (it.id === id && it.kind === kind ? updated : it)));
        }
      } catch {
        // ignore
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [isAnalyzing, currentItem?.id, currentItem?.kind]);

  const fallbackSummary = t("processing.aiSummaryFallback");

  const handleDescartar = async () => {
    if (!currentItem) return;
    setProcessError(null);
    try {
      await discardItem(currentItem.kind, currentItem.id);
      onProcessDone?.();
      const { items: newItems } = await getInbox();
      const list = Array.isArray(newItems) ? newItems : [];
      setItems(list);
      setCurrentIndex(0);
      if (list.length === 0) onBack();
    } catch (err) {
      setProcessError(err?.message ?? t("processing.errorDiscard"));
    }
  };

  /** Quitar un ítem de la cola de procesado (solo en esta sesión; no borra en backend). */
  const handleRemoveFromQueue = useCallback((index) => {
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) onBack?.();
      return next;
    });
    setCurrentIndex((prev) => {
      const nextLength = items.length - 1;
      if (nextLength <= 0) return 0;
      if (index < prev) return prev - 1;
      if (index === prev && prev >= nextLength) return Math.max(0, nextLength - 1);
      return prev;
    });
  }, [items.length, onBack]);

  const handleSaveEdit = () => {
    const parsed = topicsInput.split(",").map((t) => t.trim()).filter(Boolean);
    setEditedTopics(parsed);
    setIsEditing(false);
  };

  const handleStartEdit = () => {
    setTopicsInput(editedTopics.join(", "));
    setIsEditing(true);
  };

  const handleAprobar = async () => {
    if (!currentItem || processing) return;
    setProcessError(null);
    setProcessing(true);
    try {
      // Derivar topics finales siempre desde topicsInput (fuente de verdad aunque no se haya pulsado "Guardar")
      const finalTopics = topicsInput.split(",").map((t) => t.trim()).filter(Boolean);

      const originalTitle = getAITitle(currentItem) || "";
      const originalSummary = getAISummary(currentItem) || fallbackSummary;
      const originalTopics = getItemTopics(currentItem);

      const titleChanged = editedTitle !== originalTitle;
      const summaryChanged = editedSummary !== originalSummary;
      const topicsChanged =
        JSON.stringify(finalTopics.slice().sort()) !== JSON.stringify(originalTopics.slice().sort());

      if (titleChanged || summaryChanged || topicsChanged) {
        await updateInboxEnrichment(currentItem.kind, currentItem.id, {
          title: editedTitle,
          summary: editedSummary,
          topics: finalTopics,
        });
      }

      const destination = getDestinationFromKind(currentItem.kind);
      const data = await processItems(
        [{ kind: currentItem.kind, id: currentItem.id }],
        destination
      );
      const result = Array.isArray(data.results) ? data.results[0] : null;
      const kind = currentItem.kind;
      const id = currentItem.id;
      setSuccessInfo({
        destination,
        processedPath: result?.processedPath ?? null,
        kind,
        id,
      });
      setProcessedCount((c) => c + 1);
      onProcessDone?.();
      await loadInbox();
    } catch (err) {
      setProcessError(err?.message ?? t("processing.errorProcessing"));
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full min-h-0 flex flex-col overflow-hidden bg-white dark:bg-neutral-900">
        <header className="shrink-0 z-10 flex items-center h-14 px-4 bg-white border-b border-zinc-200 safe-top dark:bg-neutral-900 dark:border-neutral-800">
          <button type="button" onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800" aria-label={t("processing.backAria")}>
            <ArrowLeft className="w-6 h-6 text-zinc-600 dark:text-zinc-300" />
          </button>
          <h1 className="flex-1 text-center text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t("processing.title")}</h1>
          <div className="w-10" />
        </header>
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-brand-500 dark:text-zinc-500 animate-spin" />
        </main>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="h-full min-h-0 flex flex-col overflow-hidden bg-white dark:bg-neutral-900">
        {successInfo && (
          <div className="fixed top-4 left-4 right-4 z-40 flex justify-center pointer-events-none">
            <div className="pointer-events-auto max-w-md w-full rounded-2xl bg-emerald-500 text-white shadow-xl p-4 flex justify-between items-start border border-emerald-400/70">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                  <Check className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{t("processing.ideaSavedInVault")}</p>
                  <p className="text-xs opacity-90 truncate">{t("processing.path")} {successInfo.destination}</p>
                </div>
              </div>
              <div className="flex flex-row items-center gap-2 ml-4 flex-shrink-0 -mt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setSuccessInfo(null);
                    onOpenVault?.({ kind: successInfo.kind, id: successInfo.id });
                  }}
                  className="text-xs font-medium underline decoration-white/70 underline-offset-2"
                >
                  {t("common.view")}
                </button>
                <button
                  type="button"
                  onClick={() => setSuccessInfo(null)}
                  className="p-1 text-white/70 hover:text-white rounded-full hover:bg-white/20 transition-colors cursor-pointer"
                  aria-label={t("common.close")}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
        <header className="shrink-0 z-10 flex items-center h-14 px-4 bg-white border-b border-zinc-200 safe-top dark:bg-neutral-900 dark:border-neutral-800">
          <button type="button" onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800" aria-label={t("processing.backAria")}>
            <ArrowLeft className="w-6 h-6 text-zinc-600 dark:text-zinc-300" />
          </button>
          <h1 className="flex-1 text-center text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t("processing.title")}</h1>
          <div className="w-10" />
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
          <p className="text-zinc-700 dark:text-zinc-300 text-lg font-medium text-center">{t("processing.emptyTitle")}</p>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm text-center">
            {successInfo ? t("processing.emptyAfterSave") : t("processing.emptyNoMore")}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            {successInfo && (
              <button
                type="button"
                onClick={() => {
                  setSuccessInfo(null);
                  onOpenVault?.({ kind: successInfo.kind, id: successInfo.id });
                }}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium"
              >
                {t("processing.viewInVault")}
              </button>
            )}
            <button
              type="button"
              onClick={onBack}
              className="px-5 py-2.5 rounded-xl border border-zinc-300 dark:border-neutral-600 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-neutral-800"
            >
              {t("processing.backToFactory")}
            </button>
          </div>
        </main>
      </div>
    );
  }

  const IconComponent = ICON_BY_KIND[currentItem.kind] ?? FileText;
  const rawPreview = getRawPreview(currentItem, t);

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-white dark:bg-neutral-900 safe-bottom">
      {successInfo && (
        <div className="fixed top-4 left-4 right-4 z-40 flex justify-center pointer-events-none">
          <div className="pointer-events-auto max-w-md w-full rounded-2xl bg-emerald-500 text-white shadow-xl p-4 flex justify-between items-start border border-emerald-400/70">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <Check className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Idea guardada en el baúl</p>
                <p className="text-xs opacity-90 truncate">
                  Ruta: {successInfo.destination}
                </p>
              </div>
            </div>
            <div className="flex flex-row items-center gap-2 ml-4 flex-shrink-0 -mt-0.5">
              <button
                type="button"
                onClick={() => {
                  setSuccessInfo(null);
                  onOpenVault?.({ kind: successInfo.kind, id: successInfo.id });
                }}
                className="text-xs font-medium underline decoration-white/70 underline-offset-2"
              >
                Ver
              </button>
              <button
                type="button"
                onClick={() => setSuccessInfo(null)}
                className="p-1 text-white/70 hover:text-white rounded-full hover:bg-white/20 transition-colors cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
      <header className="shrink-0 z-20 flex flex-col bg-white border-b border-zinc-200 safe-top dark:bg-neutral-900 dark:border-neutral-800">
        <div className="flex items-center h-14 px-4">
          <button
            type="button"
            onClick={onBack}
            className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label={t("processing.backToFactoryAria")}
          >
            <ArrowLeft className="w-6 h-6 text-zinc-600 dark:text-zinc-300" />
          </button>
          <div className="flex-1 flex flex-col items-center justify-center py-1">
            <p className="text-zinc-900 dark:text-zinc-100 font-medium text-sm">
              {totalForProgress > 0
                ? t("processing.processedOfTotal", { count: processedCount, total: totalForProgress })
                : t("processing.processedCountOnly", { count: processedCount })}
            </p>
            <div className="w-32 h-1.5 mt-1 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <div className="w-10" />
        </div>
        {items.length > 0 && (
          <div className="px-2 pb-2 overflow-x-auto overflow-y-hidden">
            <div className="flex gap-1.5 justify-start min-w-min py-1">
              {items.map((item, idx) => {
                const Icon = ICON_BY_KIND[item.kind] ?? FileText;
                const label = getRawPreview(item, t).slice(0, 20) + (getRawPreview(item, t).length > 20 ? "…" : "");
                const isCurrent = idx === currentIndex;
                return (
                  <div
                    key={`${item.kind}-${item.id}-${idx}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setCurrentIndex(idx)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCurrentIndex(idx); } }}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs flex-shrink-0 cursor-pointer touch-manipulation ${
                      isCurrent
                        ? "bg-brand-500/10 border-brand-500/40 text-zinc-900 dark:text-zinc-100 ring-1 ring-brand-500/50"
                        : "bg-zinc-100 border-zinc-200 text-zinc-600 dark:bg-neutral-800 dark:border-neutral-700 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-neutral-700"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate max-w-[80px]">{label}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleRemoveFromQueue(idx); }}
                      className="p-0.5 rounded hover:bg-red-500/20 text-red-500 dark:text-red-400 flex-shrink-0"
                      aria-label={t("common.discard")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-5 space-y-6 py-5 pb-4 scrollbar-hide touch-pan-y">
        {processError && (
          <div className="rounded-xl bg-red-500/20 text-red-700 dark:text-red-300 px-4 py-3 text-sm">
            {processError}
          </div>
        )}
        {/* 2. Tarjeta Entrada Original (secundaria) */}
        <section className="rounded-2xl bg-zinc-100 border border-zinc-200 p-4 dark:bg-neutral-800/40 dark:border-neutral-700/50">
          <div className="flex gap-3">
            {(() => {
              const isPhoto = currentItem?.kind === "photo";
              const isImageFile = currentItem?.kind === "file" && (currentItem?.type === "image" || currentItem?.fileType === "image" || currentItem?.fileType === "photo");
              const thumbUrl = (isPhoto || isImageFile) && currentItem?.filePath ? buildUploadThumbUrl(currentItem.filePath) : null;
              if (thumbUrl) {
                return (
                  <>
                    <div className="flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden bg-zinc-200 dark:bg-neutral-700 border border-zinc-200 dark:border-neutral-600">
                      <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-zinc-500 dark:text-gray-500 text-xs uppercase tracking-wider mb-1">{t("processing.originalEntry")}</p>
                      <p className="text-zinc-700 dark:text-gray-400 text-sm whitespace-pre-wrap break-words line-clamp-4">
                        {rawPreview}
                      </p>
                    </div>
                  </>
                );
              }
              return (
                <>
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-brand-500/10 dark:bg-neutral-700/60 flex items-center justify-center">
                    <IconComponent className="w-5 h-5 text-brand-500 dark:text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-zinc-500 dark:text-gray-500 text-xs uppercase tracking-wider mb-1">{t("processing.originalEntry")}</p>
                    <p className="text-zinc-700 dark:text-gray-400 text-sm whitespace-pre-wrap break-words line-clamp-6">
                      {rawPreview}
                    </p>
                    {currentItem?.kind === "audio" && currentItem?.filePath && (
                      <AudioPlayerInline filePath={currentItem.filePath} durationSeconds={currentItem.durationSeconds} />
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </section>

        {/* 3. Tarjeta Sugerencia de IA (protagonista) */}
        <section className="rounded-2xl bg-zinc-50 border-2 border-brand-500/40 shadow-lg shadow-brand-500/10 p-4 dark:bg-neutral-800 dark:border-blue-500/40 dark:shadow-blue-500/10">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-gray-500 bg-gray-800/50 dark:text-neutral-400 dark:bg-neutral-900/60 px-2 py-1 rounded-md">
              {t("processing.saveIn")} {getTypeLabel(currentItem, t)}
            </div>
            {!isAnalyzing && (isEditing ? (
              <button
                type="button"
                onClick={handleSaveEdit}
                className="p-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white transition-colors"
                aria-label={t("common.saveChanges")}
              >
                <Save className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartEdit}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white dark:hover:text-white transition-colors hover:bg-neutral-700/50"
                aria-label={t("common.edit")}
              >
                <Pencil className="w-4 h-4" />
              </button>
            ))}
          </div>

          {isAnalyzing ? (
            <div className="flex flex-col items-center justify-center py-10 gap-4 transition-opacity">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400 dark:text-blue-400 shrink-0" />
              <p className="text-sm text-blue-400 dark:text-blue-400 font-medium animate-pulse">
                {t("processing.aiAnalyzing")}
              </p>
            </div>
          ) : (
            <>
              {/* Título de la IA */}
              <div className="mb-3">
                {isEditing ? (
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="w-full rounded-lg bg-neutral-900 text-white px-3 py-2 border border-neutral-700 text-sm outline-none focus:ring-2 focus:ring-brand-500/50 font-semibold"
                    placeholder={t("processing.itemTitlePlaceholder")}
                    maxLength={80}
                  />
                ) : (
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-white leading-tight">
                    {getDisplayTitle(currentItem, getTypeLabel(currentItem, t))}
                  </h3>
                )}
              </div>

              {/* Resumen de la IA */}
              <div className="mb-4">
                {isEditing ? (
                  <textarea
                    value={editedSummary}
                    onChange={(e) => setEditedSummary(e.target.value)}
                    className="w-full min-h-[100px] rounded-lg bg-neutral-900 text-white p-3 border border-neutral-700 text-sm resize-y outline-none focus:ring-2 focus:ring-brand-500/50"
                    placeholder={t("processing.editSummaryPlaceholder")}
                  />
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-300 italic leading-relaxed">
                    {editedSummary}
                  </p>
                )}
              </div>

              {currentItem?.detectedEvent && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 mb-4 flex items-start gap-3">
              <CalendarPlus className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-blue-300 font-semibold uppercase tracking-wider mb-1">
                  📅 {t("processing.eventDetected")}
                </p>
                <p className="text-sm text-white font-medium">{currentItem.detectedEvent.title}</p>
                <p className="text-xs text-neutral-400 mt-0.5">{currentItem.detectedEvent.date}</p>
                <p className="text-[10px] text-neutral-500 mt-2">
                  {t("processing.willAddToCalendar")}
                </p>
              </div>
            </div>
          )}

          {/* Tags / Topics */}
          {isEditing ? (
            <div>
              <p className="text-xs text-gray-500 dark:text-neutral-400 mb-1.5">
                {t("processing.tagsLabel")}
              </p>
              <input
                type="text"
                value={topicsInput}
                onChange={(e) => setTopicsInput(e.target.value)}
                className="w-full rounded-lg bg-neutral-900 text-white px-3 py-2 border border-neutral-700 text-sm outline-none focus:ring-2 focus:ring-brand-500/50"
                placeholder={t("processing.tagsPlaceholder")}
              />
            </div>
          ) : (
            editedTopics.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {editedTopics.map((topic) => (
                  <span
                    key={topic}
                    className="bg-blue-500/10 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 px-3 py-1 rounded-full text-xs font-medium"
                  >
                    #{topic}
                  </span>
                ))}
              </div>
            )
          )}
            </>
          )}
        </section>
      </main>

      <footer
        className="shrink-0 z-20 grid grid-cols-2 gap-3 w-full px-4 pt-3 bg-white border-t border-zinc-200 dark:bg-neutral-900 dark:border-neutral-800"
        style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom, 0px))" }}
      >
        <button
            type="button"
            onClick={handleDescartar}
            className="flex flex-col items-center justify-center gap-2 py-4 px-2 rounded-xl border border-red-400/50 text-red-600 hover:bg-red-500/10 transition-colors dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
            aria-label={t("common.discard")}
          >
            <Trash2 className="w-6 h-6" />
            <span className="text-xs font-medium">{t("common.discard")}</span>
          </button>
          <button
            type="button"
            onClick={handleAprobar}
            disabled={processing || isAnalyzing}
            className="flex flex-col items-center justify-center gap-2 py-4 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
            aria-label={t("common.approve")}
          >
            {processing ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Check className="w-6 h-6" />
            )}
          <span className="text-xs font-medium">{processing ? t("processing.processingLabel") : t("common.approve")}</span>
        </button>
      </footer>
    </div>
  );
}
