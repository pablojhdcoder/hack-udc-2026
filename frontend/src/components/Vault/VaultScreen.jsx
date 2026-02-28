import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, FileText, Link2, File, FileCode, Image, Mic, Video, Play, Loader2, ChevronRight, RefreshCw, Trash2, Star, ExternalLink, Sparkles, Search, X } from "lucide-react";
import { getYouTubeVideoId } from "../../utils/youtube";
import {
  getVaultFolders,
  getProcessedRecent,
  getNovelties,
  getWeeklyWrapped,
  markOpened,
  getInboxByKind,
  getFavorites,
  getInboxItem,
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
  novelty: Sparkles,
  favorite: Star,
};

const ICON_STYLE_BY_KIND = {
  note: { Icon: FileText, text: "text-emerald-400", bg: "bg-emerald-400/10" },
  link: { Icon: Link2, text: "text-sky-400", bg: "bg-sky-400/10" },
  file: { Icon: FileCode, text: "text-red-400", bg: "bg-red-400/10" },
  photo: { Icon: Image, text: "text-zinc-400", bg: "bg-neutral-700" },
  audio: { Icon: Mic, text: "text-amber-400", bg: "bg-amber-400/10" },
  video: { Icon: Video, text: "text-zinc-400", bg: "bg-neutral-700" },
  novelty: { Icon: Sparkles, text: "text-brand-500", bg: "bg-brand-500/10" },
  favorite: { Icon: Star, text: "text-brand-500", bg: "bg-brand-500/10" },
};

const KIND_LABEL = {
  note: "Notas",
  link: "Enlaces",
  file: "Archivos",
  photo: "Fotos",
  audio: "Audio",
  video: "Video",
  novelty: "Novedades",
  favorite: "Favoritos",
};

const thumbImgClass = "w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-neutral-800";

/** Construye URL de miniatura para foto/archivo (filePath puede ser relativo o con backslashes). */
function buildUploadThumbUrl(filePath) {
  if (!filePath || typeof filePath !== "string") return null;
  const normalized = filePath.trim().replace(/\\/g, "/");
  return normalized ? `/api/uploads/${normalized}` : null;
}

/** Overlay de Play para vídeos/YouTube (centro, círculo oscuro semitransparente, icono play blanco). */
function PlayOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none" aria-hidden>
      <div className="w-9 h-9 rounded-full bg-black/60 flex items-center justify-center text-white ring-2 ring-white/30">
        <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
      </div>
    </div>
  );
}

/**
 * Miniatura/icono izquierdo unificado (w-14 h-14) para todas las vistas:
 * Búsqueda, Fotos, Vídeo, Novedades, Favoritos, Procesados recientes.
 * - Fotos: <img> con thumbnailUrl o filePath; onError → icono de fallback.
 * - Vídeos: miniatura (thumbnailUrl o YouTube desde url/filePath) + overlay Play.
 * - Enlaces YouTube: miniatura + Play.
 * - Resto: icono con color por tipo.
 */
function ItemThumbnail({ item }) {
  const [imgError, setImgError] = useState(false);
  const kind = item.kind ?? item.sourceKind;
  const type = item.type ?? item.fileType ?? "";
  const isPhoto = kind === "photo" || (kind === "file" && (type === "image" || type === "photo"));
  const isVideo = kind === "video";
  const linkUrl = item.url ?? null;
  const videoUrl = isVideo ? (item.url || item.filePath || "") : linkUrl;
  const youtubeId = getYouTubeVideoId(videoUrl);
  const isYouTube = Boolean(youtubeId);

  const photoThumbUrl =
    item.thumbnailUrl ||
    (isPhoto && item.filePath ? buildUploadThumbUrl(item.filePath) : null);
  const videoThumbUrl =
    item.thumbnailUrl ||
    (isYouTube ? `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg` : null) ||
    (isVideo && item.filePath ? buildUploadThumbUrl(item.filePath) : null);

  const showPhotoImg = isPhoto && photoThumbUrl && !imgError;
  const showVideoThumb = (isVideo || isYouTube) && videoThumbUrl && !imgError;

  const style = ICON_STYLE_BY_KIND[kind] ?? ICON_STYLE_BY_KIND.note;
  const { Icon, text, bg } = style;

  if (showVideoThumb) {
    return (
      <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 border border-neutral-800 shadow-md">
        <img
          src={videoThumbUrl}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
        <PlayOverlay />
      </div>
    );
  }
  if (showPhotoImg) {
    return (
      <img
        src={photoThumbUrl}
        alt=""
        className={thumbImgClass}
        onError={() => setImgError(true)}
      />
    );
  }
  return (
    <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
      <Icon className={`w-7 h-7 ${text}`} />
    </div>
  );
}

