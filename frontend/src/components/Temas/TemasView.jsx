import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { ArrowLeft, Folder, Loader2, FileText, Link2, File, Image, Mic, Video, ChevronRight, Search, X } from "lucide-react";
import FilePreview from "../shared/FilePreview";
import ItemDetailPanel from "../Vault/ItemDetailPanel";
import { useAppLanguage } from "../../context/LanguageContext";
import { translations } from "../../i18n/translations";
import { getInboxByKind, getInboxItem, checkFavorite, addToFavorites, removeFromFavorites, discardItem } from "../../api/client";

const ICON_BY_KIND = {
  note: FileText,
  link: Link2,
  file: File,
  photo: Image,
  audio: Mic,
  video: Video,
};

const rowButtonClass =
  "w-full flex items-center gap-3 p-3 rounded-2xl bg-zinc-50 border border-zinc-200 text-left hover:bg-zinc-100 transition-colors dark:bg-neutral-800/60 dark:border-neutral-700/50 dark:hover:bg-neutral-800/80";

const normalizeText = (text) => {
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
};

function getItemDisplayTitle(item) {
  if (item?.aiTitle && String(item.aiTitle).trim()) return item.aiTitle.trim();
  if (item?.filename && String(item.filename).trim()) return item.filename;
  return item?.title ?? item?.url?.slice(0, 40) ?? (item?.content?.slice(0, 50) || "Sin título");
}

function formatDate(iso, vt) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString(vt?.locale, { day: "numeric", month: "short", year: "numeric" });
}

function TemasListItem({ item, onSelect, vt }) {
  const displayName = getItemDisplayTitle(item);
  const topicsList = item.aiTopics ?? item.aiTags ?? [];
  const formattedDate = formatDate(item.createdAt, vt);

  return (
    <li>
      <button type="button" onClick={() => onSelect(item)} className={rowButtonClass}>
        <div className="relative flex-shrink-0">
          <FilePreview item={item} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-zinc-800 dark:text-zinc-200 text-sm font-medium truncate">{displayName}</p>
          <div className="flex flex-wrap items-center mt-1 gap-x-2 gap-y-1">
            {topicsList.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full text-blue-400 bg-blue-500/10 dark:bg-blue-500/20"
              >
                #{String(tag).trim().toLowerCase()}
              </span>
            ))}
            {formattedDate && (
              <span className="text-xs text-neutral-500 dark:text-zinc-400">{topicsList.length > 0 ? "• " : ""}{formattedDate}</span>
            )}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
      </button>
    </li>
  );
}

