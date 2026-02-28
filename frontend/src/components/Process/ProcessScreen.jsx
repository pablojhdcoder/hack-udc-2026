import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Loader2,
  Link2,
  Mic,
  FileText,
  File,
  Trash2,
  Pencil,
  Check,
  ChevronDown,
  Folder,
  Save,
} from "lucide-react";
import { getInbox, processItems, discardItem } from "../../api/client";

const ICON_BY_KIND = {
  link: Link2,
  note: FileText,
  audio: Mic,
  file: File,
};

const MOCK_FOLDERS = [
  "estudio/SI",
  "proyectos/HackUDC",
  "referencias/React",
  "inbox",
];

const DEFAULT_NOTE_BODY = "Punto principal extraído de la entrada\nSegundo punto o referencia\nContexto o acción sugerida";

function getRawPreview(item) {
  if (item.content) return item.content;
  if (item.url) return item.title ? `${item.title}\n${item.url}` : item.url;
  if (item.filename) return item.filename;
  if (item.kind === "audio") return "Nota de voz";
  return "Sin contenido";
}

export default function ProcessScreen({ onBack, onProcessDone }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [suggestedFolder, setSuggestedFolder] = useState(MOCK_FOLDERS[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(DEFAULT_NOTE_BODY);
  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState(null);

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
    setEditedContent(DEFAULT_NOTE_BODY);
    setIsEditing(false);
  }, [currentIndex]);

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
      await processItems(
        [{ kind: currentItem.kind, id: currentItem.id }],
        suggestedFolder.trim() || MOCK_FOLDERS[0]
      );
      onProcessDone?.();
      await loadInbox();
      if (items.length <= 1) onBack();
    } catch (err) {
      setProcessError(err?.message ?? "Error al procesar");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full min-h-0 flex flex-col overflow-hidden bg-white dark:bg-zinc-900">
        <header className="shrink-0 z-10 flex items-center h-14 px-4 bg-white border-b border-zinc-200 safe-top dark:bg-zinc-900 dark:border-zinc-800">
          <button type="button" onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Volver">
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
      <div className="h-full min-h-0 flex flex-col overflow-hidden bg-white dark:bg-zinc-900">
        <header className="shrink-0 z-10 flex items-center h-14 px-4 bg-white border-b border-zinc-200 safe-top dark:bg-zinc-900 dark:border-zinc-800">
          <button type="button" onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Volver">
            <ArrowLeft className="w-6 h-6 text-zinc-600 dark:text-zinc-300" />
          </button>
          <h1 className="flex-1 text-center text-lg font-semibold text-zinc-900 dark:text-zinc-100">Procesar notas</h1>
          <div className="w-10" />
        </header>
        <main className="flex-1 flex items-center justify-center px-6">
          <p className="text-zinc-600 dark:text-zinc-500 text-sm text-center">No hay ítems en la fábrica de las ideas.</p>
        </main>
      </div>
    );
  }

  const IconComponent = ICON_BY_KIND[currentItem.kind] ?? FileText;
  const rawPreview = getRawPreview(currentItem);

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-white dark:bg-zinc-900 safe-bottom">
      <header className="shrink-0 z-20 flex flex-col bg-white border-b border-zinc-200 safe-top dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex items-center h-14 px-4">
          <button
            type="button"
            onClick={onBack}
            className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
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
        <section className="rounded-2xl bg-zinc-100 border border-zinc-200 p-4 dark:bg-gray-800/40 dark:border-gray-700/50">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-brand-500/10 dark:bg-gray-700/60 flex items-center justify-center">
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
        <section className="rounded-2xl bg-zinc-50 border-2 border-brand-500/40 shadow-lg shadow-brand-500/10 p-4 dark:bg-gray-800 dark:border-blue-500/40 dark:shadow-blue-500/10">
          <div className="relative mb-4">
            <button
              type="button"
              onClick={() => setDropdownOpen((o) => !o)}
              className="w-full flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border border-zinc-200 text-brand-600 text-sm font-medium dark:bg-gray-900 dark:border-0 dark:text-blue-400/90 cursor-pointer"
            >
              <Folder className="w-4 h-4 text-brand-500 dark:text-blue-400/80 flex-shrink-0" />
              <span className="flex-1 text-left truncate">{suggestedFolder}</span>
              <ChevronDown className={`w-4 h-4 text-zinc-400 dark:text-gray-400 flex-shrink-0 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} aria-hidden />
                <ul className="absolute top-full left-0 right-0 mt-2 z-20 py-1 rounded-2xl bg-white border border-zinc-200 shadow-xl max-h-48 overflow-y-auto dark:bg-gray-900 dark:border-gray-700">
                  {MOCK_FOLDERS.map((folder) => (
                    <li key={folder}>
                      <button
                        type="button"
                        onClick={() => {
                          setSuggestedFolder(folder);
                          setDropdownOpen(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-gray-800 flex items-center gap-2 ${suggestedFolder === folder ? "text-brand-600 dark:text-blue-400" : "text-zinc-800 dark:text-gray-200"}`}
                      >
                        <Folder className="w-4 h-4 opacity-70" />
                        {folder}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
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
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white dark:hover:text-white transition-colors hover:bg-gray-700/50"
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
                className="w-full min-h-[120px] rounded-lg bg-gray-900 text-white p-3 border border-gray-700 text-sm resize-y outline-none focus:ring-2 focus:ring-brand-500/50"
                placeholder="Edita el contenido de la nota..."
              />
            ) : (
              <ul className="list-disc list-inside space-y-2 text-zinc-700 dark:text-gray-200 text-sm">
                {editedContent.split("\n").filter(Boolean).map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {["#React", "#Frontend", "#HackUDC"].map((tag) => (
              <span
                key={tag}
                className="bg-brand-500/10 text-brand-600 dark:bg-blue-500/10 dark:text-blue-400 px-3 py-1 rounded-full text-xs font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>
      </main>

      <footer className="shrink-0 z-20 grid grid-cols-2 gap-3 w-full px-5 pt-4 pb-6 bg-white border-t border-zinc-200 safe-bottom dark:bg-zinc-900 dark:border-zinc-800">
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
