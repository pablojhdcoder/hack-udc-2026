import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, FileText, Link2, File, Image, Mic, Video, Loader2, ChevronRight, RefreshCw, Trash2, Star, Sparkles, Search, X } from "lucide-react";
import FilePreview from "../shared/FilePreview";
import ItemDetailPanel from "./ItemDetailPanel";
import { useAppLanguage } from "../../context/LanguageContext";
import { translations } from "../../i18n/translations";
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

const rowButtonClass =
  "w-full flex items-center gap-3 p-3 rounded-2xl bg-zinc-50 border border-zinc-200 text-left hover:bg-zinc-100 transition-colors dark:bg-neutral-800/60 dark:border-neutral-700/50 dark:hover:bg-neutral-800/80";

/**
 * Fila de lista unificada para Búsqueda, Fotos, Vídeo, Novedades, Favoritos y Procesados recientes.
 * Misma previsualización (FilePreview) y mismo layout en todas las vistas.
 * Cuando se pasa `searchTokens`, resalta las tags/topic que coinciden y muestra barra de relevancia.
 */
/** Título a mostrar: primero título IA (aiEnrichment/aiTitle), solo si no hay usa filename. */
function getItemDisplayTitle(item) {
  if (item?.aiTitle && String(item.aiTitle).trim()) return item.aiTitle.trim();
  const ai = item?.aiEnrichment;
  if (ai && typeof ai === "object" && ai.title) return String(ai.title).trim();
  if (item?.filename && String(item.filename).trim()) return item.filename;
  return item?.title ?? item?.url?.slice(0, 40) ?? (item?.content?.slice(0, 50) || "Sin título");
}

