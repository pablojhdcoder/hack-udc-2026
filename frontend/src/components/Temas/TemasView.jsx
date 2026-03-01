import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, BookOpen, Loader2, Search, X, ChevronRight, FileText, Link2, File, Image, Mic, Video, RefreshCw } from "lucide-react";
import { useAppLanguage } from "../../context/LanguageContext";
import { translations } from "../../i18n/translations";
import FilePreview from "../shared/FilePreview";
import ItemDetailPanel, { getItemDisplayTitle } from "../Vault/ItemDetailPanel";
import {
  getInboxItem,
  getRelatedItems,
  checkFavorite,
  addToFavorites,
  removeFromFavorites,
  discardItem,
  markOpened,
} from "../../api/client";

const ICON_BY_KIND = {
  note: FileText,
  link: Link2,
  file: File,
  photo: Image,
  audio: Mic,
  video: Video,
};

function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function normalizeText(t) {
  return String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function TopicDetail({ topic, data, onBack, vt, onOpenItemDetail }) {
  const sourceItems = data?.sourceItems ?? [];
  return (
    <div className="h-full flex flex-col bg-white dark:bg-neutral-950">
      <header className="shrink-0 flex items-center h-14 px-4 border-b border-zinc-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
        <button type="button" onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800 shrink-0" aria-label={vt?.back ?? "Volver"}>
          <ArrowLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
        </button>
        <h1 className="flex-1 text-center text-base font-semibold text-zinc-900 dark:text-white truncate px-2 capitalize">{topic}</h1>
        <div className="w-9 shrink-0" />
      </header>
      <main className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 scrollbar-hide">
        {data?.summary ? (
          <div className="rounded-2xl bg-zinc-50 dark:bg-neutral-800/70 border border-zinc-200 dark:border-neutral-700/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-brand-500 shrink-0" />
              <p className="text-xs font-semibold text-brand-500 uppercase tracking-wider">{vt?.topicSummaryLabel ?? "Resumen del tema"}</p>
            </div>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">{data.summary}</p>
            {data.updatedAt && (
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-3 flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />
                {vt?.lastUpdated ?? "Actualizado"} {formatDate(data.updatedAt)}
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-2xl bg-zinc-50 dark:bg-neutral-800/70 border border-zinc-200 dark:border-neutral-700/50 p-4">
            <p className="text-sm text-zinc-400 dark:text-zinc-500 italic">{vt?.noSummaryYet ?? "Aun no hay resumen para este tema."}</p>
          </div>
        )}
        {sourceItems.length > 0 && (
          <div>
            <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2 px-1">{vt?.topicSources ?? "Fuentes"} ({sourceItems.length})</p>
            <ul className="space-y-2">
              {sourceItems.map((item, idx) => {
                const clickable = onOpenItemDetail && item.kind && item.id;
                const rowClass = "w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-neutral-800/60 border border-zinc-200 dark:border-neutral-700/50 hover:bg-zinc-100 dark:hover:bg-neutral-800 transition-colors active:scale-[0.98] text-left";
                return (
                  <li key={`${item.kind}-${item.id ?? idx}`}>
                    {clickable ? (
                      <button
                        type="button"
                        onClick={() => onOpenItemDetail(item.kind, item.id)}
                        className={rowClass}
                      >
                        <div className="relative flex-shrink-0">
                          <FilePreview item={item} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{item.title ?? "(sin título)"}</p>
                          {item.createdAt && <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{formatDate(item.createdAt)}</p>}
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
                      </button>
                    ) : (
                      <div className={rowClass.replace("hover:bg-zinc-100 dark:hover:bg-neutral-800 transition-colors active:scale-[0.98]", "")}>
                        <div className="relative flex-shrink-0">
                          <FilePreview item={item} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{item.title ?? "(sin título)"}</p>
                          {item.createdAt && <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{formatDate(item.createdAt)}</p>}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}

function TopicCard({ topic, summary, itemCount, updatedAt, onClick }) {
  const previewText = summary ? summary.slice(0, 120) + (summary.length > 120 ? "\u2026" : "") : null;
  return (
    <button type="button" onClick={onClick} className="w-full text-left rounded-2xl bg-white dark:bg-neutral-800/70 border border-zinc-200 dark:border-neutral-700/50 p-4 hover:bg-zinc-50 dark:hover:bg-neutral-800 transition-colors active:scale-[0.98]">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4 text-brand-500" />
          </div>
          <span className="text-sm font-semibold text-zinc-900 dark:text-white capitalize truncate">{topic}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-zinc-400 dark:text-zinc-500">{itemCount}</span>
          <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
        </div>
      </div>
      {previewText
        ? <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-3">{previewText}</p>
        : <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">Sin resumen aun...</p>
      }
      {updatedAt && <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-2">{formatDate(updatedAt)}</p>}
    </button>
  );
}

const getReleaseY = (e) => (e.changedTouches ? e.changedTouches[0].clientY : e.clientY);
const getClientY = (e) => (e.touches ? e.touches[0].clientY : e.clientY);

export default function TemasView({ onBack }) {
  const { locale } = useAppLanguage();
  const vt = translations[locale]?.vault ?? translations.es?.vault ?? {};
  const tt = translations[locale]?.temas ?? translations.es?.temas ?? {};
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const searchInputRef = useRef(null);

  // Detalle unificado (misma interfaz que pantalla de procesado)
  const [selectedForDetail, setSelectedForDetail] = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [favoriteCheck, setFavoriteCheck] = useState({ favorited: false, favoriteId: null });
  const [togglingFavorite, setTogglingFavorite] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [relatedItems, setRelatedItems] = useState([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [relatedOpen, setRelatedOpen] = useState(true);
  const [panelDragY, setPanelDragY] = useState(0);
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const dragStartY = useRef(0);
  const panelDragYRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/topics");
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) setError(data?.error || res.statusText || `Error ${res.status}`);
          return;
        }
        if (!cancelled) setTopics(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err?.message ?? "Error al cargar temas");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) searchInputRef.current.focus();
  }, [searchOpen]);

  // Cargar ítem completo al abrir detalle
  useEffect(() => {
    if (!selectedForDetail?.kind || !selectedForDetail?.id) {
      setDetailItem(null);
      setLoadingDetail(false);
      return;
    }
    setLoadingDetail(true);
    setDetailItem(null);
    let cancelled = false;
    getInboxItem(selectedForDetail.kind, selectedForDetail.id)
      .then((data) => {
        if (!cancelled) setDetailItem({ ...data, kind: selectedForDetail.kind, id: selectedForDetail.id });
      })
      .catch(() => { if (!cancelled) setDetailItem(null); })
      .finally(() => { if (!cancelled) setLoadingDetail(false); });
    return () => { cancelled = true; };
  }, [selectedForDetail]);

  // Favoritos y relacionados cuando hay ítem seleccionado
  useEffect(() => {
    if (!detailItem) {
      setFavoriteCheck({ favorited: false, favoriteId: null });
      setRelatedItems([]);
      setLoadingRelated(false);
      return;
    }
    const kind = detailItem.kind;
    const id = detailItem.id;
    let cancelled = false;
    checkFavorite(kind, id).then((r) => {
      if (!cancelled) setFavoriteCheck({ favorited: r.favorited, favoriteId: r.favoriteId });
    }).catch(() => {});
    setLoadingRelated(true);
    setRelatedItems([]);
    getRelatedItems(kind, id)
      .then((list) => { if (!cancelled) setRelatedItems(Array.isArray(list) ? list : []); })
      .catch(() => { if (!cancelled) setRelatedItems([]); })
      .finally(() => { if (!cancelled) setLoadingRelated(false); });
    return () => { cancelled = true; };
  }, [detailItem]);

  const handleCloseDetail = useCallback(() => {
    setShowDeleteConfirm(false);
    setSelectedForDetail(null);
    setDetailItem(null);
  }, []);

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
    const onMove = (e) => { e.preventDefault(); handlePanelDragMove(e); };
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

  const openItemUrl = useCallback(() => {
    if (!detailItem) return;
    if (detailItem.url) {
      window.open(detailItem.url, "_blank", "noopener,noreferrer");
      return;
    }
    if (detailItem.filePath) {
      const basename = detailItem.filePath.split("/").pop() || detailItem.filePath;
      window.open(`/api/uploads/${basename}`, "_blank", "noopener,noreferrer");
    }
  }, [detailItem]);

  const handleToggleFavorite = useCallback(async () => {
    if (!detailItem || detailItem.kind === "favorite" || togglingFavorite) return;
    setTogglingFavorite(true);
    try {
      if (favoriteCheck.favorited) {
        await removeFromFavorites(favoriteCheck.favoriteId);
        setFavoriteCheck({ favorited: false, favoriteId: null });
      } else {
        const created = await addToFavorites(detailItem.kind, detailItem.id);
        setFavoriteCheck({ favorited: true, favoriteId: created.id });
      }
      handleCloseDetail();
    } catch (err) {
      // mantener panel abierto en error
    } finally {
      setTogglingFavorite(false);
    }
  }, [detailItem, favoriteCheck, togglingFavorite, handleCloseDetail]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!detailItem || deleting) return;
    setDeleting(true);
    try {
      await discardItem(detailItem.kind, detailItem.id);
      handleCloseDetail();
    } catch (err) {
      // mantener panel en error
    } finally {
      setDeleting(false);
    }
  }, [detailItem, deleting, handleCloseDetail]);

  const handleCancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  useEffect(() => {
    if (detailItem) setShowDeleteConfirm(false);
  }, [detailItem]);

  const filtered = topics.filter((t) =>
    !searchQuery.trim() || normalizeText(t.topic).includes(normalizeText(searchQuery))
  );

  if (selectedTopic) {
    return (
      <>
        <TopicDetail
          topic={selectedTopic.topic}
          data={selectedTopic.data}
          onBack={() => { setSelectedTopic(null); setSelectedForDetail(null); setDetailItem(null); }}
          vt={{ ...vt, ...tt }}
          onOpenItemDetail={(kind, id) => setSelectedForDetail({ kind, id })}
        />
        {selectedForDetail && loadingDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" aria-busy="true">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
        {detailItem && (
          <ItemDetailPanel
            item={detailItem}
            vt={vt}
            onClose={handleCloseDetail}
            fullNoteContent={detailItem.content ?? null}
            loadingNote={false}
            favoriteCheck={favoriteCheck}
            togglingFavorite={togglingFavorite}
            isFavoriteItem={false}
            showDeleteConfirm={showDeleteConfirm}
            deleting={deleting}
            onOpenUrl={openItemUrl}
            onToggleFavorite={handleToggleFavorite}
            onRemoveFavorite={undefined}
            onDeleteClick={() => setShowDeleteConfirm(true)}
            onConfirmDelete={handleDeleteConfirm}
            onCancelDelete={handleCancelDelete}
            panelDragY={panelDragY}
            onPanelDragStart={handlePanelDragStart}
            showDragHandle
            relatedItems={relatedItems}
            loadingRelated={loadingRelated}
            relatedOpen={relatedOpen}
            onRelatedOpenChange={setRelatedOpen}
            onSelectRelatedItem={(rel) => setSelectedForDetail(rel ? { kind: rel.kind, id: rel.id } : null)}
            relatedLabel={vt.relatedLabel ?? "Conectado con"}
            relatedEmpty={vt.relatedEmpty ?? "Nada relacionado por ahora"}
            getItemDisplayTitle={getItemDisplayTitle}
            iconByKind={ICON_BY_KIND}
          />
        )}
      </>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-neutral-950">
      <header className="shrink-0 flex items-center h-14 px-4 border-b border-zinc-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
        {searchOpen ? (
          <div className="flex items-center gap-2 w-full">
            <button
              type="button"
              onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
              className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800 shrink-0"
            >
              <X className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
            </button>
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tt.searchPlaceholder ?? "Buscar tema..."}
              className="flex-1 min-w-0 bg-zinc-100 dark:bg-neutral-800 border border-zinc-200 dark:border-neutral-700 rounded-xl px-4 py-2 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 text-sm outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={onBack}
              className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800 shrink-0"
              aria-label={vt.back ?? "Volver"}
            >
              <ArrowLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
            </button>
            <h1 className="flex-1 text-center text-lg font-semibold text-zinc-900 dark:text-white truncate px-2">
              {tt.title ?? "Temas"}
            </h1>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-neutral-800 shrink-0"
            >
              <Search className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
            </button>
          </>
        )}
      </header>
      <main className="flex-1 min-h-0 overflow-y-auto px-4 py-4 scrollbar-hide">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
          </div>
        )}
        {error && !loading && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">{error}</div>
        )}
        {!loading && !error && topics.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <BookOpen className="w-12 h-12 text-zinc-300 dark:text-zinc-600" />
            <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-xs">
              {tt.empty ?? "Procesa items del inbox para generar resumenes por tema."}
            </p>
          </div>
        )}
        {!loading && !error && topics.length > 0 && filtered.length === 0 && (
          <p className="text-zinc-500 dark:text-zinc-400 text-sm text-center py-8">
            {tt.noResults ?? "Sin resultados"} &quot;{searchQuery}&quot;
          </p>
        )}
        {!loading && !error && filtered.length > 0 && (
          <ul className="space-y-3">
            {filtered.map((t) => (
              <li key={t.topic}>
                <TopicCard
                  topic={t.topic}
                  summary={t.summary}
                  itemCount={t.itemCount}
                  updatedAt={t.updatedAt}
                  onClick={() => setSelectedTopic({ topic: t.topic, data: t })}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
