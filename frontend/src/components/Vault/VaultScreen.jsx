import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, FileText, Link2, File, Image, Mic, Video, Loader2, ChevronRight, RefreshCw, Trash2, Star, ExternalLink } from "lucide-react";
import {
  getVaultFolders,
  getProcessedRecent,
  getInboxByKind,
  getFavorites,
  discardItem,
  checkFavorite,
  addToFavorites,
  removeFromFavorites,
} from "../../api/client";

const ICON_BY_KIND = {
  note: FileText,
  link: Link2,
  file: File,
  photo: Image,
  audio: Mic,
  video: Video,
  favorite: Star,
};

const KIND_LABEL = {
  note: "Notas",
  link: "Enlaces",
  file: "Archivos",
  photo: "Fotos",
  audio: "Audio",
  video: "Video",
  favorite: "Favoritos",
};

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  if (d >= today) return "Hoy";
  if (d >= yesterday) return "Ayer";
  if (now - d < 7 * 24 * 60 * 60 * 1000) return "Esta semana";
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export default function VaultScreen({ onBack }) {
  const [folders, setFolders] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedKind, setSelectedKind] = useState(null);
  const [itemsByKind, setItemsByKind] = useState([]);
  const [loadingKind, setLoadingKind] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [favoriteCheck, setFavoriteCheck] = useState({ favorited: false, favoriteId: null });
  const [togglingFavorite, setTogglingFavorite] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [folderViewActive, setFolderViewActive] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [foldersRes, recentRes] = await Promise.all([
        getVaultFolders(),
        getProcessedRecent(5),
      ]);
      setFolders(Array.isArray(foldersRes.folders) ? foldersRes.folders : []);
      setRecent(Array.isArray(recentRes) ? recentRes : []);
    } catch (err) {
      setError(err?.message ?? "Error al cargar");
      setFolders([]);
      setRecent([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleFolderClick = useCallback(async (kind) => {
    setSelectedKind(kind);
    setFolderViewActive(true);
    setLoadingKind(true);
    setError(null);
    try {
      const list = kind === "favorite" ? await getFavorites() : await getInboxByKind(kind);
      setItemsByKind(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err?.message ?? "Error al cargar");
      setItemsByKind([]);
    } finally {
      setLoadingKind(false);
    }
  }, []);

  const handleBackFromFolder = useCallback(() => {
    setFolderViewActive(false);
    setSelectedKind(null);
    setItemsByKind([]);
  }, []);

  const handleBack = useCallback(() => onBack(), [onBack]);

  const isFavoriteFolder = selectedKind === "favorite";
  const isFavoriteItem = selectedItem?.kind === "favorite";

  const handleDeleteConfirm = useCallback(async () => {
    if (!selectedItem || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      if (isFavoriteItem || isFavoriteFolder) {
        await removeFromFavorites(selectedItem.id);
      } else {
        await discardItem(selectedItem.kind, selectedItem.id);
      }
      setSelectedItem(null);
      setShowDeleteConfirm(false);
      setToastMessage("Eliminado correctamente");
      setTimeout(() => setToastMessage(null), 2500);
      await load();
      if (selectedKind) {
        const list = selectedKind === "favorite" ? await getFavorites() : await getInboxByKind(selectedKind);
        setItemsByKind(Array.isArray(list) ? list : []);
      }
    } catch (err) {
      setError(err?.message ?? "Error al eliminar");
    } finally {
      setDeleting(false);
    }
  }, [selectedItem, selectedKind, deleting, load, isFavoriteItem, isFavoriteFolder]);

  const handleCancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
    setSelectedItem(null);
  }, []);

  useEffect(() => {
    if (selectedItem) setShowDeleteConfirm(false);
  }, [selectedItem]);

  useEffect(() => {
    if (!selectedItem || selectedItem.kind === "favorite") {
      setFavoriteCheck({ favorited: false, favoriteId: null });
      return;
    }
    let cancelled = false;
    checkFavorite(selectedItem.kind, selectedItem.id).then((r) => {
      if (!cancelled) setFavoriteCheck({ favorited: r.favorited, favoriteId: r.favoriteId });
    });
    return () => { cancelled = true; };
  }, [selectedItem]);

  const handleToggleFavorite = useCallback(async () => {
    if (!selectedItem || selectedItem.kind === "favorite" || togglingFavorite) return;
    setTogglingFavorite(true);
    setError(null);
    try {
      if (favoriteCheck.favorited) {
        await removeFromFavorites(favoriteCheck.favoriteId);
        setFavoriteCheck({ favorited: false, favoriteId: null });
        setToastMessage("Eliminado de favoritos");
      } else {
        const created = await addToFavorites(selectedItem.kind, selectedItem.id);
        setFavoriteCheck({ favorited: true, favoriteId: created.id });
        setToastMessage("Añadido a favoritos");
      }
      await load();
      if (selectedKind === "favorite") {
        const list = await getFavorites();
        setItemsByKind(Array.isArray(list) ? list : []);
      }
      setSelectedItem(null);
      setTimeout(() => setToastMessage(null), 2500);
    } catch (err) {
      setError(err?.message ?? "Error al actualizar favoritos");
    } finally {
      setTogglingFavorite(false);
    }
  }, [selectedItem, favoriteCheck, togglingFavorite, load, selectedKind]);

  const handleQuitarDeFavoritos = useCallback(async () => {
    if (!selectedItem || selectedItem.kind !== "favorite" || togglingFavorite) return;
    setTogglingFavorite(true);
    setError(null);
    try {
      await removeFromFavorites(selectedItem.id);
      setToastMessage("Eliminado de favoritos");
      setSelectedItem(null);
      await load();
      if (selectedKind === "favorite") {
        const list = await getFavorites();
        setItemsByKind(Array.isArray(list) ? list : []);
      }
      setTimeout(() => setToastMessage(null), 2500);
    } catch (err) {
      setError(err?.message ?? "Error al quitar de favoritos");
    } finally {
      setTogglingFavorite(false);
    }
  }, [selectedItem, togglingFavorite, load, selectedKind]);

  const selectedLabel = selectedKind ? (KIND_LABEL[selectedKind] || selectedKind) : null;

  const openItemUrl = useCallback(() => {
    if (!selectedItem) return;
    if (selectedItem.url) {
      window.open(selectedItem.url, "_blank", "noopener,noreferrer");
      return;
    }
    if (selectedItem.filePath) {
      const basename = selectedItem.filePath.split("/").pop() || selectedItem.filePath;
      window.open(`/api/uploads/${basename}`, "_blank", "noopener,noreferrer");
    }
  }, [selectedItem]);

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-white dark:bg-zinc-900">
      <header className="shrink-0 flex items-center h-14 px-4 bg-white border-b border-zinc-200 safe-top dark:bg-zinc-900 dark:border-zinc-800">
        {folderViewActive ? (
          <>
            <button
              type="button"
              onClick={handleBackFromFolder}
              className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Volver"
            >
              <ArrowLeft className="w-6 h-6 text-zinc-600 dark:text-zinc-300" />
            </button>
            <h1 className="flex-1 text-center text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate px-2">
              {selectedLabel ?? "Carpeta"}
            </h1>
            <button
              type="button"
              onClick={async () => {
                setLoadingKind(true);
                try {
                  const list = selectedKind === "favorite" ? await getFavorites() : await getInboxByKind(selectedKind);
                  setItemsByKind(Array.isArray(list) ? list : []);
                } finally {
                  setLoadingKind(false);
                }
              }}
              className="p-2 -mr-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Recargar"
            >
              <RefreshCw className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={handleBack}
              className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Volver"
            >
              <ArrowLeft className="w-6 h-6 text-zinc-600 dark:text-zinc-300" />
            </button>
            <h1 className="flex-1 text-center text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate px-2">
              El baúl de las ideas
            </h1>
            <button
              type="button"
              onClick={() => load()}
              className="p-2 -mr-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Recargar"
            >
              <RefreshCw className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
            </button>
          </>
        )}
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-5 space-y-6 scrollbar-hide">
        {error && (
          <div className="rounded-xl bg-red-500/15 text-red-700 dark:text-red-300 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {folderViewActive ? (
          loadingKind ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-10 h-10 text-brand-500 animate-spin mb-3" />
              <p className="text-zinc-500 text-sm">Cargando…</p>
            </div>
          ) : itemsByKind.length === 0 ? (
            <p className="text-zinc-500 dark:text-zinc-400 text-sm py-8">No hay ítems en esta carpeta.</p>
          ) : (
            <ul className="space-y-2">
              {itemsByKind.map((item) => {
                const Icon = ICON_BY_KIND[item.kind] ?? ICON_BY_KIND[item.sourceKind] ?? FileText;
                const displayName = item.filename ?? item.title ?? item.url?.slice(0, 40) ?? (item.content?.slice(0, 50) || "Sin título");
                const statusLabel = item.kind === "favorite"
                  ? (item.sourceKind ? KIND_LABEL[item.sourceKind] || item.sourceKind : "")
                  : (item.inboxStatus === "processed" ? (item.processedPath || "Procesado") : "Pendiente");
                const typeLabel = item.type ? ` · ${item.type}` : "";
                return (
                  <li key={`${item.kind}-${item.id}`}>
                    <button
                      type="button"
                      onClick={() => setSelectedItem(item)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-left hover:bg-zinc-100 transition-colors dark:bg-zinc-800/60 dark:border-zinc-700/50 dark:hover:bg-zinc-800/80"
                    >
                      <div className="w-9 h-9 rounded-lg bg-brand-500/10 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-brand-500 dark:text-zinc-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-zinc-800 dark:text-zinc-200 text-sm font-medium truncate">{displayName}</p>
                        <p className="text-zinc-500 dark:text-zinc-400 text-xs truncate">{statusLabel}{typeLabel} · {formatDate(item.createdAt)}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-10 h-10 text-brand-500 animate-spin mb-3" />
            <p className="text-zinc-500 text-sm">Cargando carpetas…</p>
          </div>
        ) : (
          <>
            <section>
              <h2 className="text-zinc-500 dark:text-zinc-400 text-xs font-medium uppercase tracking-wider mb-3">
                Carpetas
              </h2>
              <div className="grid grid-cols-1 gap-3">
                {folders.map((f) => {
                  const Icon = ICON_BY_KIND[f.kind] ?? FileText;
                  const label = f.name || KIND_LABEL[f.kind] || f.kind;
                  return (
                    <button
                      key={f.kind}
                      type="button"
                      onClick={() => handleFolderClick(f.kind)}
                      className="flex items-center justify-between p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-left hover:bg-zinc-100 transition-colors dark:bg-zinc-800/80 dark:border-zinc-700/50 dark:hover:bg-zinc-800"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-brand-500/10 dark:bg-zinc-700 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-brand-500 dark:text-zinc-300" />
                        </div>
                        <span className="text-zinc-900 dark:text-zinc-100 font-medium">{label}</span>
                      </div>
                      <span className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-sm tabular-nums">
                        {f.count} {f.count === 1 ? "ítem" : "ítems"}
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <h2 className="text-zinc-500 dark:text-zinc-400 text-xs font-medium uppercase tracking-wider mb-3">
                Procesados recientes
              </h2>
              {recent.length === 0 ? (
                <p className="text-zinc-500 dark:text-zinc-400 text-sm py-4">Aún no hay ítems procesados.</p>
              ) : (
                <ul className="space-y-2">
                  {recent.map((item) => {
                    const Icon = ICON_BY_KIND[item.kind] ?? FileText;
                    return (
                      <li key={`${item.kind}-${item.id}`}>
                        <button
                          type="button"
                          onClick={() => setSelectedItem(item)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-left hover:bg-zinc-100 transition-colors dark:bg-zinc-800/60 dark:border-zinc-700/50 dark:hover:bg-zinc-800/80"
                        >
                          <div className="w-9 h-9 rounded-lg bg-brand-500/10 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-4 h-4 text-brand-500 dark:text-zinc-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-zinc-800 dark:text-zinc-200 text-sm font-medium truncate">
                              {item.title || "Sin título"}
                            </p>
                            <p className="text-zinc-500 dark:text-zinc-400 text-xs">
                              {item.processedPath || formatDate(item.createdAt)}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </main>

      {toastMessage && (
        <div className="fixed top-4 left-4 right-4 z-[60] flex justify-center pointer-events-none">
          <div className="rounded-xl bg-emerald-600 text-white px-4 py-2.5 text-sm font-medium shadow-lg">
            {toastMessage}
          </div>
        </div>
      )}

      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          aria-modal="true"
          role="dialog"
          onClick={() => {
            if (deleting || togglingFavorite) return;
            if (showDeleteConfirm) handleCancelDelete();
            else setSelectedItem(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-white dark:bg-zinc-900 p-4 pb-safe shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {showDeleteConfirm ? (
              <>
                <p className="text-zinc-700 dark:text-zinc-300 text-sm mb-4">
                  ¿Seguro que quieres eliminarlo?
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleCancelDelete}
                    disabled={deleting}
                    className="flex-1 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm font-medium disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteConfirm}
                    disabled={deleting}
                    className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aceptar"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-zinc-700 dark:text-zinc-300 text-sm mb-4">
                  {selectedItem.filename ?? selectedItem.title ?? selectedItem.url?.slice(0, 40) ?? "Ítem"}
                </p>
                <div className="flex flex-wrap gap-3">
                  {(selectedItem.url || selectedItem.filePath) && (
                    <button
                      type="button"
                      onClick={openItemUrl}
                      className="flex-1 min-w-[100px] py-2.5 rounded-xl border border-brand-500/50 bg-brand-500/10 text-brand-600 dark:text-brand-400 text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {selectedItem.url ? "Abrir enlace" : "Ver archivo"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    disabled={togglingFavorite}
                    className="flex-1 min-w-[100px] py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm font-medium disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  {isFavoriteItem ? (
                    <button
                      type="button"
                      onClick={handleQuitarDeFavoritos}
                      disabled={togglingFavorite}
                      className="flex-1 min-w-[100px] py-2.5 rounded-xl border border-amber-400 dark:border-amber-500 text-amber-600 dark:text-amber-400 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {togglingFavorite ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
                      Quitar de favoritos
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleToggleFavorite}
                      disabled={togglingFavorite}
                      className="flex-1 min-w-[100px] py-2.5 rounded-xl border border-amber-400 dark:border-amber-500 text-amber-600 dark:text-amber-400 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {togglingFavorite ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
                      {favoriteCheck.favorited ? "Quitar de favoritos" : "Añadir a favoritos"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={togglingFavorite}
                    className="flex-1 min-w-[100px] py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
