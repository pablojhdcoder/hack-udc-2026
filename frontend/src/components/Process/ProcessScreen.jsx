import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Loader2, Check, FolderOpen } from "lucide-react";
import { getInbox, processItems } from "../../api/client";

export default function ProcessScreen({ onBack, onProcessDone }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [destination, setDestination] = useState("inbox");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { items: data } = await getInbox();
      setItems(Array.isArray(data) ? data : []);
      setSelectedIds(new Set());
    } catch (err) {
      setError(err.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  const toggleItem = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  };

  const handleProcess = async () => {
    if (selectedIds.size === 0 || !destination.trim()) return;
    const ids = items
      .filter((i) => selectedIds.has(i.id))
      .map((i) => ({ kind: i.kind, id: i.id }));
    setProcessing(true);
    setError(null);
    try {
      const data = await processItems(ids, destination.trim());
      setResult(data);
      if (onProcessDone) await onProcessDone();
      onBack();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-zinc-900">
        <header className="sticky top-0 z-10 flex items-center gap-3 h-14 px-4 bg-zinc-900 border-b border-zinc-800 safe-top">
          <button type="button" onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-zinc-800" aria-label="Volver">
            <ArrowLeft className="w-6 h-6 text-zinc-300" />
          </button>
          <h1 className="text-lg font-semibold text-zinc-100">Procesar notas</h1>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-900">
      <header className="sticky top-0 z-10 flex items-center gap-3 h-14 px-4 bg-zinc-900 border-b border-zinc-800 safe-top">
        <button
          type="button"
          onClick={onBack}
          className="p-2 -ml-2 rounded-lg hover:bg-zinc-800 transition-colors"
          aria-label="Volver al inbox"
        >
          <ArrowLeft className="w-6 h-6 text-zinc-300" />
        </button>
        <h1 className="text-lg font-semibold text-zinc-100">Procesar notas</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/20 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="flex items-center gap-2 text-zinc-400 text-sm mb-2">
            <FolderOpen className="w-4 h-4" />
            Carpeta de destino (en knowledge)
          </label>
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="ej. estudio/SI"
            className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-zinc-400 text-sm">
            {items.length} ítem(s) en inbox
          </span>
          <button
            type="button"
            onClick={selectAll}
            className="text-brand-400 hover:text-brand-300 text-sm"
          >
            {selectedIds.size === items.length ? "Quitar todos" : "Seleccionar todos"}
          </button>
        </div>

        {items.length === 0 ? (
          <p className="text-zinc-500 text-sm text-center py-8">
            No hay nada en el inbox. Añade notas o enlaces desde la pantalla principal.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id}>
                <label className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/80 border border-zinc-700/50 cursor-pointer hover:bg-zinc-800">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={() => toggleItem(item.id)}
                    className="rounded border-zinc-600 text-brand-500 focus:ring-brand-500"
                  />
                  <span className="flex-1 min-w-0 truncate text-zinc-200 text-sm">
                    {item.kind === "note" && item.content?.slice(0, 50)}
                    {item.kind === "link" && (item.title || item.url)}
                    {item.kind === "file" && item.filename}
                    {item.kind === "audio" && "Nota de voz"}
                  </span>
                  <span className="text-zinc-500 text-xs capitalize">{item.kind}</span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <div className="pt-4">
          <button
            type="button"
            onClick={handleProcess}
            disabled={selectedIds.size === 0 || !destination.trim() || processing}
            className="w-full py-3 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-medium disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {processing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Procesando…
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                Procesar {selectedIds.size} seleccionado(s)
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