const rowButtonClass =
  "w-full flex items-center gap-3 p-3 rounded-2xl bg-zinc-50 border border-zinc-200 text-left hover:bg-zinc-100 transition-colors dark:bg-neutral-800/60 dark:border-neutral-700/50 dark:hover:bg-neutral-800/80";

/**
 * Fila de lista unificada para Búsqueda, Fotos, Vídeo, Novedades, Favoritos y Procesados recientes.
 * Misma previsualización (ItemThumbnail) y mismo layout en todas las vistas.
 */
function VaultListItem({ item, onSelect }) {
  const displayName =
    item.filename ??
    item.title ??
    item.url?.slice(0, 40) ??
    (item.content?.slice(0, 50) || "Sin título");
  const statusLabel =
    item.kind === "favorite"
      ? (item.sourceKind ? KIND_LABEL[item.sourceKind] || item.sourceKind : "")
      : (item.inboxStatus === "processed" ? (item.processedPath || "Procesado") : "Pendiente");
  const typeLabel = item.type ? ` · ${item.type}` : "";
  const subtitle = item.processedPath || `${statusLabel}${typeLabel} · ${formatDate(item.createdAt)}`;

  return (
    <li>
      <button type="button" onClick={() => onSelect(item)} className={rowButtonClass}>
        <ItemThumbnail item={item} />
        <div className="flex-1 min-w-0">
          <p className="text-zinc-800 dark:text-zinc-200 text-sm font-medium truncate">{displayName}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            {item.topic && (
              <span className="text-xs text-blue-400 bg-blue-950/50 px-2 py-0.5 rounded-md">
                #{item.topic}
              </span>
            )}
            <span className="text-zinc-500 dark:text-zinc-400 text-xs truncate">{subtitle}</span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
      </button>
    </li>
  );
}

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