function VaultListItem({ item, onSelect, searchTokens, isFavorited, vt }) {
  const displayName = getItemDisplayTitle(item);
  const formattedDate = formatDate(item.createdAt, vt);

  // Un solo origen de temas: aiTopics (backend envía aiTags = aiTopics)
  const topicsList = item.aiTopics ?? item.aiTags ?? [];
  const hasSearch = searchTokens && searchTokens.length > 0;
  const matchTag = (str) =>
    hasSearch && str && searchTokens.some((t) => String(str).toLowerCase().includes(t));

  const categoryMatches = hasSearch && item.aiCategory && matchTag(item.aiCategory);

  // Barra de relevancia: normaliza sobre 60 (puntuación alta razonable para 1 token)
  const maxScore = 60;
  const scorePercent = hasSearch && item.score
    ? Math.min(100, Math.round((item.score / maxScore) * 100))
    : 0;

  return (
    <li>
      <button type="button" onClick={() => onSelect(item)} className={rowButtonClass}>
        <div className="relative flex-shrink-0">
          <FilePreview item={item} />
          {(item.kind === "favorite" || isFavorited) && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center shadow-sm">
              <Star className="w-2.5 h-2.5 text-white fill-white" />
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-zinc-800 dark:text-zinc-200 text-sm font-medium truncate">{displayName}</p>
          <div className="flex flex-wrap items-center mt-1 gap-x-2 gap-y-1">
            {topicsList.map((tag) => {
              const isMatch = matchTag(tag);
              return (
                <span
                  key={tag}
                  className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    isMatch
                      ? "text-amber-300 bg-amber-950/50 ring-1 ring-amber-500/40"
                      : "text-blue-400 bg-blue-500/10 dark:bg-blue-500/20"
                  }`}
                >
                  #{String(tag).trim().toLowerCase()}
                </span>
              );
            })}
            {categoryMatches && (
              <span className="text-xs text-violet-300 bg-violet-950/50 ring-1 ring-violet-500/40 px-2 py-0.5 rounded-md">
                {item.aiCategory}
              </span>
            )}
            {formattedDate && (
              <span className="text-xs text-neutral-500 dark:text-zinc-400">{topicsList.length > 0 ? "• " : ""}{formattedDate}</span>
            )}
          </div>
          {hasSearch && scorePercent > 0 && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 h-0.5 rounded-full bg-neutral-700/50 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-400 transition-all"
                  style={{ width: `${scorePercent}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
      </button>
    </li>
  );
}

function formatDate(iso, vt) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  if (d >= today) return vt.dateToday;
  if (d >= yesterday) return vt.dateYesterday;
  if (now - d < 7 * 24 * 60 * 60 * 1000) return vt.dateThisWeek;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function VaultScreen({ onBack, initialFolder, initialItemId }) {
  const { locale } = useAppLanguage();
  const vt = translations[locale]?.vault ?? translations.es.vault;
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
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const searchInputRef = useRef(null);
  const lastOpenedKeyRef = useRef(null);
  const initialAppliedRef = useRef(false);
  const [panelDragY, setPanelDragY] = useState(0);
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const dragStartY = useRef(0);
  const panelDragYRef = useRef(0);
  const getReleaseY = (e) => (e.changedTouches ? e.changedTouches[0].clientY : e.clientY);

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
      const [list, favs] = await Promise.all([
        fetchFolderItems(kind),
        kind !== "favorite" ? getFavorites() : Promise.resolve([]),
      ]);
      setItemsByKind(Array.isArray(list) ? list : []);
      if (kind !== "favorite") {
        setFavoriteIds(new Set((Array.isArray(favs) ? favs : []).map((f) => f.sourceId)));
      }
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
    setSearchTerm("");
    setSearchResults([]);
    setSearchOpen(false);
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
      setToastMessage(vt.deleted);
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
    if (selectedItem) {
      setShowDeleteConfirm(false);
      setPanelDragY(0);
    }
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
        setFavoriteIds((prev) => { const next = new Set(prev); next.delete(selectedItem.id); return next; });
        setToastMessage(vt.removedFavorite);
      } else {
        const created = await addToFavorites(selectedItem.kind, selectedItem.id);
        setFavoriteCheck({ favorited: true, favoriteId: created.id });
        setFavoriteIds((prev) => new Set([...prev, selectedItem.id]));
        setToastMessage(vt.addedFavorite);
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
      setToastMessage(vt.removedFavorite);
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

  const selectedLabel = selectedKind ? (vt.kindLabels[selectedKind] || selectedKind) : null;

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  // Búsqueda: si estamos dentro de una carpeta (note, link, file, etc.), buscar solo en esa carpeta
  const searchKind = folderViewActive && selectedKind && !["favorite", "novelty"].includes(selectedKind)
    ? selectedKind
    : null;

  useEffect(() => {
    const q = searchTerm.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const url = searchKind
          ? `/api/search?q=${encodeURIComponent(q)}&kind=${encodeURIComponent(searchKind)}`
          : `/api/search?q=${encodeURIComponent(q)}`;
        const res = await fetch(url);
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
  }, [searchTerm, searchKind]);

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

  const getClientY = (e) => (e.touches ? e.touches[0].clientY : e.clientY);

  const handlePanelDragStart = useCallback((e) => {
    e.preventDefault();
    dragStartY.current = getClientY(e);
    setPanelDragY(0);
    setIsDraggingPanel(true);
  }, []);

  const handlePanelDragMove = useCallback((e) => {
    const y = getClientY(e);
    const dy = y - dragStartY.current;
    const next = Math.max(0, dy);
    panelDragYRef.current = next;
    setPanelDragY(next);
  }, []);

  const handlePanelDragEnd = useCallback((e) => {
    const releaseY = typeof e !== "undefined" && e !== null ? getReleaseY(e) : null;
    setIsDraggingPanel(false);
    setPanelDragY(0);
    const mid = typeof window !== "undefined" ? window.innerHeight / 2 : 400;
    const inLowerHalf = releaseY != null && releaseY >= mid;
    if (inLowerHalf) {
      setSelectedItem(null);
      setShowDeleteConfirm(false);
    }
  }, []);

  useEffect(() => {
    if (!isDraggingPanel) return;
    const onMove = (e) => {
      e.preventDefault();
      handlePanelDragMove(e);
    };
    const onEnd = (ev) => handlePanelDragEnd(ev);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("mousemove", handlePanelDragMove);
    document.addEventListener("mouseup", onEnd);
    return () => {
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("mousemove", handlePanelDragMove);
      document.removeEventListener("mouseup", onEnd);
    };
  }, [isDraggingPanel, handlePanelDragMove, handlePanelDragEnd]);

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-white dark:bg-neutral-900">
      <header className="shrink-0 flex items-center h-14 px-4 bg-white border-b border-zinc-200 safe-top dark:bg-neutral-900 dark:border-neutral-800">
        {searchOpen ? (
          <div className="flex items-center gap-2 w-full">
            <button
              type="button"
              onClick={handleCloseSearch}
              className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800 shrink-0"
              aria-label={vt.closeSearchAria}
            >
              <X className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
            </button>
            <input
              ref={searchInputRef}
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
              placeholder={folderViewActive && selectedLabel ? vt.searchInFolderPlaceholder.replace("{folder}", selectedLabel) : vt.searchPlaceholder}
              className="flex-1 min-w-0 bg-zinc-100 dark:bg-neutral-800 border border-zinc-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 text-sm outline-none focus:ring-2 focus:ring-brand-500/50"
              aria-label={vt.searchAria}
            />
            <button
              type="button"
              onClick={handleBuscar}
              className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium shrink-0"
            >
              {vt.searchBtn}
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
              aria-label={vt.backAria}
            >
              <ArrowLeft className="w-6 h-6 text-zinc-600 dark:text-zinc-300" />
            </button>
            <h1 className="flex-1 text-center text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate px-2">
              {selectedLabel ?? vt.folders}
            </h1>
            <div className="flex items-center gap-0">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800"
                aria-label={vt.searchAria}
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
                aria-label={vt.reloadAria}
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
              aria-label={vt.backAria}
            >
              <ArrowLeft className="w-6 h-6 text-zinc-600 dark:text-zinc-300" />
            </button>
            <h1 className="flex-1 text-center text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate px-2">
              {vt.title}
            </h1>
            <div className="flex items-center gap-0">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800"
                aria-label={vt.searchAria}
              >
                <Search className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
              </button>
              <button
                type="button"
                onClick={() => load()}
                className="p-2 -mr-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800"
                aria-label={vt.reloadAria}
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
          searchTerm.trim() ? (
            searchLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-10 h-10 text-brand-500 animate-spin mb-3" />
                <p className="text-zinc-500 dark:text-zinc-400 text-sm">{vt.searchingFolder}</p>
              </div>
            ) : searchResults.length === 0 ? (
              <p className="text-zinc-500 dark:text-zinc-400 text-sm py-8">{vt.noResultsInFolder}</p>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col">
                <p className="text-zinc-500 dark:text-zinc-400 text-xs mb-3">
                  {searchResults.length === 1 ? vt.resultCount.replace("{count}", 1) : vt.resultCountPlural.replace("{count}", searchResults.length)}
                </p>
                <ul className="space-y-2">
                  {searchResults.map((item) => {
                    const tokens = searchTerm.trim().toLowerCase().split(/\s+/).filter(Boolean);
                    return (
                      <VaultListItem
                        key={`search-${item.kind ?? "item"}-${item.id}`}
                        item={item}
                        onSelect={setSelectedItem}
                        searchTokens={tokens}
                        vt={vt}
                      />
                    );
                  })}
                </ul>
              </div>
            )
          ) : loadingKind ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-10 h-10 text-brand-500 animate-spin mb-3" />
              <p className="text-zinc-500 text-sm">{vt.loadingFolder}</p>
            </div>
          ) : itemsByKind.length === 0 ? (
            <p className="text-zinc-500 dark:text-zinc-400 text-sm py-8">{vt.noItemsInFolder}</p>
          ) : (
            <ul className="space-y-2">
              {itemsByKind.map((item) => (
                <VaultListItem key={`${item.kind}-${item.id}`} item={item} onSelect={setSelectedItem} isFavorited={item.kind !== "favorite" && favoriteIds.has(item.id)} vt={vt} />
              ))}
            </ul>
          )
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-10 h-10 text-brand-500 animate-spin mb-3" />
            <p className="text-zinc-500 text-sm">{vt.loading}</p>
          </div>
        ) : searchTerm.trim() ? (
          <div className="flex-1 min-h-0 flex flex-col">
            {searchLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-10 h-10 text-brand-500 animate-spin mb-3" />
                <p className="text-zinc-500 dark:text-zinc-400 text-sm">{vt.searching}</p>
              </div>
            ) : searchResults.length === 0 ? (
              <p className="text-zinc-500 dark:text-zinc-400 text-sm py-8">{vt.noResults}</p>
            ) : (
              <>
                <p className="text-zinc-500 dark:text-zinc-400 text-xs mb-3">
                  {searchResults.length === 1 ? vt.resultCount.replace("{count}", 1) : vt.resultCountPlural.replace("{count}", searchResults.length)}
                </p>
                <ul className="space-y-2">
                  {searchResults.map((item) => {
                    const tokens = searchTerm.trim().toLowerCase().split(/\s+/).filter(Boolean);
                    return (
                      <VaultListItem
                        key={`search-${item.kind ?? "item"}-${item.id}`}
                        item={item}
                        onSelect={setSelectedItem}
                        searchTokens={tokens}
                        vt={vt}
                      />
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        ) : (
          <>
            <section>
              <h2 className="text-zinc-500 dark:text-zinc-400 text-xs font-medium uppercase tracking-wider mb-3">
                {vt.folders}
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {[...folders].sort((a, b) => {
                  const priority = { novelty: 0, favorite: 1 };
                  return (priority[a.kind] ?? 2) - (priority[b.kind] ?? 2);
                }).map((f) => {
                  const Icon = ICON_BY_KIND[f.kind] ?? FileText;
                  const label = f.name || vt.kindLabels[f.kind] || f.kind;
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
                        {f.count} {f.count === 1 ? vt.item : vt.items}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {weeklyWrapped.length > 0 && (
              <section>
                <h2 className="text-zinc-500 dark:text-zinc-400 text-xs font-medium uppercase tracking-wider mb-3">
                  {vt.weeklyHits}
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-3">
                  {vt.weeklySubtitle}
                </p>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 scrollbar-hide snap-x snap-mandatory">
                  {weeklyWrapped.map((item, idx) => {
                    const Icon = ICON_BY_KIND[item.kind] ?? FileText;
                    const displayName = getItemDisplayTitle(item);
                    const openCount = item.openedCount ?? 0;
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
                          {openCount === 1 ? vt.openingsThisWeek.replace("{count}", 1) : vt.openingsThisWeekPlural.replace("{count}", openCount)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-zinc-500 dark:text-zinc-400 text-xs font-medium uppercase tracking-wider mb-3">
                {vt.recentlyProcessed}
              </h2>
              {recent.length === 0 ? (
                <p className="text-zinc-500 dark:text-zinc-400 text-sm py-4">{vt.noRecentItems}</p>
              ) : (
                <ul className="space-y-2">
                  {recent.map((item) => (
                    <VaultListItem key={`${item.kind}-${item.id}`} item={item} onSelect={setSelectedItem} vt={vt} />
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
        <ItemDetailPanel
          item={selectedItem}
          vt={vt}
          onClose={() => { setShowDeleteConfirm(false); setSelectedItem(null); }}
          fullNoteContent={fullNoteContent}
          loadingNote={loadingNote}
          favoriteCheck={favoriteCheck}
          togglingFavorite={togglingFavorite}
          isFavoriteItem={isFavoriteItem}
          showDeleteConfirm={showDeleteConfirm}
          deleting={deleting}
          onOpenUrl={openItemUrl}
          onToggleFavorite={isFavoriteItem ? undefined : handleToggleFavorite}
          onRemoveFavorite={isFavoriteItem ? handleQuitarDeFavoritos : undefined}
          onDeleteClick={() => setShowDeleteConfirm(true)}
          onConfirmDelete={handleDeleteConfirm}
          onCancelDelete={handleCancelDelete}
          panelDragY={panelDragY}
          onPanelDragStart={handlePanelDragStart}
          showDragHandle
        />
      )}
    </div>
  );
}
