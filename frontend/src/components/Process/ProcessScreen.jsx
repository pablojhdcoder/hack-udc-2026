import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
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
} from "lucide-react";
import { getInbox, processItems, discardItem } from "../../api/client";

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
function getTypeLabel(item) {
  if (!item) return "Nota";
  const kindLabels = { note: "Nota", link: "Enlace", file: "Archivo", photo: "Foto", audio: "Audio", video: "Vídeo" };
  return kindLabels[item.kind] ?? item.type ?? "Nota";
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

/** Topics/tags del ítem para las píldoras (#topic). */
function getItemTopics(item) {
  const list = [];
  if (item?.topic && String(item.topic).trim()) list.push(String(item.topic).trim());
  if (item?.aiEnrichment) {
    try {
      const data = typeof item.aiEnrichment === "string" ? JSON.parse(item.aiEnrichment) : item.aiEnrichment;
      const tags = data?.tags;
      if (Array.isArray(tags)) tags.forEach((t) => t && list.push(String(t).trim()));
    } catch {}
  }
  return [...new Set(list)];
}

const DEFAULT_NOTE_BODY = "Breve resumen generado por IA sobre el contenido capturado...";

function getRawPreview(item) {
  if (item.content) return item.content;
  if (item.url) return item.title ? `${item.title}\n${item.url}` : item.url;
  if (item.filename) return item.filename;
  if (item.kind === "audio") return "Nota de voz";
  return "Sin contenido";
}

export default function ProcessScreen({ onBack, onProcessDone, onOpenVault }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(DEFAULT_NOTE_BODY);
  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState(null);
  const [successInfo, setSuccessInfo] = useState(null);

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
    loadInbox();
  }, [loadInbox]);

  useEffect(() => {
    const item = items[currentIndex];
    const summary = item ? getAISummary(item) : null;
    setEditedContent(summary || DEFAULT_NOTE_BODY);
    setIsEditing(false);
  }, [currentIndex, items]);

  const currentItem = items[currentIndex];
  const total = items.length;
  const progress = total > 0 ? ((currentIndex + 1) / total) * 100 : 0;

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
      setProcessError(err?.message ?? "Error al descartar");
    }
  };

  const handleAprobar = async () => {
    if (!currentItem || processing) return;
    setProcessError(null);
    setProcessing(true);
    try {
      const destination = currentItem ? getDestinationFromKind(currentItem.kind) : "notas";
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
      onProcessDone?.();
      await loadInbox();
    } catch (err) {
      setProcessError(err?.message ?? "Error al procesar");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full min-h-0 flex flex-col overflow-hidden bg-white dark:bg-neutral-900">
        <header className="shrink-0 z-10 flex items-center h-14 px-4 bg-white border-b border-zinc-200 safe-top dark:bg-neutral-900 dark:border-neutral-800">
          <button type="button" onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800" aria-label="Volver">
            <ArrowLeft className="w-6 h-6 text-zinc-600 dark:text-zinc-300" />
          </button>
          <h1 className="flex-1 text-center text-lg font-semibold text-zinc-900 dark:text-zinc-100">Procesar notas</h1>
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
                  <p className="text-sm font-semibold">Idea guardada en el baúl</p>
                  <p className="text-xs opacity-90 truncate">Ruta: {successInfo.destination}</p>
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
        <header className="shrink-0 z-10 flex items-center h-14 px-4 bg-white border-b border-zinc-200 safe-top dark:bg-neutral-900 dark:border-neutral-800">
          <button type="button" onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800" aria-label="Volver">
            <ArrowLeft className="w-6 h-6 text-zinc-600 dark:text-zinc-300" />
          </button>
          <h1 className="flex-1 text-center text-lg font-semibold text-zinc-900 dark:text-zinc-100">Procesar notas</h1>
          <div className="w-10" />
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
          <p className="text-zinc-700 dark:text-zinc-300 text-lg font-medium text-center">Tu cerebro está despejado</p>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm text-center">
            {successInfo ? "La idea se ha guardado en el baúl. Pulsa «Ver» arriba para ir a la carpeta o vuelve a la fábrica." : "No hay más ideas por procesar."}
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
                Ver en el Baúl
              </button>
            )}
            <button
              type="button"
              onClick={onBack}
              className="px-5 py-2.5 rounded-xl border border-zinc-300 dark:border-neutral-600 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-neutral-800"
            >
              Volver a la fábrica
            </button>
          </div>
        </main>
      </div>
    );
  }

  const IconComponent = ICON_BY_KIND[currentItem.kind] ?? FileText;
  const rawPreview = getRawPreview(currentItem);

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
            aria-label="Volver a la fábrica de las ideas"
          >
            <ArrowLeft className="w-6 h-6 text-zinc-600 dark:text-zinc-300" />
          </button>
          <div className="flex-1 flex flex-col items-center justify-center py-1">
            <p className="text-zinc-900 dark:text-zinc-100 font-medium text-sm">
              Procesando {currentIndex + 1} de {total}
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
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-5 space-y-6 py-5 pb-4 scrollbar-hide">
        {processError && (
          <div className="rounded-xl bg-red-500/20 text-red-700 dark:text-red-300 px-4 py-3 text-sm">
            {processError}
          </div>
        )}
        {/* 2. Tarjeta Entrada Original (secundaria) */}
        <section className="rounded-2xl bg-zinc-100 border border-zinc-200 p-4 dark:bg-neutral-800/40 dark:border-neutral-700/50">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-brand-500/10 dark:bg-neutral-700/60 flex items-center justify-center">
              <IconComponent className="w-5 h-5 text-brand-500 dark:text-gray-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-zinc-500 dark:text-gray-500 text-xs uppercase tracking-wider mb-1">Entrada original</p>
              <p className="text-zinc-700 dark:text-gray-400 text-sm whitespace-pre-wrap break-words line-clamp-6">
                {rawPreview}
              </p>
            </div>
          </div>
        </section>

        {/* 3. Tarjeta Sugerencia de IA (protagonista) */}
        <section className="rounded-2xl bg-zinc-50 border-2 border-brand-500/40 shadow-lg shadow-brand-500/10 p-4 dark:bg-neutral-800 dark:border-blue-500/40 dark:shadow-blue-500/10">
          <div className="text-xs text-gray-500 bg-gray-800/50 dark:text-neutral-400 dark:bg-neutral-900/60 w-max px-2 py-1 rounded-md mb-3">
            Se guardará en: {getTypeLabel(currentItem)}
          </div>

          <div className="mb-4 relative">
            <div className="absolute top-0 right-0 z-10">
              {isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="p-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white transition-colors"
                  aria-label="Guardar"
                >
                  <Save className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white dark:hover:text-white transition-colors hover:bg-neutral-700/50"
                  aria-label="Editar"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2 pr-10">
              Nota procesada — {currentItem.kind === "link" ? "Enlace" : currentItem.kind === "audio" ? "Voz" : currentItem.type || "Nota"}
            </h3>
            {isEditing ? (
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full min-h-[120px] rounded-lg bg-neutral-900 text-white p-3 border border-neutral-700 text-sm resize-y outline-none focus:ring-2 focus:ring-brand-500/50 dark:bg-neutral-900 dark:border-neutral-700"
                placeholder="Edita el resumen..."
              />
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-300 italic mb-4 leading-relaxed pr-10">
                {editedContent}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {getItemTopics(currentItem).map((topic) => (
              <span
                key={topic}
                className="bg-blue-500/10 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 px-3 py-1 rounded-full text-xs font-medium mr-2"
              >
                #{topic}
              </span>
            ))}
          </div>
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
            aria-label="Descartar"
          >
            <Trash2 className="w-6 h-6" />
            <span className="text-xs font-medium">Descartar</span>
          </button>
          <button
            type="button"
            onClick={handleAprobar}
            disabled={processing}
            className="flex flex-col items-center justify-center gap-2 py-4 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-60 disabled:pointer-events-none"
            aria-label="Aprobar"
          >
            {processing ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Check className="w-6 h-6" />
            )}
          <span className="text-xs font-medium">{processing ? "Procesando…" : "Aprobar"}</span>
        </button>
      </footer>
    </div>
  );
}