export default function VaultScreen({ onBack, initialFolder, initialItemId }) {
  const [folders, setFolders] = useState([]);
  const [recent, setRecent] = useState([]);
  const [weeklyWrapped, setWeeklyWrapped] = useState([]);
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
  const [fullNoteContent, setFullNoteContent] = useState(null);
  const [loadingNote, setLoadingNote] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef(null);
  const lastOpenedKeyRef = useRef(null);
  const initialAppliedRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [foldersRes, recentRes, weeklyRes] = await Promise.all([
        getVaultFolders(),
        getProcessedRecent(5),
        getWeeklyWrapped(15),
      ]);
      setFolders(Array.isArray(foldersRes.folders) ? foldersRes.folders : []);
      setRecent(Array.isArray(recentRes) ? recentRes : []);
      setWeeklyWrapped(Array.isArray(weeklyRes) ? weeklyRes : []);
    } catch (err) {
      setError(err?.message ?? "Error al cargar");
      setFolders([]);
      setRecent([]);
      setWeeklyWrapped([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const fetchFolderItems = useCallback(async (kind) => {
    if (kind === "favorite") return getFavorites();
    if (kind === "novelty") return getNovelties(100);
    return getInboxByKind(kind);
  }, []);

  const handleFolderClick = useCallback(async (kind) => {
    setSelectedKind(kind);
    setFolderViewActive(true);
    setLoadingKind(true);
    setError(null);
    try {
      const list = await fetchFolderItems(kind);
      setItemsByKind(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err?.message ?? "Error al cargar");
      setItemsByKind([]);
    } finally {
      setLoadingKind(false);
    }
  }, [fetchFolderItems]);

  useEffect(() => {
    if (!initialFolder || loading) return;
    if (!selectedKind && !loadingKind) {
      handleFolderClick(initialFolder);
    }
  }, [initialFolder, loading, selectedKind, loadingKind, handleFolderClick]);

  useEffect(() => {
    if (!initialFolder || !initialItemId || initialAppliedRef.current) return;
    if (selectedKind === initialFolder && itemsByKind.length > 0 && !loadingKind) {
      const item = itemsByKind.find((i) => i.id === initialItemId);
      if (item) setSelectedItem(item);
      initialAppliedRef.current = true;
    }
  }, [initialFolder, initialItemId, selectedKind, itemsByKind, loadingKind]);

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
        const list = await fetchFolderItems(selectedKind);
        setItemsByKind(Array.isArray(list) ? list : []);
      }
    } catch (err) {
      setError(err?.message ?? "Error al eliminar");
    } finally {
      setDeleting(false);
    }
  }, [selectedItem, selectedKind, deleting, load, isFavoriteItem, isFavoriteFolder, fetchFolderItems]);

  const handleCancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
    setSelectedItem(null);
  }, []);

  useEffect(() => {
    if (selectedItem) setShowDeleteConfirm(false);
  }, [selectedItem]);

  useEffect(() => {
    lastOpenedKeyRef.current = null;
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

  const isNoteItem = selectedItem?.kind === "note" || selectedItem?.sourceKind === "note";
  useEffect(() => {
    const isNote = selectedItem && (selectedItem.kind === "note" || (selectedItem.kind === "favorite" && selectedItem.sourceKind === "note"));
    if (!isNote) {
      setFullNoteContent(null);
      setLoadingNote(false);
      return;
    }
    const kind = selectedItem.kind === "favorite" ? selectedItem.sourceKind : selectedItem.kind;
    const id = selectedItem.kind === "favorite" ? selectedItem.sourceId : selectedItem.id;
    setLoadingNote(true);
    setFullNoteContent(null);
    let cancelled = false;
    getInboxItem(kind, id)
      .then((data) => {
        if (!cancelled) setFullNoteContent(data.content ?? "");
        const key = `${kind}:${id}`;
        if (!cancelled && lastOpenedKeyRef.current !== key) {
          lastOpenedKeyRef.current = key;
          markOpened(kind, id)
            .then(async () => {
              await load();
              if (selectedKind === "novelty") {
                setItemsByKind((prev) => prev.filter((it) => !(it.kind === kind && it.id === id)));
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        if (!cancelled) setFullNoteContent(selectedItem.content ?? "");
      })
      .finally(() => {
        if (!cancelled) setLoadingNote(false);
      });
    return () => { cancelled = true; };
  }, [selectedItem, selectedKind, load]);

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

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  // Búsqueda por topic/filename en backend: debounce 500ms → fetch /api/search?q=
  useEffect(() => {
    const q = searchTerm.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error("Error en búsqueda");
        const data = await res.json();
        setSearchResults(Array.isArray(data) ? data : []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const handleCloseSearch = useCallback(() => {
    setSearchTerm("");
    setSearchResults([]);
    setSearchOpen(false);
  }, []);

  const handleBuscar = useCallback(() => {
    setSearchOpen(false);
  }, []);

  const openItemUrl = useCallback(() => {
    if (!selectedItem) return;
    const kind = selectedItem.kind === "favorite" ? selectedItem.sourceKind : selectedItem.kind;
    const id = selectedItem.kind === "favorite" ? selectedItem.sourceId : selectedItem.id;
    if (kind && id && kind !== "favorite") {
      const key = `${kind}:${id}`;
      if (lastOpenedKeyRef.current !== key) {
        lastOpenedKeyRef.current = key;
        markOpened(kind, id)
          .then(async () => {
            await load();
            if (selectedKind === "novelty") {
              setItemsByKind((prev) => prev.filter((it) => !(it.kind === kind && it.id === id)));
            }
          })
          .catch(() => {});
      }
    }
    if (selectedItem.url) {
      window.open(selectedItem.url, "_blank", "noopener,noreferrer");
      return;
    }
    if (selectedItem.filePath) {
      const basename = selectedItem.filePath.split("/").pop() || selectedItem.filePath;
      window.open(`/api/uploads/${basename}`, "_blank", "noopener,noreferrer");
    }
  }, [selectedItem, selectedKind, load]);

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-white dark:bg-neutral-900">
      <header className="shrink-0 flex items-center h-14 px-4 bg-white border-b border-zinc-200 safe-top dark:bg-neutral-900 dark:border-neutral-800">
        {searchOpen ? (
          <div className="flex items-center gap-2 w-full">
            <button
              type="button"
              onClick={handleCloseSearch}
              className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800 shrink-0"
              aria-label="Cerrar búsqueda"
            >
              <X className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
            </button>
            <input
              ref={searchInputRef}
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
              placeholder="Buscar en el baúl (por nombre o tema)..."
              className="flex-1 min-w-0 bg-zinc-100 dark:bg-neutral-800 border border-zinc-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 text-sm outline-none focus:ring-2 focus:ring-brand-500/50"
              aria-label="Buscar"
            />
            <button
              type="button"
              onClick={handleBuscar}
              className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium shrink-0"
            >
              Buscar
            </button>
          </div>
        ) : folderViewActive ? (
          <>
            <button
              type="button"
              onClick={() => {
                if (initialFolder && selectedKind === initialFolder && initialAppliedRef.current) {
                  onBack();
                } else {
                  handleBackFromFolder();
                }
              }}
              className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800"
              aria-label="Volver"
            >
              <ArrowLeft className="w-6 h-6 text-zinc-600 dark:text-zinc-300" />
            </button>
            <h1 className="flex-1 text-center text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate px-2">
              {selectedLabel ?? "Carpeta"}
            </h1>
            <div className="flex items-center gap-0">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800"
                aria-label="Buscar"
              >
                <Search className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
              </button>
              <button
                type="button"
                onClick={async () => {
                  setLoadingKind(true);
                  try {
                    const list = await fetchFolderItems(selectedKind);
                    setItemsByKind(Array.isArray(list) ? list : []);
                  } finally {
                    setLoadingKind(false);
                  }
                }}
                className="p-2 -mr-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800"
                aria-label="Recargar"
              >
                <RefreshCw className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={handleBack}
              className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800"
              aria-label="Volver"
            >
              <ArrowLeft className="w-6 h-6 text-zinc-600 dark:text-zinc-300" />
            </button>
            <h1 className="flex-1 text-center text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate px-2">
              El baúl de las ideas
            </h1>
            <div className="flex items-center gap-0">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800"
                aria-label="Buscar"
              >
                <Search className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
              </button>
              <button
                type="button"
                onClick={() => load()}
                className="p-2 -mr-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800"
                aria-label="Recargar"
              >
                <RefreshCw className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
              </button>
            </div>
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
              {itemsByKind.map((item) => (
                <VaultListItem key={`${item.kind}-${item.id}`} item={item} onSelect={setSelectedItem} />
              ))}
            </ul>
          )
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-10 h-10 text-brand-500 animate-spin mb-3" />
            <p className="text-zinc-500 text-sm">Cargando carpetas…</p>
          </div>
        ) : searchTerm.trim() ? (
          <div className="flex-1 min-h-0 flex flex-col">
            {searchLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-10 h-10 text-brand-500 animate-spin mb-3" />
                <p className="text-zinc-500 dark:text-zinc-400 text-sm">Buscando en tu cerebro digital…</p>
              </div>
            ) : searchResults.length === 0 ? (
              <p className="text-zinc-500 dark:text-zinc-400 text-sm py-8">No se han encontrado resultados.</p>
            ) : (
              <ul className="space-y-2">
                {searchResults.map((item) => (
                  <VaultListItem key={`search-${item.kind ?? "item"}-${item.id}`} item={item} onSelect={setSelectedItem} />
                ))}
              </ul>
            )}
          </div>
        ) : (
          <>
            <section>
              <h2 className="text-zinc-500 dark:text-zinc-400 text-xs font-medium uppercase tracking-wider mb-3">
                Carpetas
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {folders.map((f) => {
                  const Icon = ICON_BY_KIND[f.kind] ?? FileText;
                  const label = f.name || KIND_LABEL[f.kind] || f.kind;
                  return (
                    <button
                      key={f.kind}
                      type="button"
                      onClick={() => handleFolderClick(f.kind)}
                      className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-center hover:bg-zinc-100 transition-colors dark:bg-neutral-800/80 dark:border-neutral-700/50 dark:hover:bg-neutral-800"
                    >
                      <div className="w-10 h-10 rounded-xl bg-brand-500/10 dark:bg-neutral-700 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-brand-500 dark:text-zinc-300" />
                      </div>
                      <span className="text-zinc-900 dark:text-zinc-100 font-medium text-sm leading-tight line-clamp-2">
                        {label}
                      </span>
                      <span className="text-zinc-500 dark:text-zinc-400 text-xs tabular-nums">
                        {f.count} {f.count === 1 ? "ítem" : "ítems"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {weeklyWrapped.length > 0 && (
              <section>
                <h2 className="text-zinc-500 dark:text-zinc-400 text-xs font-medium uppercase tracking-wider mb-3">
                  Tus hits de la semana
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-3">
                  Lo que más has abierto en los últimos 7 días
                </p>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 scrollbar-hide snap-x snap-mandatory">
                  {weeklyWrapped.map((item, idx) => {
                    const Icon = ICON_BY_KIND[item.kind] ?? FileText;
                    const displayName = item.filename ?? item.title ?? item.url?.slice(0, 30) ?? (item.content?.slice(0, 30) || "Sin título");
                    return (
                      <button
                        key={`wrapped-${item.kind}-${item.id}`}
                        type="button"
                        onClick={() => setSelectedItem(item)}
                        className="flex-shrink-0 w-36 snap-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 dark:from-emerald-500/15 dark:to-teal-500/15 border border-emerald-200/60 dark:border-emerald-700/50 p-3 text-left hover:from-emerald-500/25 hover:to-teal-500/25 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{idx + 1}</span>
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 dark:bg-emerald-500/30 flex items-center justify-center">
                            <Icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          </div>
                        </div>
                        <p className="text-zinc-800 dark:text-zinc-200 text-sm font-medium truncate leading-tight">{displayName}</p>
                        <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-1">
                          {item.openedCount} {item.openedCount === 1 ? "apertura" : "aperturas"} esta semana
                        </p>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-zinc-500 dark:text-zinc-400 text-xs font-medium uppercase tracking-wider mb-3">
                Procesados recientes
              </h2>
              {recent.length === 0 ? (
                <p className="text-zinc-500 dark:text-zinc-400 text-sm py-4">Aún no hay ítems procesados.</p>
              ) : (
                <ul className="space-y-2">
                  {recent.map((item) => (
                    <VaultListItem key={`${item.kind}-${item.id}`} item={item} onSelect={setSelectedItem} />
                  ))}
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
            className="w-full max-w-md rounded-t-2xl bg-white dark:bg-neutral-900 p-4 pb-safe shadow-xl"
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
                  {selectedItem.filename ?? selectedItem.title ?? selectedItem.url?.slice(0, 40) ?? (selectedItem.content?.slice(0, 50) || "Ítem")}
                </p>
                {isNoteItem && (
                  <div className="mb-4">
                    <p className="text-zinc-500 dark:text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2">
                      Ver nota
                    </p>
                    <div className="rounded-xl border border-zinc-200 dark:border-neutral-700 bg-zinc-50 dark:bg-neutral-800/80 p-3 max-h-48 overflow-y-auto">
                      {loadingNote ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
                        </div>
                      ) : (
                        <p className="text-zinc-800 dark:text-zinc-200 text-sm whitespace-pre-wrap break-words">
                          {fullNoteContent ?? selectedItem.content ?? "—"}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-3">
                  {(selectedItem.url || selectedItem.filePath) && (
                    <button
                      type="button"
                      onClick={openItemUrl}
                      className="flex-1 min-w-[100px] py-2.5 rounded-xl border border-brand-500/50 bg-brand-500/10 text-brand-600 dark:text-brand-400 text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {selectedItem.url ? "Abrir enlace" : (selectedItem.kind === "photo" || selectedItem.sourceKind === "photo") ? "Abrir imagen" : (selectedItem.kind === "video" || selectedItem.sourceKind === "video") ? "Ver video" : "Ver archivo"}
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
                      className="flex-1 min-w-[100px] py-2.5 pl-3 pr-4 rounded-xl border border-amber-400 dark:border-amber-500 text-amber-600 dark:text-amber-400 text-sm font-medium flex items-center justify-start gap-2 disabled:opacity-50"
                    >
                      {togglingFavorite ? <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" /> : <Star className="w-4 h-4 flex-shrink-0" />}
                      Quitar de favoritos
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleToggleFavorite}
                      disabled={togglingFavorite}
                      className="flex-1 min-w-[100px] py-2.5 pl-3 pr-4 rounded-xl border border-amber-400 dark:border-amber-500 text-amber-600 dark:text-amber-400 text-sm font-medium flex items-center justify-start gap-2 disabled:opacity-50"
                    >
                      {togglingFavorite ? <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" /> : <Star className="w-4 h-4 flex-shrink-0" />}
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