export default function TemasView({ onBack, onSelectItem }) {
  const { t, locale } = useAppLanguage();
  const vt = translations[locale]?.vault ?? translations.es?.vault ?? {};
  const [processedNotes, setProcessedNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [temaSeleccionado, setTemaSeleccionado] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef(null);

  const [selectedItem, setSelectedItem] = useState(null);
  const [fullNoteContent, setFullNoteContent] = useState(null);
  const [loadingNote, setLoadingNote] = useState(false);
  const [favoriteCheck, setFavoriteCheck] = useState({ favorited: false, favoriteId: null });
  const [togglingFavorite, setTogglingFavorite] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [panelDragY, setPanelDragY] = useState(0);
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const dragStartY = useRef(0);
  const panelDragYRef = useRef(0);
  const getReleaseY = (e) => (e.changedTouches ? e.changedTouches[0].clientY : e.clientY);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const kinds = ["note", "link", "file", "photo", "audio", "video"];
        const results = await Promise.all(kinds.map((k) => getInboxByKind(k)));
        const merged = results.flat().filter((item) => item.inboxStatus === "processed");
        if (!cancelled) setProcessedNotes(merged);
      } catch (err) {
        if (!cancelled) setProcessedNotes([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const temasAgrupados = useMemo(() => {
    const acc = {};
    processedNotes.forEach((note) => {
      const topics = note.aiTopics ?? note.aiTags ?? [];
      if (topics.length === 0) {
        const tema = "Otros";
        if (!acc[tema]) acc[tema] = [];
        acc[tema].push(note);
        return;
      }
      topics.forEach((t) => {
        const tema = String(t).trim() || "Otros";
        if (!acc[tema]) acc[tema] = [];
        acc[tema].push(note);
      });
    });
    return acc;
  }, [processedNotes]);

  const temasOrdenados = useMemo(() => Object.entries(temasAgrupados).sort((a, b) => b[1].length - a[1].length), [temasAgrupados]);

  const temasFiltrados = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return temasOrdenados;
    return temasOrdenados.filter(([tema]) => normalizeText(tema).includes(normalizeText(q)));
  }, [temasOrdenados, searchQuery]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) searchInputRef.current.focus();
  }, [searchOpen]);

  const isFavoriteItem = selectedItem?.kind === "favorite";

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
    if (!selectedItem || !isNoteItem) {
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
      .then((data) => { if (!cancelled) setFullNoteContent(data.content ?? ""); })
      .catch(() => { if (!cancelled) setFullNoteContent(selectedItem.content ?? ""); })
      .finally(() => { if (!cancelled) setLoadingNote(false); });
    return () => { cancelled = true; };
  }, [selectedItem, isNoteItem]);

  const handleCloseDetail = useCallback(() => {
    setSelectedItem(null);
    setShowDeleteConfirm(false);
    setPanelDragY(0);
  }, []);

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
    if (inLowerHalf) handleCloseDetail();
  }, [handleCloseDetail]);

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

  useEffect(() => {
    if (selectedItem) {
      setPanelDragY(0);
    }
  }, [selectedItem]);

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

  const handleToggleFavorite = useCallback(async () => {
    if (!selectedItem || selectedItem.kind === "favorite" || togglingFavorite) return;
    setTogglingFavorite(true);
    try {
      if (favoriteCheck.favorited) {
        await removeFromFavorites(favoriteCheck.favoriteId);
        setFavoriteCheck({ favorited: false, favoriteId: null });
      } else {
        await addToFavorites(selectedItem.kind, selectedItem.id);
        const r = await checkFavorite(selectedItem.kind, selectedItem.id);
        setFavoriteCheck({ favorited: r.favorited, favoriteId: r.favoriteId });
      }
    } finally {
      setTogglingFavorite(false);
    }
  }, [selectedItem, favoriteCheck, togglingFavorite]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!selectedItem || deleting) return;
    setDeleting(true);
    try {
      await discardItem(selectedItem.kind, selectedItem.id);
      setSelectedItem(null);
      setShowDeleteConfirm(false);
      setProcessedNotes((prev) => prev.filter((i) => !(i.kind === selectedItem.kind && i.id === selectedItem.id)));
    } finally {
      setDeleting(false);
    }
  }, [selectedItem, deleting]);

  const handleCancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-zinc-50 dark:bg-neutral-950">
        <header className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-neutral-800">
          <button type="button" onClick={onBack} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800 text-zinc-600 dark:text-zinc-300" aria-label={t("common.back")}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">{t("temas.title")}</h1>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (temaSeleccionado !== null) {
    const items = temasAgrupados[temaSeleccionado] ?? [];
    return (
      <div className="h-full flex flex-col bg-zinc-50 dark:bg-neutral-950">
        <header className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-neutral-800">
          <button
            type="button"
            onClick={() => setTemaSeleccionado(null)}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800 text-zinc-600 dark:text-zinc-300"
            aria-label={t("common.back")}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 text-lg font-semibold text-zinc-900 dark:text-white text-center capitalize truncate">
            {temaSeleccionado}
          </h1>
          <div className="w-9" />
        </header>
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-4 scrollbar-hide overscroll-contain">
          <ul className="space-y-2">
            {items.map((item) => (
              <TemasListItem key={`${item.kind}-${item.id}`} item={item} onSelect={setSelectedItem} vt={vt} />
            ))}
          </ul>
        </main>
        {selectedItem && (
          <ItemDetailPanel
            item={selectedItem}
            vt={vt}
            onClose={handleCloseDetail}
            fullNoteContent={fullNoteContent}
            loadingNote={loadingNote}
            favoriteCheck={favoriteCheck}
            togglingFavorite={togglingFavorite}
            isFavoriteItem={false}
            showDeleteConfirm={showDeleteConfirm}
            deleting={deleting}
            onOpenUrl={openItemUrl}
            onToggleFavorite={handleToggleFavorite}
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

  return (
    <div className="h-full flex flex-col bg-zinc-50 dark:bg-neutral-950">
      <header className="shrink-0 flex items-center h-14 px-4 border-b border-zinc-200 dark:border-neutral-800">
        {searchOpen ? (
          <div className="flex items-center gap-2 w-full">
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800 shrink-0"
              aria-label={t("common.cancel")}
            >
              <X className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
            </button>
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("temas.searchPlaceholder")}
              className="flex-1 min-w-0 bg-zinc-100 dark:bg-neutral-800 border border-zinc-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 text-sm outline-none focus:ring-2 focus:ring-brand-500/50"
              aria-label={t("temas.searchPlaceholder")}
            />
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={onBack}
              className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800 shrink-0"
              aria-label={t("common.back")}
            >
              <ArrowLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
            </button>
            <h1 className="flex-1 text-center text-lg font-semibold text-zinc-900 dark:text-white truncate px-2">
              {t("temas.collections")}
            </h1>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800 shrink-0"
              aria-label={t("temas.searchPlaceholder")}
            >
              <Search className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
            </button>
          </>
        )}
      </header>
      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-hide overscroll-contain">
        {temasOrdenados.length === 0 ? (
          <p className="text-zinc-500 dark:text-zinc-400 text-sm text-center py-8 px-4">{t("temas.empty")}</p>
        ) : temasFiltrados.length === 0 ? (
          <p className="text-neutral-500 text-sm text-center mt-8 px-4">
            {t("temas.noResults")} &quot;{searchQuery}&quot;
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 p-4 pb-4">
            {temasFiltrados.map(([tema, list]) => (
              <button
                key={tema}
                type="button"
                onClick={() => setTemaSeleccionado(tema)}
                className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col items-start justify-center active:scale-95 transition-transform text-left"
              >
                <Folder className="w-6 h-6 text-blue-500 mb-2 flex-shrink-0" />
                <span className="text-white font-medium capitalize truncate w-full">{tema}</span>
                <span className="text-xs text-neutral-500 mt-1">
                  {list.length} {list.length === 1 ? t("temas.file") : t("temas.files")}
                </span>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
